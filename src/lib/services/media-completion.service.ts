import {
  checkCompletableSource,
  COMPLETED_UPLOAD_STATUSES,
  NOT_COMPLETABLE_STATUSES,
  uploadCompletionDeadline,
  verifyIngestObject,
  type MediaAssetKind,
  type MediaAssetStatus,
  type MediaFailureCode,
  type MediaSubjectType,
} from "../../../shared/media-asset";
import { MEDIA_ID_PATTERN } from "../../../shared/media-contract";
import { assertTransition, buildProcessingJob, type ProcessingJob } from "../../../shared/media-processing";
import type { IngestObjectInspection, IngestObjectInspector } from "../media/ingest-storage";
import { uploadCompletionSchema } from "../validations/media";

/**
 * Upload completion (Phase 5B): the server independently verifies that the ingest
 * object is exactly what the upload intent authorised, then moves the asset from
 * UPLOADED to PROCESSING. The browser's word that an upload succeeded is never
 * trusted; the request body is `{}` and every value comes from the MediaAsset row.
 *
 * The committed PROCESSING row is the processing handoff. Only after that update
 * has committed is a processing job sent (best effort): a lost or unsent job is
 * re-sent by the sweeper, and the worker is idempotent, so the job can never run
 * ahead of the transition and never needs to be sent exactly once.
 *
 * Authorization (approved policy), always with the role re-read from the database:
 *   PROPERTY  ADMIN, or a caller who is BOTH the property's current owner AND the
 *             asset's uploader. Uploading alone grants nothing.
 *   PROJECT   ADMIN only.
 * A caller who may not complete an asset gets the same 404 as a missing asset.
 *
 * Every state change is one conditional update that also re-checks the verified
 * values and the authorization, so concurrent requests converge: exactly one
 * transitions, the rest answer from the row's current state.
 */

export type CompletionErrorCode =
  | "UNAUTHORIZED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BODY_TOO_LARGE"
  | "INVALID_BODY"
  | "NOT_FOUND"
  | "UPLOAD_NOT_FOUND"
  | "UPLOAD_EXPIRED"
  | "NOT_COMPLETABLE"
  | "UPLOAD_VERIFICATION_FAILED"
  | "VERIFICATION_UNAVAILABLE"
  | "SERVER_ERROR";

export type UploadCompletionResult = { readonly status: number; readonly body: Readonly<Record<string, unknown>> };

export interface CompletionUser {
  readonly id: string;
  readonly role: string;
}

/** The row fields completion reads. */
export interface CompletionMediaAsset {
  readonly id: string;
  readonly subjectType: MediaSubjectType;
  readonly propertyId: string | null;
  readonly projectSlug: string | null;
  readonly kind: MediaAssetKind;
  readonly status: MediaAssetStatus;
  readonly sourceKey: string;
  readonly sourceSizeBytes: number;
  readonly sourceMimeType: string;
  readonly sourceChecksumSha256: string | null;
  readonly uploadedById: string | null;
  readonly createdAt: Date;
}

/** Values S3 confirmed; the transition only applies if the row still holds exactly these. */
export interface VerifiedSource {
  readonly sourceKey: string;
  readonly sourceSizeBytes: number;
  readonly sourceMimeType: string;
  readonly sourceChecksumSha256: string;
}

/**
 * Authorization repeated inside every conditional update. For a non-admin the update
 * also requires uploadedById = userId and the property's current ownerId = userId,
 * so an ownership change between the check and the write matches no row.
 */
export type CompletionAuthorization = { readonly admin: true } | { readonly admin: false; readonly userId: string };

export interface UploadCompletionStore {
  findUser(id: string): Promise<CompletionUser | null>;
  findMediaAsset(id: string): Promise<CompletionMediaAsset | null>;
  findPropertyOwner(propertyId: string): Promise<{ readonly ownerId: string } | null>;
  /**
   * UPLOADED → PROCESSING when every predicate holds, recording processingStartedAt
   * and resetting the processing lease and attempts. Returns the number of rows updated (0 or 1).
   */
  transitionToProcessing(id: string, verified: VerifiedSource, authorization: CompletionAuthorization, startedAt: Date): Promise<number>;
  /** UPLOADED → FAILED for this exact sourceKey. Returns the number of rows updated (0 or 1). */
  markFailed(
    id: string,
    sourceKey: string,
    processingError: string,
    authorization: CompletionAuthorization,
    failureCode: Extract<MediaFailureCode, "UPLOAD_EXPIRED" | "UPLOAD_VERIFICATION_FAILED">,
  ): Promise<number>;
}

export interface UploadCompletionDependencies {
  readonly store: UploadCompletionStore;
  /** Null when MEDIA_REGION / MEDIA_INGEST_BUCKET are not configured. */
  readonly getInspector: () => IngestObjectInspector | null;
  readonly projectExists: (slug: string) => boolean;
  readonly now: () => Date;
  /** Server-side diagnostics. Never passed URLs, credentials, AWS messages or request bodies. */
  readonly log: (message: string, context: Readonly<Record<string, string | number | null>>) => void;
  /**
   * Sends the processing job, called only after UPLOADED → PROCESSING has committed.
   * Optional: without a queue the PROCESSING row waits for the sweeper's redispatch.
   */
  readonly dispatchProcessing?: (job: ProcessingJob) => Promise<void>;
  /** Random UUID v4 per dispatch. */
  readonly newJobId?: () => string;
}

export interface UploadCompletionRequest {
  /** From getAuthUser(req). Only the id is used; the token's role is never trusted. */
  readonly caller: { readonly id: string } | null;
  /** The raw {mediaAssetId} path segment. */
  readonly mediaAssetId: string;
  readonly contentType: string | null;
  readonly contentLength: number | null;
  readonly readBody: () => Promise<unknown>;
}

/** `{}` is two bytes; anything near this limit is not a completion request. */
export const UPLOAD_COMPLETION_MAX_BODY_BYTES = 1024;

/** Internal processingError values. Fixed strings: no AWS text, keys or URLs. */
export const COMPLETION_PROCESSING_ERRORS = {
  expired: "Upload not received before the completion deadline",
  mismatch: (what: string) => `Uploaded source failed verification: ${what}`,
} as const;

const MESSAGES: Record<CompletionErrorCode, string> = {
  UNAUTHORIZED: "Unauthorized",
  UNSUPPORTED_MEDIA_TYPE: "Content-Type must be application/json",
  BODY_TOO_LARGE: "Request body is too large",
  INVALID_BODY: "Request body must be an empty JSON object",
  NOT_FOUND: "Not found",
  UPLOAD_NOT_FOUND: "The upload has not been received yet.",
  UPLOAD_EXPIRED: "The upload was not received in time. Please upload the file again.",
  NOT_COMPLETABLE: "This upload can no longer be completed.",
  UPLOAD_VERIFICATION_FAILED: "The uploaded file could not be verified. Please upload it again.",
  VERIFICATION_UNAVAILABLE: "Upload verification is temporarily unavailable. Please try again.",
  SERVER_ERROR: "Server error",
};

const RETRYABLE: ReadonlySet<CompletionErrorCode> = new Set(["UPLOAD_NOT_FOUND", "VERIFICATION_UNAVAILABLE", "SERVER_ERROR"]);

const STATUS: Record<CompletionErrorCode, number> = {
  UNAUTHORIZED: 401,
  UNSUPPORTED_MEDIA_TYPE: 415,
  BODY_TOO_LARGE: 413,
  INVALID_BODY: 400,
  NOT_FOUND: 404,
  UPLOAD_NOT_FOUND: 409,
  UPLOAD_EXPIRED: 409,
  NOT_COMPLETABLE: 409,
  UPLOAD_VERIFICATION_FAILED: 422,
  VERIFICATION_UNAVAILABLE: 503,
  SERVER_ERROR: 500,
};

const fail = (code: CompletionErrorCode): UploadCompletionResult => ({
  status: STATUS[code],
  body: { success: false, error: MESSAGES[code], code, retryable: RETRYABLE.has(code) },
});

const completed = (mediaAssetId: string, status: MediaAssetStatus, transitioned: boolean): UploadCompletionResult => ({
  status: 200,
  body: { success: true, data: { mediaAssetId, status, transitioned } },
});

const errorName = (error: unknown) => (error instanceof Error ? error.name : "UnknownError");

/** The approved completion policy, in one place. Subject existence is checked by the caller. */
export function canCompleteUpload(
  user: CompletionUser,
  asset: Pick<CompletionMediaAsset, "subjectType" | "uploadedById">,
  propertyOwnerId: string | null,
): boolean {
  if (user.role === "ADMIN") return true;
  return asset.subjectType === "PROPERTY" && propertyOwnerId === user.id && asset.uploadedById === user.id;
}

export async function handleUploadCompletion(request: UploadCompletionRequest, deps: UploadCompletionDependencies): Promise<UploadCompletionResult> {
  // 1. Authentication, with a fresh database read.
  if (!request.caller) return fail("UNAUTHORIZED");
  const user = await deps.store.findUser(request.caller.id);
  if (!user) return fail("UNAUTHORIZED");

  // 2. Request shape: JSON (keeps the CORS preflight in front of cookie-authenticated POSTs), exactly {}.
  const mediaType = request.contentType?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") return fail("UNSUPPORTED_MEDIA_TYPE");
  if (request.contentLength !== null && request.contentLength > UPLOAD_COMPLETION_MAX_BODY_BYTES) return fail("BODY_TOO_LARGE");
  let body: unknown;
  try {
    body = await request.readBody();
  } catch {
    return fail("INVALID_BODY");
  }
  if (!uploadCompletionSchema.safeParse(body).success) return fail("INVALID_BODY");

  // 3. Load and authorize. Unknown, malformed and forbidden ids are indistinguishable.
  if (!MEDIA_ID_PATTERN.test(request.mediaAssetId)) return fail("NOT_FOUND");
  const authorization: CompletionAuthorization = user.role === "ADMIN" ? { admin: true } : { admin: false, userId: user.id };
  const asset = await loadAuthorizedAsset(request.mediaAssetId, user, deps);
  if (!asset) return fail("NOT_FOUND");

  // 4. Lifecycle: only UPLOADED is verified. Nothing else touches S3 or writes.
  if (asset.status !== "UPLOADED") return respondToSettledState(asset);

  // 5. The stored key must be a Phase 5A ingest key for this asset. Never repaired.
  const integrityProblem = checkCompletableSource(asset);
  if (integrityProblem || asset.sourceChecksumSha256 === null) {
    deps.log("media completion refused an inconsistent row", { mediaAssetId: asset.id, problem: integrityProblem ?? "sourceChecksumSha256 is missing" });
    return fail("NOT_COMPLETABLE");
  }
  const expected: VerifiedSource = {
    sourceKey: asset.sourceKey,
    sourceSizeBytes: asset.sourceSizeBytes,
    sourceMimeType: asset.sourceMimeType,
    sourceChecksumSha256: asset.sourceChecksumSha256,
  };

  // 6. Independent verification against S3.
  const inspector = deps.getInspector();
  if (!inspector) {
    deps.log("media upload verification is not configured", { mediaAssetId: asset.id });
    return fail("VERIFICATION_UNAVAILABLE");
  }
  let inspection: IngestObjectInspection;
  try {
    inspection = await inspector.inspect(expected.sourceKey);
  } catch (error) {
    inspection = { status: "UNAVAILABLE", reason: errorName(error) };
  }

  if (inspection.status === "UNAVAILABLE") {
    deps.log("media upload verification unavailable", { mediaAssetId: asset.id, reason: inspection.reason });
    return fail("VERIFICATION_UNAVAILABLE");
  }

  if (inspection.status === "NOT_FOUND") {
    if (deps.now().getTime() <= uploadCompletionDeadline(asset.createdAt).getTime()) return fail("UPLOAD_NOT_FOUND");
    return failAsset(asset, user, authorization, COMPLETION_PROCESSING_ERRORS.expired, "UPLOAD_EXPIRED", deps);
  }

  const verdict = verifyIngestObject(asset, inspection.head);
  if (!verdict.ok && verdict.outcome === "MISCONFIGURED") {
    // Bucket drift (e.g. encryption changed) is not the uploader's fault; never fail the asset for it.
    deps.log("media ingest bucket configuration drift", { mediaAssetId: asset.id, problem: verdict.problem });
    return fail("VERIFICATION_UNAVAILABLE");
  }
  if (!verdict.ok) {
    deps.log("media upload failed verification", { mediaAssetId: asset.id, mismatch: verdict.mismatch });
    return failAsset(asset, user, authorization, COMPLETION_PROCESSING_ERRORS.mismatch(verdict.mismatch), "UPLOAD_VERIFICATION_FAILED", deps);
  }

  // 7. Conditional transition: only one request can move the row, and only if nothing changed.
  assertTransition("UPLOAD_COMPLETION", "UPLOADED", "PROCESSING");
  const startedAt = deps.now();
  let updated: number;
  try {
    updated = await deps.store.transitionToProcessing(asset.id, expected, authorization, startedAt);
  } catch (error) {
    // The commit outcome is unknown; a retry converges (PROCESSING → 200, or verified again).
    deps.log("media completion transition failed", { mediaAssetId: asset.id, error: errorName(error) });
    return fail("SERVER_ERROR");
  }
  if (updated === 1) {
    await dispatchAfterCommit(asset, deps);
    return completed(asset.id, "PROCESSING", true);
  }
  return respondToCurrentState(asset.id, user, deps);
}

/** Post-commit, best effort. A failure is logged and left to the sweeper; the completion itself succeeded. */
async function dispatchAfterCommit(asset: CompletionMediaAsset, deps: UploadCompletionDependencies): Promise<void> {
  if (!deps.dispatchProcessing || !deps.newJobId) return;
  try {
    const job = buildProcessingJob(asset, deps.newJobId(), deps.now());
    await deps.dispatchProcessing(job);
    deps.log("media processing job dispatched", { mediaAssetId: asset.id, jobId: job.jobId });
  } catch (error) {
    deps.log("media processing dispatch failed; the sweeper will re-send it", { mediaAssetId: asset.id, error: errorName(error) });
  }
}

/** The asset if it exists, its subject still exists, and the caller may complete it. */
async function loadAuthorizedAsset(id: string, user: CompletionUser, deps: UploadCompletionDependencies): Promise<CompletionMediaAsset | null> {
  const asset = await deps.store.findMediaAsset(id);
  if (!asset) return null;
  if (asset.subjectType === "PROPERTY") {
    const property = asset.propertyId ? await deps.store.findPropertyOwner(asset.propertyId) : null;
    if (!property) return null;
    return canCompleteUpload(user, asset, property.ownerId) ? asset : null;
  }
  if (!asset.projectSlug || !deps.projectExists(asset.projectSlug)) return null;
  return canCompleteUpload(user, asset, null) ? asset : null;
}

/** Answers for a row that is not UPLOADED. No S3 call and no write, so retries are free. */
function respondToSettledState(asset: CompletionMediaAsset): UploadCompletionResult {
  if (COMPLETED_UPLOAD_STATUSES.includes(asset.status)) return completed(asset.id, asset.status, false);
  if (NOT_COMPLETABLE_STATUSES.includes(asset.status)) return fail("NOT_COMPLETABLE");
  return fail("VERIFICATION_UNAVAILABLE");
}

async function failAsset(
  asset: CompletionMediaAsset,
  user: CompletionUser,
  authorization: CompletionAuthorization,
  processingError: string,
  code: "UPLOAD_EXPIRED" | "UPLOAD_VERIFICATION_FAILED",
  deps: UploadCompletionDependencies,
): Promise<UploadCompletionResult> {
  assertTransition("UPLOAD_COMPLETION", "UPLOADED", "FAILED");
  let updated: number;
  try {
    updated = await deps.store.markFailed(asset.id, asset.sourceKey, processingError, authorization, code);
  } catch (error) {
    deps.log("media completion could not mark the asset FAILED", { mediaAssetId: asset.id, error: errorName(error) });
    return fail("SERVER_ERROR");
  }
  if (updated === 1) return fail(code);
  return respondToCurrentState(asset.id, user, deps);
}

/** A conditional update matched nothing: another request won, or the row changed. Answer from what is there now. */
async function respondToCurrentState(id: string, user: CompletionUser, deps: UploadCompletionDependencies): Promise<UploadCompletionResult> {
  let current: CompletionMediaAsset | null;
  try {
    current = await loadAuthorizedAsset(id, user, deps);
  } catch (error) {
    deps.log("media completion could not re-read the asset", { mediaAssetId: id, error: errorName(error) });
    return fail("SERVER_ERROR");
  }
  if (!current) return fail("NOT_FOUND");
  if (current.status === "UPLOADED") {
    // Still UPLOADED yet the guarded update matched nothing: the row or its authorization moved underneath us.
    deps.log("media completion conditional update matched no row", { mediaAssetId: id });
    return fail("VERIFICATION_UNAVAILABLE");
  }
  return respondToSettledState(current);
}
