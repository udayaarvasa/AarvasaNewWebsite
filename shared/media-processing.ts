/**
 * Processing contract (Phase 5C): the job handed from upload completion to the
 * processing worker, the MediaAsset lifecycle state machine, failure codes, and
 * the timing policy shared by the application, the worker, the sweeper and the
 * CDK queue definition.
 *
 * Dependency-free like media-asset.ts and media-contract.ts. Types only for the
 * data-store ports; implementations live with their runtimes.
 *
 *   UPLOADED ──complete──► PROCESSING ──worker──► PENDING_REVIEW ──review (later)──► PUBLISHED
 *      │                       │                        └──review (later)──► REJECTED
 *      └──expired──► FAILED ◄──┘ (validation, integrity, timeout, retries exhausted)
 *
 * Processing success never publishes: the worker stops at PENDING_REVIEW.
 */
import {
  INGEST_SOURCE_KEY_PATTERN,
  MEDIA_FAILURE_CODES,
  SHA256_BASE64_PATTERN,
  UPLOAD_COMPLETION_GRACE_SECONDS,
  UPLOAD_INTENT_TTL_SECONDS,
  type MediaAssetFormat,
  type MediaAssetKind,
  type MediaAssetStatus,
  type MediaFailureCode,
  type MediaSubjectType,
} from "./media-asset";

export { MEDIA_FAILURE_CODES, type MediaFailureCode };
import { MEDIA_ID_PATTERN } from "./media-contract";

// ── Versions ─────────────────────────────────────────────────────────────────

/**
 * The processing a job asks for: `${PIPELINE_VERSION}/${PROCESSING_PROFILE}` of the
 * media pipeline (infra/src/pipeline/process.ts; a test keeps them equal). A worker
 * only accepts jobs for the version it runs.
 */
export const PROCESSING_VERSION = "1.0.0/passthrough-v1";
export const PROCESSING_JOB_SCHEMA_VERSION = 1;

// ── Timing and retry policy ──────────────────────────────────────────────────

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * One source of truth for the processing timeline. Every value is checked against
 * the others and against the ingest lifecycle in infra/test/processing.
 *
 *   worker run   ≤ WORKER_TIMEOUT (5 min)
 *   < lease      = LEASE (10 min): no second worker may claim the asset meanwhile
 *   < visibility = QUEUE_VISIBILITY_TIMEOUT (30 min, 6 × the Lambda timeout as AWS recommends
 *                  for SQS event sources): SQS redelivers only after the lease lapsed
 *   attempts     ≤ MAX_ATTEMPTS (3), counted in the database, whatever SQS does
 *   redelivery   ≤ QUEUE_MAX_RECEIVE_COUNT (5) receives, then the dead-letter queue
 *   timeout      PROCESSING longer than PROCESSING_TIMEOUT (6 h) → FAILED by the sweeper
 *   ingest       objects expire 7 days after upload (bucket lifecycle), far beyond all of the above
 */
export const PROCESSING_POLICY = {
  workerTimeoutSeconds: 5 * MINUTE,
  leaseSeconds: 10 * MINUTE,
  queueVisibilityTimeoutSeconds: 30 * MINUTE,
  maxAttempts: 3,
  queueMaxReceiveCount: 5,
  queueRetentionSeconds: 4 * DAY,
  deadLetterRetentionSeconds: 14 * DAY,
  /** Re-send a job for an unclaimed PROCESSING asset after this long (lost or never-sent message). */
  redispatchAfterSeconds: 30 * MINUTE,
  processingTimeoutSeconds: 6 * HOUR,
  /** An UPLOADED asset whose object exists but was never completed is abandoned after this. */
  uploadAbandonedAfterSeconds: 24 * HOUR,
  /** Ingest bucket lifecycle (infra config ingest.expireAfterDays). The ultimate source retention bound. */
  ingestRetentionDays: 7,
} as const;

/** Past this, a missing upload can no longer arrive (same deadline as upload completion). */
export const uploadMissingCutoff = (now: Date): Date =>
  new Date(now.getTime() - (UPLOAD_INTENT_TTL_SECONDS + UPLOAD_COMPLETION_GRACE_SECONDS) * 1000);
export const uploadAbandonedCutoff = (now: Date): Date => new Date(now.getTime() - PROCESSING_POLICY.uploadAbandonedAfterSeconds * 1000);
export const processingTimeoutCutoff = (now: Date): Date => new Date(now.getTime() - PROCESSING_POLICY.processingTimeoutSeconds * 1000);
export const redispatchCutoff = (now: Date): Date => new Date(now.getTime() - PROCESSING_POLICY.redispatchAfterSeconds * 1000);

// ── Lifecycle state machine ──────────────────────────────────────────────────

/** Every allowed status change. There is no VERIFIED state: PROCESSING already means "verified". */
export const MEDIA_ASSET_TRANSITIONS: Readonly<Record<MediaAssetStatus, readonly MediaAssetStatus[]>> = {
  UPLOADED: ["PROCESSING", "FAILED"],
  PROCESSING: ["PENDING_REVIEW", "FAILED"],
  PENDING_REVIEW: ["PUBLISHED", "REJECTED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"],
  REJECTED: ["ARCHIVED"],
  FAILED: ["ARCHIVED"],
  ARCHIVED: [],
};

export type LifecycleActor = "UPLOAD_INTENT" | "UPLOAD_COMPLETION" | "PROCESSING_WORKER" | "SWEEPER" | "REVIEW" | "ARCHIVAL";

/**
 * Which component may make which change. Review and archival belong to later
 * phases and have no implementation yet; they are listed so the table is complete.
 */
export const ACTOR_TRANSITIONS: Readonly<Record<LifecycleActor, ReadonlyArray<readonly [MediaAssetStatus, MediaAssetStatus]>>> = {
  UPLOAD_INTENT: [["UPLOADED", "FAILED"]],
  UPLOAD_COMPLETION: [["UPLOADED", "PROCESSING"], ["UPLOADED", "FAILED"]],
  PROCESSING_WORKER: [["PROCESSING", "PENDING_REVIEW"], ["PROCESSING", "FAILED"]],
  SWEEPER: [["UPLOADED", "FAILED"], ["PROCESSING", "FAILED"]],
  REVIEW: [["PENDING_REVIEW", "PUBLISHED"], ["PENDING_REVIEW", "REJECTED"]],
  ARCHIVAL: [["PENDING_REVIEW", "ARCHIVED"], ["PUBLISHED", "ARCHIVED"], ["REJECTED", "ARCHIVED"], ["FAILED", "ARCHIVED"]],
};

export function canTransition(from: MediaAssetStatus, to: MediaAssetStatus): boolean {
  return MEDIA_ASSET_TRANSITIONS[from].includes(to);
}

/** Throws unless `actor` may move an asset from `from` to `to`. Every writer calls this before its conditional update. */
export function assertTransition(actor: LifecycleActor, from: MediaAssetStatus, to: MediaAssetStatus): void {
  const allowed = canTransition(from, to) && ACTOR_TRANSITIONS[actor].some(([f, t]) => f === from && t === to);
  if (!allowed) throw new Error(`Lifecycle violation: ${actor} may not move an asset from ${from} to ${to}`);
}

// ── Failure codes ────────────────────────────────────────────────────────────

// MEDIA_FAILURE_CODES (the MediaAsset.failureCode column contract) is defined in media-asset.ts.

export const isMediaFailureCode = (value: unknown): value is MediaFailureCode =>
  typeof value === "string" && (MEDIA_FAILURE_CODES as readonly string[]).includes(value);

const TRY_AGAIN = "We could not process this file. Please upload it again, or contact support if this keeps happening.";

/** The only failure text a user may see. Diagnostics (processingError) stay internal. */
export const PUBLIC_FAILURE_MESSAGES: Readonly<Record<MediaFailureCode, string>> = {
  UPLOAD_AUTHORIZATION_FAILED: "The upload could not be started. Please try again.",
  UPLOAD_EXPIRED: "The upload was not received in time. Please upload the file again.",
  UPLOAD_VERIFICATION_FAILED: "The uploaded file could not be verified. Please upload it again.",
  INVALID_SOURCE: TRY_AGAIN,
  SOURCE_MISSING: "The uploaded file is no longer available. Please upload it again.",
  SOURCE_INTEGRITY_FAILED: "The uploaded file could not be verified. Please upload it again.",
  UNSUPPORTED_CONTENT: "This file uses a format or feature that is not supported. Please export it again in a supported format.",
  VALIDATION_FAILED: "This file did not pass validation. Please check it and upload it again.",
  SIZE_LIMIT_EXCEEDED: "This file is larger than the allowed size for its type.",
  PROCESSING_TIMEOUT: TRY_AGAIN,
  RETRIES_EXHAUSTED: TRY_AGAIN,
  INTERNAL_ERROR: TRY_AGAIN,
};

export const publicFailureMessage = (code: string | null): string => (isMediaFailureCode(code) ? PUBLIC_FAILURE_MESSAGES[code] : TRY_AGAIN);

/** Internal diagnostics are bounded so a hostile file cannot bloat the row. */
export const PROCESSING_ERROR_MAX_LENGTH = 2000;
export const boundDiagnostic = (text: string): string =>
  text.length <= PROCESSING_ERROR_MAX_LENGTH ? text : `${text.slice(0, PROCESSING_ERROR_MAX_LENGTH - 1)}…`;

// ── Processing job ───────────────────────────────────────────────────────────

/**
 * The message on the processing queue. Identifiers only: the worker re-reads the
 * MediaAsset row and never takes owner, subject, status, MIME type, size, checksum
 * or any output key from the job. Only server code builds jobs (from a committed
 * PROCESSING row); there is no route through which a browser can send one.
 */
export interface ProcessingJob {
  readonly schemaVersion: typeof PROCESSING_JOB_SCHEMA_VERSION;
  /** Random per dispatch; correlates logs. Not an idempotency key. */
  readonly jobId: string;
  readonly mediaAssetId: string;
  /** Must equal the row's sourceKey when processed; a stale or forged job is ignored. */
  readonly sourceKey: string;
  readonly processingVersion: string;
  /** `${mediaAssetId}:${processingVersion}`: the same logical job however often it is delivered. */
  readonly idempotencyKey: string;
  readonly dispatchedAt: string;
}

/** SQS allows 256 KiB; a job is ~300 bytes, so anything large is not a job. */
export const PROCESSING_JOB_MAX_BYTES = 1024;
const JOB_FIELDS = ["schemaVersion", "jobId", "mediaAssetId", "sourceKey", "processingVersion", "idempotencyKey", "dispatchedAt"] as const;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const processingIdempotencyKey = (mediaAssetId: string, processingVersion: string = PROCESSING_VERSION): string =>
  `${mediaAssetId}:${processingVersion}`;

export type ProcessingJobParse = { readonly ok: true; readonly job: ProcessingJob } | { readonly ok: false; readonly reason: string };

/** Strict parse of a queue message body. Unknown fields are refused, not ignored. */
export function parseProcessingJob(body: unknown): ProcessingJobParse {
  const reject = (reason: string): ProcessingJobParse => ({ ok: false, reason });
  if (typeof body !== "string") return reject("body is not a string");
  if (body.length > PROCESSING_JOB_MAX_BYTES) return reject("body is too large");
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    return reject("body is not JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return reject("body is not an object");
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== [...JOB_FIELDS].sort().join(",")) return reject("unexpected or missing fields");
  const { schemaVersion, jobId, mediaAssetId, sourceKey, processingVersion, idempotencyKey, dispatchedAt } = record;
  if (schemaVersion !== PROCESSING_JOB_SCHEMA_VERSION) return reject("unsupported schemaVersion");
  if (typeof jobId !== "string" || !UUID_V4.test(jobId)) return reject("invalid jobId");
  if (typeof mediaAssetId !== "string" || !MEDIA_ID_PATTERN.test(mediaAssetId)) return reject("invalid mediaAssetId");
  if (typeof sourceKey !== "string" || !INGEST_SOURCE_KEY_PATTERN.test(sourceKey) || sourceKey.split("/")[1] !== mediaAssetId) {
    return reject("sourceKey is not this asset's ingest key");
  }
  if (processingVersion !== PROCESSING_VERSION) return reject("unsupported processingVersion");
  if (typeof idempotencyKey !== "string" || idempotencyKey !== processingIdempotencyKey(mediaAssetId, processingVersion)) {
    return reject("idempotencyKey does not match");
  }
  if (typeof dispatchedAt !== "string" || Number.isNaN(Date.parse(dispatchedAt)) || new Date(dispatchedAt).toISOString() !== dispatchedAt) {
    return reject("invalid dispatchedAt");
  }
  return { ok: true, job: { schemaVersion, jobId, mediaAssetId, sourceKey, processingVersion, idempotencyKey, dispatchedAt } };
}

/** Builds a job from a committed row's identifiers. Throws if they are not a valid job. */
export function buildProcessingJob(asset: { readonly id: string; readonly sourceKey: string }, jobId: string, now: Date): ProcessingJob {
  const job: ProcessingJob = {
    schemaVersion: PROCESSING_JOB_SCHEMA_VERSION,
    jobId,
    mediaAssetId: asset.id,
    sourceKey: asset.sourceKey,
    processingVersion: PROCESSING_VERSION,
    idempotencyKey: processingIdempotencyKey(asset.id),
    dispatchedAt: now.toISOString(),
  };
  const parsed = parseProcessingJob(serializeProcessingJob(job));
  if (!parsed.ok) throw new Error(`Refusing to build an invalid processing job: ${parsed.reason}`);
  return job;
}

/** Stable field order, so equal jobs serialize identically. */
export function serializeProcessingJob(job: ProcessingJob): string {
  return JSON.stringify(Object.fromEntries(JOB_FIELDS.map((field) => [field, job[field]])));
}

/** Producer port: implemented over SQS SendMessage in deployment (deferred), in memory in tests. */
export interface ProcessingJobQueue {
  send(job: ProcessingJob): Promise<void>;
}

// ── Data-store ports (implemented with Prisma in src/lib/services/media-processing.store.ts) ─

/** The row fields processing and sweeping read. All authoritative values come from here. */
export interface ProcessingAssetRow {
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
  readonly processingStartedAt: Date | null;
  readonly processingAttempts: number;
  readonly processingLeaseExpiresAt: Date | null;
  readonly altText: string | null;
  readonly createdAt: Date;
}

/** What a successful run writes, together with status PENDING_REVIEW. */
export interface ProcessedAssetData {
  readonly format: MediaAssetFormat;
  readonly storageKey: string;
  readonly entryFile: string;
  /** Lowercase hex SHA-256 of the entry file (the pipeline's contentHash). */
  readonly contentHash: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly fileCount: number;
  readonly posterKey: string | null;
  readonly dimensions: { readonly entry: { width: number; height: number } | null; readonly poster: { width: number; height: number } | null };
  readonly metrics: Readonly<Record<string, number | boolean | string | null>>;
  readonly processorVersion: string;
}

export interface MediaFailure {
  readonly code: MediaFailureCode;
  /** Internal only; bounded with boundDiagnostic. */
  readonly diagnostic: string;
}

/** Extra predicates a conditional FAILED update must still satisfy when it runs. */
export interface ProcessingFailureGuard {
  /** processingAttempts = attempt: only the worker holding this attempt's lease. */
  readonly attempt?: number;
  /** Lease absent or expired at `now`. */
  readonly leaseFreeAt?: Date;
  readonly startedBefore?: Date;
  readonly minAttempts?: number;
  readonly sourceKey?: string;
}

export interface ProcessingStore {
  findAsset(id: string): Promise<ProcessingAssetRow | null>;
  /**
   * Atomically takes the processing lease: PROCESSING, this sourceKey, lease free at
   * `now`, attempts < maxAttempts → attempts + 1 and a new lease. Returns the new
   * attempt number, or null when nothing was claimed.
   */
  claim(id: string, sourceKey: string, now: Date, leaseExpiresAt: Date, maxAttempts: number): Promise<number | null>;
  /** Drops this attempt's lease so a redelivery can claim at once. Returns rows updated. */
  release(id: string, attempt: number): Promise<number>;
  /** PROCESSING (this attempt, this source) → PENDING_REVIEW with the processed fields. Returns rows updated. */
  completeProcessing(
    id: string,
    attempt: number,
    expected: { readonly sourceKey: string; readonly sourceChecksumSha256: string },
    data: ProcessedAssetData,
  ): Promise<number>;
  /** PROCESSING → FAILED if every guard still holds. Returns rows updated. */
  failProcessing(id: string, guard: ProcessingFailureGuard, failure: MediaFailure): Promise<number>;
  /** UPLOADED → FAILED if still UPLOADED and created before `createdBefore`. Returns rows updated. */
  failUpload(id: string, createdBefore: Date, failure: MediaFailure): Promise<number>;
  /** UPLOADED rows created before `createdBefore`, oldest first. */
  listUploadedBefore(createdBefore: Date, limit: number): Promise<ProcessingAssetRow[]>;
  /** PROCESSING rows, oldest processing start first. */
  listProcessing(limit: number): Promise<ProcessingAssetRow[]>;
}

export const isCanonicalChecksum = (value: string | null): value is string => value !== null && SHA256_BASE64_PATTERN.test(value);
