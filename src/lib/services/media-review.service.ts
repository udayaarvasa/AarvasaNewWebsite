import { z } from "zod";
import {
  MEDIA_ASSET_STATUSES,
  validateMediaAssetRecord,
  type MediaAssetFormat,
  type MediaAssetKind,
  type MediaAssetStatus,
  type MediaSubjectType,
} from "../../../shared/media-asset";
import {
  MEDIA_PROVENANCE,
  PROVENANCE_LABEL,
  provenanceAllowedFor,
  type MediaProvenance,
} from "../media/provenance";
import { MEDIA_ID_PATTERN, reviewKeyFor } from "../../../shared/media-contract";
import { assertTransition, publicFailureMessage } from "../../../shared/media-processing";
import { ImmutableObjectConflictError, REVIEW_PREVIEW_MAX_SECONDS, ReviewCopyMissingError, type ReviewAccess } from "../media/published-storage";

/**
 * Admin media review (Phase 5): list, inspect, preview, approve (publish) and reject.
 *
 *   PENDING_REVIEW ──approve──► PUBLISHED   (review/ copies published write-once to m/)
 *   PENDING_REVIEW ──reject───► REJECTED    (review/ copies expire with the bucket lifecycle)
 *
 * ADMIN only, with the role re-read from the database on every request. Nothing
 * trusted comes from the client: the asset, its keys, status and subject are read
 * from the row; the only inputs are alt text (approval) and a reason (rejection).
 *
 * Approval commits PENDING_REVIEW → PUBLISHED first and publishes afterwards, so a
 * racing rejection can never leave CDN-reachable files behind (PUBLISHED → REJECTED
 * is not a transition). Review copies are checked before the commit; if publication
 * still fails after it, the asset is PUBLISHED with files missing and approving
 * again completes it (idempotent, write-once).
 */

export type ReviewResult = { readonly status: number; readonly body: Readonly<Record<string, unknown>> };

export interface ReviewUser {
  readonly id: string;
  readonly role: string;
}

export interface ReviewAssetRow {
  readonly id: string;
  readonly subjectType: MediaSubjectType;
  readonly propertyId: string | null;
  readonly projectSlug: string | null;
  readonly propertyTitle: string | null;
  readonly kind: MediaAssetKind;
  readonly format: MediaAssetFormat | null;
  readonly status: MediaAssetStatus;
  readonly storageKey: string | null;
  readonly entryFile: string | null;
  readonly contentHash: string | null;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly fileCount: number | null;
  readonly posterKey: string | null;
  readonly dimensions: unknown;
  readonly metrics: unknown;
  readonly title: string | null;
  readonly altText: string | null;
  readonly provenance: MediaProvenance;
  readonly sourceKey: string;
  readonly sourceSizeBytes: number;
  readonly sourceMimeType: string;
  readonly sourceChecksumSha256: string | null;
  readonly processorVersion: string | null;
  readonly processingAttempts: number;
  readonly processingStartedAt: Date | null;
  readonly failureCode: string | null;
  readonly processingError: string | null;
  readonly rejectionReason: string | null;
  readonly uploadedBy: { readonly id: string; readonly name: string | null; readonly email: string | null } | null;
  readonly reviewedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface MediaReviewStore {
  findUser(id: string): Promise<ReviewUser | null>;
  listAssets(filter: { readonly status: MediaAssetStatus | null; readonly limit: number }): Promise<ReviewAssetRow[]>;
  findAsset(id: string): Promise<ReviewAssetRow | null>;
  /** PENDING_REVIEW → PUBLISHED (reviewedAt, publishedAt, reviewer, alt text). Returns rows updated. */
  approve(id: string, reviewerId: string, now: Date, altText: string, provenance: MediaProvenance): Promise<number>;
  /** PENDING_REVIEW → REJECTED (reason, reviewedAt, reviewer). Returns rows updated. */
  reject(id: string, reviewerId: string, now: Date, reason: string): Promise<number>;
}

export interface MediaReviewDependencies {
  readonly store: MediaReviewStore;
  /** Null when MEDIA_REGION / MEDIA_PUBLISHED_BUCKET are not configured. */
  readonly getReviewAccess: () => ReviewAccess | null;
  readonly now: () => Date;
  /** Server-side diagnostics only. Never URLs, credentials or AWS messages. */
  readonly log: (message: string, context: Readonly<Record<string, string | number | null>>) => void;
}

export interface ReviewRequest {
  /** From getAuthUser(req). Only the id is used; the token's role is never trusted. */
  readonly caller: { readonly id: string } | null;
}

export type ReviewErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "NOT_REVIEWABLE"
  | "ALT_TEXT_REQUIRED"
  | "INCONSISTENT_ASSET"
  | "REVIEW_COPY_MISSING"
  | "PUBLISH_INCOMPLETE"
  | "STORAGE_UNAVAILABLE"
  | "SERVER_ERROR";

const ERRORS: Record<ReviewErrorCode, { status: number; message: string; retryable: boolean }> = {
  UNAUTHORIZED: { status: 401, message: "Unauthorized", retryable: false },
  FORBIDDEN: { status: 403, message: "Forbidden", retryable: false },
  NOT_FOUND: { status: 404, message: "Not found", retryable: false },
  INVALID_REQUEST: { status: 400, message: "Invalid request", retryable: false },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "Content-Type must be application/json", retryable: false },
  NOT_REVIEWABLE: { status: 409, message: "This asset is not awaiting review.", retryable: false },
  ALT_TEXT_REQUIRED: { status: 400, message: "Alt text is required before publishing.", retryable: false },
  INCONSISTENT_ASSET: { status: 409, message: "This asset cannot be published. Please re-upload it.", retryable: false },
  REVIEW_COPY_MISSING: { status: 409, message: "The processed files are no longer available. Please re-upload the asset.", retryable: false },
  PUBLISH_INCOMPLETE: { status: 502, message: "Publishing did not finish. Approve again to complete it.", retryable: true },
  STORAGE_UNAVAILABLE: { status: 503, message: "Media storage is not available. Please try again.", retryable: true },
  SERVER_ERROR: { status: 500, message: "Server error", retryable: true },
};

const fail = (code: ReviewErrorCode): ReviewResult => ({ status: ERRORS[code].status, body: { success: false, error: ERRORS[code].message, code, retryable: ERRORS[code].retryable } });
const ok = (data: unknown, status = 200): ReviewResult => ({ status, body: { success: true, data } });
const errorName = (error: unknown) => (error instanceof Error ? error.name : "UnknownError");

export const REVIEW_LIST_MAX = 100;
export const REVIEW_TEXT_LIMITS = { altText: 500, rejectionReason: 500 } as const;

/** Approval body: optional alt text (required only when the asset has none). */
/* A reviewer states what the asset actually is. This is the step that makes an
   asset public, so it is also the step that decides what the public is told it
   is — and whether it is shown at all, since INTERNAL_TEST never is. */
export const approveBodySchema = z.strictObject({
  altText: z.string().trim().min(1).max(REVIEW_TEXT_LIMITS.altText).optional(),
  provenance: z.enum(MEDIA_PROVENANCE).optional(),
});
/** Rejection body: a reason for the uploader's record. */
export const rejectBodySchema = z.strictObject({ reason: z.string().trim().min(3).max(REVIEW_TEXT_LIMITS.rejectionReason) });

/** The fresh-role ADMIN check every review endpoint starts with. */
export async function requireReviewAdmin(request: ReviewRequest, deps: Pick<MediaReviewDependencies, "store">): Promise<{ user: ReviewUser } | { error: ReviewResult }> {
  if (!request.caller) return { error: fail("UNAUTHORIZED") };
  const user = await deps.store.findUser(request.caller.id);
  if (!user) return { error: fail("UNAUTHORIZED") };
  if (user.role !== "ADMIN") return { error: fail("FORBIDDEN") };
  return { user };
}

/** What an admin sees. Diagnostics are included because only admins reach this. */
export function presentAsset(row: ReviewAssetRow) {
  return {
    id: row.id,
    subject: row.subjectType === "PROPERTY" ? { type: "PROPERTY", propertyId: row.propertyId, title: row.propertyTitle } : { type: "PROJECT", projectSlug: row.projectSlug },
    kind: row.kind,
    format: row.format,
    status: row.status,
    title: row.title,
    altText: row.altText,
    provenance: row.provenance,
    provenanceLabel: PROVENANCE_LABEL[row.provenance] ?? row.provenance,
    source: { sizeBytes: row.sourceSizeBytes, mimeType: row.sourceMimeType },
    processed: row.storageKey
      ? { sizeBytes: row.sizeBytes, mimeType: row.mimeType, fileCount: row.fileCount, dimensions: row.dimensions ?? null, metrics: row.metrics ?? null, hasPoster: row.posterKey !== null, contentHash: row.contentHash }
      : null,
    processorVersion: row.processorVersion,
    processingAttempts: row.processingAttempts,
    processingStartedAt: row.processingStartedAt?.toISOString() ?? null,
    failure: row.failureCode ? { code: row.failureCode, message: publicFailureMessage(row.failureCode), diagnostic: row.processingError } : null,
    rejectionReason: row.rejectionReason,
    uploadedBy: row.uploadedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listReviewAssets(request: ReviewRequest & { readonly status: string | null; readonly limit: string | null }, deps: MediaReviewDependencies): Promise<ReviewResult> {
  const admin = await requireReviewAdmin(request, deps);
  if ("error" in admin) return admin.error;
  const status = request.status === null || request.status === "" ? null : request.status;
  if (status !== null && !(MEDIA_ASSET_STATUSES as readonly string[]).includes(status)) return fail("INVALID_REQUEST");
  const limit = request.limit === null ? 50 : Number(request.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > REVIEW_LIST_MAX) return fail("INVALID_REQUEST");
  const rows = await deps.store.listAssets({ status: status as MediaAssetStatus | null, limit });
  return ok(rows.map(presentAsset));
}

async function loadAsset(request: ReviewRequest & { readonly mediaAssetId: string }, deps: MediaReviewDependencies) {
  const admin = await requireReviewAdmin(request, deps);
  if ("error" in admin) return admin;
  if (!MEDIA_ID_PATTERN.test(request.mediaAssetId)) return { error: fail("NOT_FOUND") };
  const row = await deps.store.findAsset(request.mediaAssetId);
  if (!row) return { error: fail("NOT_FOUND") };
  return { user: admin.user, row };
}

export async function getReviewAsset(request: ReviewRequest & { readonly mediaAssetId: string }, deps: MediaReviewDependencies): Promise<ReviewResult> {
  const loaded = await loadAsset(request, deps);
  if ("error" in loaded) return loaded.error;
  return ok(presentAsset(loaded.row));
}

/** The review copies an asset's processed fields point to: entry (with its content hash) and optional poster. */
export function reviewObjects(row: ReviewAssetRow): { entry: { reviewKey: string; sha256: string }; poster: { reviewKey: string } | null } | null {
  if (!row.storageKey || !row.entryFile || !row.contentHash) return null;
  try {
    return {
      entry: { reviewKey: reviewKeyFor(`${row.storageKey}/${row.entryFile}`), sha256: row.contentHash },
      poster: row.posterKey ? { reviewKey: reviewKeyFor(row.posterKey) } : null,
    };
  } catch {
    return null;
  }
}

interface BodyRequest extends ReviewRequest {
  readonly mediaAssetId: string;
  readonly contentType: string | null;
  readonly readBody: () => Promise<unknown>;
}

async function readJson(request: BodyRequest): Promise<{ body: unknown } | { error: ReviewResult }> {
  if (request.contentType?.split(";")[0]?.trim().toLowerCase() !== "application/json") return { error: fail("UNSUPPORTED_MEDIA_TYPE") };
  try {
    return { body: await request.readBody() };
  } catch {
    return { error: fail("INVALID_REQUEST") };
  }
}

/** Short-lived presigned GETs for a PENDING_REVIEW asset's review copies. Never the source upload. */
export async function createReviewPreview(request: BodyRequest, deps: MediaReviewDependencies): Promise<ReviewResult> {
  const loaded = await loadAsset(request, deps);
  if ("error" in loaded) return loaded.error;
  const parsed = await readJson(request);
  if ("error" in parsed) return parsed.error;
  if (!z.strictObject({}).safeParse(parsed.body).success) return fail("INVALID_REQUEST");
  const { row } = loaded;
  if (row.status !== "PENDING_REVIEW") return fail("NOT_REVIEWABLE");
  const objects = reviewObjects(row);
  if (!objects) return fail("INCONSISTENT_ASSET");
  const access = deps.getReviewAccess();
  if (!access) return fail("STORAGE_UNAVAILABLE");
  try {
    const expiresAt = new Date(deps.now().getTime() + REVIEW_PREVIEW_MAX_SECONDS * 1000).toISOString();
    return ok({
      entry: { url: await access.presignGet(objects.entry.reviewKey, REVIEW_PREVIEW_MAX_SECONDS), mimeType: row.mimeType, sizeBytes: row.sizeBytes },
      poster: objects.poster ? { url: await access.presignGet(objects.poster.reviewKey, REVIEW_PREVIEW_MAX_SECONDS) } : null,
      expiresAt,
    });
  } catch (error) {
    deps.log("media preview could not be signed", { mediaAssetId: row.id, error: errorName(error) });
    return fail("STORAGE_UNAVAILABLE");
  }
}

async function publishObjects(row: ReviewAssetRow, access: ReviewAccess, deps: MediaReviewDependencies): Promise<ReviewResult | null> {
  const objects = reviewObjects(row);
  if (!objects) return fail("INCONSISTENT_ASSET");
  try {
    await access.publish(objects.entry.reviewKey, objects.entry.sha256);
    if (objects.poster) await access.publish(objects.poster.reviewKey, null);
    return null;
  } catch (error) {
    deps.log("media publication failed", { mediaAssetId: row.id, error: errorName(error) });
    if (error instanceof ReviewCopyMissingError) return fail("REVIEW_COPY_MISSING");
    if (error instanceof ImmutableObjectConflictError) return fail("SERVER_ERROR");
    return fail("PUBLISH_INCOMPLETE");
  }
}

export async function approveReviewAsset(request: BodyRequest, deps: MediaReviewDependencies): Promise<ReviewResult> {
  const loaded = await loadAsset(request, deps);
  if ("error" in loaded) return loaded.error;
  const parsed = await readJson(request);
  if ("error" in parsed) return parsed.error;
  const input = approveBodySchema.safeParse(parsed.body);
  if (!input.success) return fail("INVALID_REQUEST");
  const { user, row } = loaded;

  const access = deps.getReviewAccess();
  if (!access) return fail("STORAGE_UNAVAILABLE");

  /* The reviewer's statement wins over the uploader's, because the reviewer is
     the one accountable for what the public is told. A provenance that
     contradicts the kind — a panorama called an official building model — is
     refused here, before any branch, so no path can answer "success" to a
     request it then ignored. */
  const provenance = input.data.provenance ?? row.provenance;
  if (!provenanceAllowedFor(row.kind, provenance)) return fail("INVALID_REQUEST");

  // Already published: approving again only completes an unfinished publication
  // (idempotent). It deliberately does not re-state provenance or alt text —
  // changing what the public is told about a live asset is a separate decision,
  // not a side effect of retrying a publication that was interrupted.
  if (row.status === "PUBLISHED") {
    if (provenance !== row.provenance) return fail("NOT_REVIEWABLE");
    const error = await publishObjects(row, access, deps);
    return error ?? ok({ mediaAssetId: row.id, status: "PUBLISHED", provenance: row.provenance, transitioned: false });
  }
  if (row.status !== "PENDING_REVIEW") return fail("NOT_REVIEWABLE");

  const altText = input.data.altText ?? row.altText?.trim() ?? "";
  if (!altText) return fail("ALT_TEXT_REQUIRED");
  const now = deps.now();
  const problems = validateMediaAssetRecord({ ...row, status: "PUBLISHED", altText, reviewedAt: now, publishedAt: now, rejectionReason: null, processingError: null, failureCode: null });
  const objects = reviewObjects(row);
  if (problems.length > 0 || !objects) {
    deps.log("media approval refused an inconsistent asset", { mediaAssetId: row.id, problems: problems.join("; ") || "no review objects" });
    return fail("INCONSISTENT_ASSET");
  }
  // Pre-flight: never commit a decision that cannot be published.
  try {
    for (const key of [objects.entry.reviewKey, ...(objects.poster ? [objects.poster.reviewKey] : [])]) {
      if (!(await access.exists(key))) return fail("REVIEW_COPY_MISSING");
    }
  } catch (error) {
    deps.log("media review copies could not be checked", { mediaAssetId: row.id, error: errorName(error) });
    return fail("STORAGE_UNAVAILABLE");
  }

  assertTransition("REVIEW", "PENDING_REVIEW", "PUBLISHED");
  let updated: number;
  try {
    updated = await deps.store.approve(row.id, user.id, now, altText, provenance);
  } catch (error) {
    deps.log("media approval update failed", { mediaAssetId: row.id, error: errorName(error) });
    return fail("SERVER_ERROR");
  }
  let transitioned = updated === 1;
  let publishable = row;
  if (!transitioned) {
    // Someone else decided first. Only a concurrent approval may continue (to finish publishing).
    const current = await deps.store.findAsset(row.id);
    if (!current || current.status !== "PUBLISHED") return fail("NOT_REVIEWABLE");
    publishable = current;
    transitioned = false;
  }
  const error = await publishObjects(publishable, access, deps);
  if (error) return error;
  deps.log("media asset published", { mediaAssetId: row.id, reviewerId: user.id });
  return ok({ mediaAssetId: row.id, status: "PUBLISHED", provenance, transitioned });
}

export async function rejectReviewAsset(request: BodyRequest, deps: MediaReviewDependencies): Promise<ReviewResult> {
  const loaded = await loadAsset(request, deps);
  if ("error" in loaded) return loaded.error;
  const parsed = await readJson(request);
  if ("error" in parsed) return parsed.error;
  const input = rejectBodySchema.safeParse(parsed.body);
  if (!input.success) return fail("INVALID_REQUEST");
  const { user, row } = loaded;
  if (row.status === "REJECTED") return ok({ mediaAssetId: row.id, status: "REJECTED", transitioned: false });
  if (row.status !== "PENDING_REVIEW") return fail("NOT_REVIEWABLE");

  assertTransition("REVIEW", "PENDING_REVIEW", "REJECTED");
  let updated: number;
  try {
    updated = await deps.store.reject(row.id, user.id, deps.now(), input.data.reason);
  } catch (error) {
    deps.log("media rejection update failed", { mediaAssetId: row.id, error: errorName(error) });
    return fail("SERVER_ERROR");
  }
  if (updated === 1) return ok({ mediaAssetId: row.id, status: "REJECTED", transitioned: true });
  const current = await deps.store.findAsset(row.id);
  if (current?.status === "REJECTED") return ok({ mediaAssetId: row.id, status: "REJECTED", transitioned: false });
  return fail("NOT_REVIEWABLE");
}
