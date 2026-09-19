import { randomBytes } from "node:crypto";
import {
  buildIngestSourceKey,
  checkUploadSource,
  UPLOAD_INTENT_QUOTA,
  UPLOAD_INTENT_TTL_SECONDS,
  validateMediaAssetRecord,
  type MediaAssetKind,
  type MediaSubjectType,
} from "../../../shared/media-asset";
import { assertTransition } from "../../../shared/media-processing";
import type { SignedUpload, UploadSigner } from "../media/ingest-storage";
import { uploadIntentSchema } from "../validations/media";

/**
 * Upload intents (Phase 5A): authorise one direct browser upload of an immersive
 * media source to the ingest bucket, and record it as a MediaAsset.
 *
 * The row is created with status UPLOADED, which here means: an upload was
 * authorised and the row exists, but the source bytes have NOT been verified or
 * processed and may never arrive. It must not be treated as processed, published
 * or viewer-ready. Upload completion (media-completion.service.ts) verifies the
 * ingest object against this row before it may become PROCESSING.
 *
 * Authorization (approved policy):
 *   PROPERTY  owner (Property.ownerId) or ADMIN, as in property.service.ts updateProperty
 *   PROJECT   ADMIN only, published or not. BUILDER and AGENT are self-assignable
 *             roles, and projects have no owner, so neither grants anything.
 *
 * Everything security-sensitive is derived here, never taken from the client:
 * the caller's current role (re-read from the database), media and upload ids, the
 * object key, the signed Content-Type, uploadedById and status. The client must
 * declare the file's SHA-256, which is signed so S3 accepts only those bytes, and
 * stored (sourceChecksumSha256) so completion can compare it with what S3 holds.
 *
 * The data store, signer and project lookup are injected so this module has no
 * Prisma, Next.js or AWS side effects of its own and can be tested directly.
 */

export type UploadIntentResult = { readonly status: number; readonly body: Readonly<Record<string, unknown>> };

export interface UploadIntentUser {
  readonly id: string;
  readonly role: string;
}

/** Everything the service writes on creation; all processed and review fields stay NULL. */
export interface UploadedMediaAssetData {
  readonly id: string;
  readonly subjectType: MediaSubjectType;
  readonly propertyId: string | null;
  readonly projectSlug: string | null;
  readonly kind: MediaAssetKind;
  readonly status: "UPLOADED";
  readonly sourceKey: string;
  readonly sourceSizeBytes: number;
  readonly sourceMimeType: string;
  /** The declared SHA-256, canonical base64, exactly as signed into the PUT. */
  readonly sourceChecksumSha256: string;
  readonly uploadedById: string;
  readonly title: string | null;
  readonly altText: string | null;
}

export interface UploadIntentStore {
  findUser(id: string): Promise<UploadIntentUser | null>;
  findProperty(id: string): Promise<{ readonly id: string; readonly ownerId: string } | null>;
  /** Intents this uploader created since `since`, in ANY status (completion does not free a slot). */
  countRecentUploadIntents(uploadedById: string, since: Date): Promise<number>;
  createUploadedMediaAsset(data: UploadedMediaAssetData): Promise<void>;
  /** Marks a still-UPLOADED row FAILED (failureCode UPLOAD_AUTHORIZATION_FAILED). Used only when no upload authorization was issued. */
  markUploadIntentFailed(id: string, processingError: string): Promise<void>;
}

export interface UploadIntentDependencies {
  readonly store: UploadIntentStore;
  /** Null when MEDIA_REGION / MEDIA_INGEST_BUCKET are not configured. */
  readonly getSigner: () => UploadSigner | null;
  readonly findProject: (slug: string) => { readonly slug: string; readonly published: boolean } | null;
  readonly now: () => Date;
  /** 32 lowercase hex characters: a media id and an upload id each. */
  readonly randomId: () => string;
  /** Server-side diagnostics. Never passed URLs, headers, credentials or request bodies. */
  readonly log: (message: string, context: Readonly<Record<string, string | number | null>>) => void;
}

export interface UploadIntentRequest {
  /** From getAuthUser(req). Only the id is used; the token's role is never trusted. */
  readonly caller: { readonly id: string } | null;
  readonly contentType: string | null;
  /** The Content-Length header, when present. */
  readonly contentLength: number | null;
  readonly readBody: () => Promise<unknown>;
}

/** Generic message for every failure after authorization; details stay in server logs. */
export const UPLOAD_INTENT_FAILURE_MESSAGE = "Could not authorise this upload. Please try again.";
const FAILED_INTENT_PROCESSING_ERROR = "Upload authorization could not be created";
/** An intent is a few hundred bytes of JSON; the file itself never passes through the app. */
export const UPLOAD_INTENT_MAX_BODY_BYTES = 16_000;

export const randomUploadIdentifier = (): string => randomBytes(16).toString("hex");

const fail = (status: number, error: unknown): UploadIntentResult => ({ status, body: { success: false, error } });

/** The approved policy, in one place. */
export function canCreateMediaFor(
  user: UploadIntentUser,
  subject: { readonly type: "PROPERTY"; readonly ownerId: string } | { readonly type: "PROJECT" },
): boolean {
  if (user.role === "ADMIN") return true;
  return subject.type === "PROPERTY" && subject.ownerId === user.id;
}

const errorName = (error: unknown) => (error instanceof Error ? error.name : "UnknownError");

export async function handleUploadIntent(request: UploadIntentRequest, deps: UploadIntentDependencies): Promise<UploadIntentResult> {
  // 1. Authentication, with a fresh database read: a deleted account or changed role takes effect now.
  if (!request.caller) return fail(401, "Unauthorized");
  const user = await deps.store.findUser(request.caller.id);
  if (!user) return fail(401, "Unauthorized");

  // 2. Request shape.
  const mediaType = request.contentType?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") return fail(415, "Content-Type must be application/json");
  if (request.contentLength !== null && request.contentLength > UPLOAD_INTENT_MAX_BODY_BYTES) return fail(413, "Request body is too large");
  let body: unknown;
  try {
    body = await request.readBody();
  } catch {
    return fail(400, "Request body must be valid JSON");
  }
  const parsed = uploadIntentSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })));
  }
  const input = parsed.data;

  // 3. What the file claims to be.
  const source = checkUploadSource(input);
  if (!source.ok) return fail(source.status, source.error);

  // 4. Subject existence, then authorization.
  if (input.subjectType === "PROPERTY") {
    const property = await deps.store.findProperty(input.propertyId);
    if (!property) return fail(404, "Property not found");
    if (!canCreateMediaFor(user, { type: "PROPERTY", ownerId: property.ownerId })) return fail(403, "Forbidden");
  } else {
    if (!deps.findProject(input.projectSlug)) return fail(404, "Project not found");
    if (!canCreateMediaFor(user, { type: "PROJECT" })) return fail(403, "Forbidden");
  }

  // 5. Intent quota (database-backed, per uploader, every status counts).
  const now = deps.now();
  const since = new Date(now.getTime() - UPLOAD_INTENT_QUOTA.windowSeconds * 1000);
  if ((await deps.store.countRecentUploadIntents(user.id, since)) >= UPLOAD_INTENT_QUOTA.maxRecent) {
    return fail(429, "Too many pending uploads. Please try again later.");
  }

  // 6. Signing must be possible before anything is written (fail closed).
  const signer = deps.getSigner();
  if (!signer) {
    deps.log("media upload intents are not configured", { userId: user.id });
    return fail(503, "Media uploads are not available");
  }
  try {
    await signer.prepare();
  } catch (error) {
    deps.log("media upload signer unavailable", { userId: user.id, error: errorName(error) });
    return fail(503, "Media uploads are not available");
  }

  // 7. Server-generated identity and key. The client filename never reaches the key.
  const mediaAssetId = deps.randomId();
  const uploadId = deps.randomId();
  let objectKey: string;
  try {
    objectKey = buildIngestSourceKey(mediaAssetId, uploadId, input.expectedFormat);
  } catch (error) {
    deps.log("media upload identifiers rejected", { userId: user.id, error: errorName(error) });
    return fail(500, UPLOAD_INTENT_FAILURE_MESSAGE);
  }

  const data: UploadedMediaAssetData = {
    id: mediaAssetId,
    subjectType: input.subjectType,
    propertyId: input.subjectType === "PROPERTY" ? input.propertyId : null,
    projectSlug: input.subjectType === "PROJECT" ? input.projectSlug : null,
    kind: input.kind,
    status: "UPLOADED",
    sourceKey: objectKey,
    sourceSizeBytes: input.sourceSizeBytes,
    sourceMimeType: source.contentType,
    sourceChecksumSha256: input.sha256,
    uploadedById: user.id,
    title: input.title ?? null,
    altText: input.altText ?? null,
  };
  const problems = validateMediaAssetRecord({
    ...data,
    format: null,
    storageKey: null,
    entryFile: null,
    contentHash: null,
    mimeType: null,
    sizeBytes: null,
    fileCount: null,
    posterKey: null,
    reviewedAt: null,
    publishedAt: null,
    rejectionReason: null,
    processingError: null,
  });
  if (problems.length > 0) {
    deps.log("media upload record failed contract validation", { userId: user.id, problems: problems.join("; ") });
    return fail(500, UPLOAD_INTENT_FAILURE_MESSAGE);
  }

  // 8. Row first, then the signature (A authorise → B create → C sign).
  try {
    await deps.store.createUploadedMediaAsset(data);
  } catch (error) {
    deps.log("media upload row could not be created", { userId: user.id, error: errorName(error) });
    return fail(500, UPLOAD_INTENT_FAILURE_MESSAGE);
  }

  const expiresAt = new Date(now.getTime() + UPLOAD_INTENT_TTL_SECONDS * 1000);
  let upload: SignedUpload;
  try {
    upload = await signer.sign({
      key: objectKey,
      contentType: source.contentType,
      contentLength: input.sourceSizeBytes,
      sha256: data.sourceChecksumSha256,
      expiresInSeconds: UPLOAD_INTENT_TTL_SECONDS,
    });
  } catch (error) {
    // Nothing was returned to the client, so the row must not look like a valid intent.
    deps.log("media upload could not be signed", { mediaAssetId, userId: user.id, error: errorName(error) });
    try {
      assertTransition("UPLOAD_INTENT", "UPLOADED", "FAILED");
      await deps.store.markUploadIntentFailed(mediaAssetId, FAILED_INTENT_PROCESSING_ERROR);
    } catch (cleanupError) {
      deps.log("media upload row could not be marked FAILED", { mediaAssetId, error: errorName(cleanupError) });
    }
    return fail(502, UPLOAD_INTENT_FAILURE_MESSAGE);
  }

  return {
    status: 201,
    body: {
      success: true,
      data: {
        mediaAssetId,
        uploadId,
        objectKey,
        status: "UPLOADED",
        upload: {
          method: upload.method,
          url: upload.url,
          headers: upload.headers,
          /** The request body must be exactly this many bytes; the length is signed. */
          contentLength: input.sourceSizeBytes,
          expiresAt: expiresAt.toISOString(),
        },
      },
    },
  };
}
