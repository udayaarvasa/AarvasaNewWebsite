import { createHash } from "node:crypto";
import {
  checkCompletableSource,
  MEDIA_FORMAT_SPECS,
  validateMediaAssetRecord,
  verifyIngestObject,
  type MediaAssetFormat,
} from "../../../shared/media-asset";
import {
  assertTransition,
  boundDiagnostic,
  isCanonicalChecksum,
  parseProcessingJob,
  PROCESSING_POLICY,
  PROCESSING_VERSION,
  type MediaFailure,
  type MediaFailureCode,
  type ProcessedAssetData,
  type ProcessingAssetRow,
  type ProcessingJob,
  type ProcessingStore,
} from "../../../shared/media-processing";
import type { ObjectPublisher, PosterGenerator } from "../pipeline/adapters";
import { sha256Hex } from "../pipeline/formats";
import { REVIEW_CACHE_CONTROL, reviewKeyFor } from "../../../shared/media-contract";
import { UsageError } from "../pipeline/process";
import { ImmutableObjectConflictError } from "./errors";
import { classifyValidationFailure } from "./failure-classification";
import { runPipelineOnSource } from "./pipeline-runner";
import type { LogFields, ProcessingLogger, SourceReader } from "./ports";

/**
 * The processing worker (Phase 5C). One call handles one queue message:
 *
 *   parse job → re-read MediaAsset → PROCESSING? same source? → claim lease (attempt n)
 *   → read + re-verify the private source (size, SHA-256, headers)
 *   → Phase 2B-2 pipeline (validation, deterministic keys, posters)
 *   → write-once copies under the private review/ prefix → PROCESSING → PENDING_REVIEW
 *
 * Nothing the worker writes is CDN-reachable: storageKey/posterKey record the m/
 * keys an admin approval will publish to (the same path under review/ holds the
 * files until then). The worker never publishes and never writes m/.
 *
 * Nothing from the job is trusted except which asset and which source it names;
 * both must match the database. Every state change is one conditional update
 * guarded by status and the claimed attempt, so duplicate or concurrent deliveries,
 * crashes and a racing sweeper all converge on a single outcome. Keys are
 * content-addressed and written with If-None-Match, so a rerun can never overwrite.
 */

export interface WorkerDependencies {
  readonly store: ProcessingStore;
  readonly reader: SourceReader;
  readonly publisher: ObjectPublisher;
  /** Panorama posters; null disables generation (then only a warning, never a failure). */
  readonly posterGenerator: PosterGenerator | null;
  readonly now: () => Date;
  readonly log: ProcessingLogger;
  /** Milliseconds for durations; defaults to performance-independent Date.now. */
  readonly clock?: () => number;
}

/** Delivery metadata from the queue (SQS ApproximateReceiveCount), for logs. */
export interface JobDelivery {
  readonly messageId: string | null;
  readonly receiveCount: number;
}

export type WorkerOutcome =
  | { readonly result: "COMPLETED"; readonly mediaAssetId: string; readonly storageKey: string }
  | { readonly result: "FAILED"; readonly mediaAssetId: string; readonly code: MediaFailureCode }
  /** Nothing to do: already processed, not processable, stale or unknown. The message is acknowledged. */
  | { readonly result: "SKIPPED"; readonly mediaAssetId: string | null; readonly reason: string }
  /** Transient: the message stays on the queue and is redelivered after the visibility timeout. */
  | { readonly result: "RETRY"; readonly mediaAssetId: string; readonly reason: string }
  /** Not a valid job: never acknowledged, so SQS moves it to the dead-letter queue. */
  | { readonly result: "REJECTED"; readonly reason: string };

/** Whether the queue message should be deleted. */
export const acknowledges = (outcome: WorkerOutcome): boolean =>
  outcome.result === "COMPLETED" || outcome.result === "FAILED" || outcome.result === "SKIPPED";

type ClaimedResult =
  | { readonly kind: "processed"; readonly data: ProcessedAssetData }
  | { readonly kind: "failed"; readonly failure: MediaFailure; readonly rules?: readonly string[] }
  | { readonly kind: "retry"; readonly reason: string };

const errorName = (error: unknown) => (error instanceof Error ? error.name : "UnknownError");
const warningRules = (validation: readonly { readonly rule: string; readonly level: string }[]): Record<string, string> => {
  const rules = [...new Set(validation.filter((f) => f.level === "warn").map((f) => f.rule))];
  return rules.length > 0 ? { "validation.warnings": rules.join(",") } : {};
};
const base64ToHex = (b64: string) => Buffer.from(b64, "base64").toString("hex");

export async function processJob(body: unknown, delivery: JobDelivery, deps: WorkerDependencies): Promise<WorkerOutcome> {
  const clock = deps.clock ?? Date.now;
  const startedMs = clock();
  const parsed = parseProcessingJob(body);
  if (!parsed.ok) {
    const outcome: WorkerOutcome = { result: "REJECTED", reason: parsed.reason };
    deps.log("media.processing.job", { result: outcome.result, errorCategory: "INVALID_JOB", reason: parsed.reason, messageId: delivery.messageId, receiveCount: delivery.receiveCount });
    return outcome;
  }
  const job = parsed.job;
  let attempt: number | null = null;
  let rules: readonly string[] = [];
  const finish = (outcome: WorkerOutcome, extra: LogFields = {}): WorkerOutcome => {
    deps.log("media.processing.job", {
      mediaAssetId: job.mediaAssetId,
      jobId: job.jobId,
      messageId: delivery.messageId,
      receiveCount: delivery.receiveCount,
      attempt,
      processingVersion: job.processingVersion,
      durationMs: Math.max(0, clock() - startedMs),
      result: outcome.result,
      status: outcome.result === "COMPLETED" ? "PENDING_REVIEW" : outcome.result === "FAILED" ? "FAILED" : null,
      errorCategory: outcome.result === "FAILED" ? outcome.code : outcome.result === "RETRY" || outcome.result === "SKIPPED" ? outcome.reason : null,
      rules,
      ...extra,
    });
    return outcome;
  };

  // 1. The database is the only authority. The job only names an asset and its source.
  let row: ProcessingAssetRow | null;
  try {
    row = await deps.store.findAsset(job.mediaAssetId);
  } catch (error) {
    return finish({ result: "RETRY", mediaAssetId: job.mediaAssetId, reason: `database unavailable (${errorName(error)})` });
  }
  const gate = gateRow(row, job);
  if (gate) return finish(gate);

  // 2. Claim: exactly one worker holds the asset per lease; the attempt number is the lease token.
  const now = deps.now();
  const leaseExpiresAt = new Date(now.getTime() + PROCESSING_POLICY.leaseSeconds * 1000);
  try {
    attempt = await deps.store.claim(job.mediaAssetId, job.sourceKey, now, leaseExpiresAt, PROCESSING_POLICY.maxAttempts);
  } catch (error) {
    return finish({ result: "RETRY", mediaAssetId: job.mediaAssetId, reason: `claim failed (${errorName(error)})` });
  }
  if (attempt === null) return finish(await handleUnclaimed(job, now, deps));
  const claimedAttempt = attempt;

  // 3. Process under the lease. Unexpected errors are temporary worker failures.
  let result: ClaimedResult;
  try {
    result = await processClaimed(row!, deps);
  } catch (error) {
    result = { kind: "retry", reason: `worker error (${errorName(error)})` };
  }
  if (result.kind === "failed") rules = result.rules ?? [];

  // 4. Record the outcome with one guarded update.
  if (result.kind === "retry") {
    if (claimedAttempt >= PROCESSING_POLICY.maxAttempts) {
      return finish(await failClaimed(job.mediaAssetId, claimedAttempt, { code: "RETRIES_EXHAUSTED", diagnostic: boundDiagnostic(`RETRIES_EXHAUSTED: last error: ${result.reason}`) }, deps));
    }
    try {
      await deps.store.release(job.mediaAssetId, claimedAttempt);
    } catch {
      // The lease simply expires; the redelivery claims it then.
    }
    return finish({ result: "RETRY", mediaAssetId: job.mediaAssetId, reason: result.reason });
  }
  if (result.kind === "failed") return finish(await failClaimed(job.mediaAssetId, claimedAttempt, result.failure, deps));

  assertTransition("PROCESSING_WORKER", "PROCESSING", "PENDING_REVIEW");
  let updated: number;
  try {
    updated = await deps.store.completeProcessing(
      job.mediaAssetId,
      claimedAttempt,
      { sourceKey: row!.sourceKey, sourceChecksumSha256: row!.sourceChecksumSha256! },
      result.data,
    );
  } catch (error) {
    // Outputs are write-once and deterministic: the redelivery republishes nothing new and records this result.
    return finish({ result: "RETRY", mediaAssetId: job.mediaAssetId, reason: `database update failed (${errorName(error)})` });
  }
  if (updated === 1) return finish({ result: "COMPLETED", mediaAssetId: job.mediaAssetId, storageKey: result.data.storageKey });
  return finish({ result: "SKIPPED", mediaAssetId: job.mediaAssetId, reason: "asset changed while processing (lease lost)" });
}

/** Statuses and sources that mean "nothing to do". PENDING_REVIEW and later are never touched again. */
function gateRow(row: ProcessingAssetRow | null, job: ProcessingJob): WorkerOutcome | null {
  if (!row) return { result: "SKIPPED", mediaAssetId: job.mediaAssetId, reason: "asset not found" };
  if (row.status !== "PROCESSING") return { result: "SKIPPED", mediaAssetId: job.mediaAssetId, reason: `status is ${row.status}` };
  if (row.sourceKey !== job.sourceKey) return { result: "SKIPPED", mediaAssetId: job.mediaAssetId, reason: "job names a different source (stale or forged)" };
  return null;
}

/** The claim matched nothing: another worker holds it, the asset moved on, or attempts are used up. */
async function handleUnclaimed(job: ProcessingJob, now: Date, deps: WorkerDependencies): Promise<WorkerOutcome> {
  let row: ProcessingAssetRow | null;
  try {
    row = await deps.store.findAsset(job.mediaAssetId);
  } catch (error) {
    return { result: "RETRY", mediaAssetId: job.mediaAssetId, reason: `database unavailable (${errorName(error)})` };
  }
  const gate = gateRow(row, job);
  if (gate) return gate;
  const current = row!;
  const leaseActive = current.processingLeaseExpiresAt !== null && current.processingLeaseExpiresAt.getTime() >= now.getTime();
  if (leaseActive) return { result: "RETRY", mediaAssetId: job.mediaAssetId, reason: "leased by another worker" };
  if (current.processingAttempts >= PROCESSING_POLICY.maxAttempts) {
    assertTransition("PROCESSING_WORKER", "PROCESSING", "FAILED");
    const updated = await deps.store.failProcessing(
      job.mediaAssetId,
      { leaseFreeAt: now, minAttempts: PROCESSING_POLICY.maxAttempts, sourceKey: job.sourceKey },
      { code: "RETRIES_EXHAUSTED", diagnostic: `RETRIES_EXHAUSTED: ${current.processingAttempts} attempts used` },
    );
    return updated === 1
      ? { result: "FAILED", mediaAssetId: job.mediaAssetId, code: "RETRIES_EXHAUSTED" }
      : { result: "SKIPPED", mediaAssetId: job.mediaAssetId, reason: "asset changed before it could be failed" };
  }
  return { result: "RETRY", mediaAssetId: job.mediaAssetId, reason: "claim raced with another delivery" };
}

async function failClaimed(id: string, attempt: number, failure: MediaFailure, deps: WorkerDependencies): Promise<WorkerOutcome> {
  assertTransition("PROCESSING_WORKER", "PROCESSING", "FAILED");
  let updated: number;
  try {
    updated = await deps.store.failProcessing(id, { attempt }, { code: failure.code, diagnostic: boundDiagnostic(failure.diagnostic) });
  } catch (error) {
    return { result: "RETRY", mediaAssetId: id, reason: `database update failed (${errorName(error)})` };
  }
  return updated === 1
    ? { result: "FAILED", mediaAssetId: id, code: failure.code }
    : { result: "SKIPPED", mediaAssetId: id, reason: "asset changed while processing (lease lost)" };
}

const permanent = (code: MediaFailureCode, diagnostic: string, rules?: readonly string[]): ClaimedResult => ({
  kind: "failed",
  failure: { code, diagnostic: boundDiagnostic(`${code}: ${diagnostic}`) },
  rules,
});

async function processClaimed(row: ProcessingAssetRow, deps: WorkerDependencies): Promise<ClaimedResult> {
  // Source integrity, from the row alone (same rules as upload completion).
  const problem = checkCompletableSource(row);
  if (problem || !isCanonicalChecksum(row.sourceChecksumSha256)) return permanent("INVALID_SOURCE", problem ?? "sourceChecksumSha256 is missing");
  const extension = row.sourceKey.slice(row.sourceKey.lastIndexOf(".") + 1);
  const format = (Object.entries(MEDIA_FORMAT_SPECS).find(([, s]) => s.keyExtension === extension && s.kind === row.kind)?.[0] ?? null) as MediaAssetFormat | null;
  if (!format) return permanent("INVALID_SOURCE", "sourceKey extension does not match the asset kind");

  // Read the private source and verify it again: the bytes, not S3's word.
  const read = await deps.reader.read(row.sourceKey, row.sourceSizeBytes);
  if (read.status === "NOT_FOUND") return permanent("SOURCE_MISSING", "ingest object not found");
  if (read.status === "UNAVAILABLE") return { kind: "retry", reason: `source unavailable (${read.reason})` };
  const verdict = verifyIngestObject(row, read.head);
  if (!verdict.ok && verdict.outcome === "MISCONFIGURED") return { kind: "retry", reason: `ingest bucket configuration (${verdict.problem})` };
  if (!verdict.ok) return permanent("SOURCE_INTEGRITY_FAILED", `object headers: ${verdict.mismatch}`);
  const bytes = read.bytes;
  if (!bytes || bytes.length !== row.sourceSizeBytes) return permanent("SOURCE_INTEGRITY_FAILED", "object size differs from the verified upload");
  const actual = createHash("sha256").update(bytes).digest("base64");
  if (actual !== row.sourceChecksumSha256) return permanent("SOURCE_INTEGRITY_FAILED", "object SHA-256 differs from the verified upload");

  // The Phase 2B-2 pipeline, unchanged.
  let run;
  try {
    run = await runPipelineOnSource(bytes, { mediaId: row.id, extension, posterGenerator: deps.posterGenerator });
  } catch (error) {
    if (error instanceof UsageError) return permanent("INTERNAL_ERROR", `pipeline usage error (${errorName(error)})`);
    throw error;
  }
  const { item, staged } = run;
  if (item.status === "fail") {
    const classified = classifyValidationFailure(item);
    return { kind: "failed", failure: { code: classified.code, diagnostic: classified.diagnostic }, rules: classified.rules };
  }

  // Invariants between the pipeline's result and the verified row. Any breach is a bug, not the user's file.
  const sourceHex = base64ToHex(row.sourceChecksumSha256);
  const entry = item.objects.find((o) => o.role === "entry");
  if (
    item.mediaId !== row.id ||
    item.kind !== row.kind ||
    item.format !== format ||
    item.contentHash !== sourceHex ||
    item.sizeBytes !== row.sourceSizeBytes ||
    !item.storageKey ||
    !item.entryFile ||
    !item.mimeType ||
    !entry ||
    entry.sha256 !== sourceHex ||
    item.processingVersion !== PROCESSING_VERSION
  ) {
    return permanent("INTERNAL_ERROR", "pipeline result does not match the verified source");
  }

  const data: ProcessedAssetData = {
    format,
    storageKey: item.storageKey,
    entryFile: item.entryFile,
    contentHash: item.contentHash,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    fileCount: item.objects.length,
    posterKey: item.poster?.key ?? null,
    dimensions: {
      entry: item.dimensions,
      poster: item.poster ? { width: item.poster.width, height: item.poster.height } : null,
    },
    // Warning rule ids only (validator messages can quote file content), for the reviewer.
    metrics: { ...item.metrics, ...warningRules(item.validation) },
    processorVersion: item.processingVersion,
  };
  const problems = validateMediaAssetRecord({
    ...row,
    ...data,
    status: "PENDING_REVIEW",
    reviewedAt: null,
    publishedAt: null,
    rejectionReason: null,
    processingError: null,
    failureCode: null,
    processingLeaseExpiresAt: null,
  });
  if (problems.length > 0) return permanent("INTERNAL_ERROR", `processed record violates the contract: ${problems.join("; ")}`);

  // Write-once review copies of every processed object. Reruns find identical objects ("exists").
  for (const object of item.objects) {
    const body = object.role === "entry" ? bytes : staged.find((s) => s.key === object.key)?.bytes ?? null;
    if (!body || sha256Hex(body) !== object.sha256) return permanent("INTERNAL_ERROR", `staged bytes for ${object.role} do not match the manifest`);
    try {
      await deps.publisher.publish({ key: reviewKeyFor(object.key), bytes: body, contentType: object.contentType, cacheControl: REVIEW_CACHE_CONTROL, sha256: object.sha256 });
    } catch (error) {
      if (error instanceof ImmutableObjectConflictError) return permanent("INTERNAL_ERROR", `immutable object conflict for ${object.role}`);
      return { kind: "retry", reason: `publish failed (${errorName(error)})` };
    }
  }
  return { kind: "processed", data };
}
