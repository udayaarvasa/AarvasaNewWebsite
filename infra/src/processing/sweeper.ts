import { checkCompletableSource } from "../../../shared/media-asset";
import {
  assertTransition,
  buildProcessingJob,
  PROCESSING_POLICY,
  processingTimeoutCutoff,
  redispatchCutoff,
  uploadAbandonedCutoff,
  uploadMissingCutoff,
  type MediaFailure,
  type ProcessingAssetRow,
  type ProcessingJob,
  type ProcessingStore,
} from "../../../shared/media-processing";
import type { ProcessingLogger, SourceInspector } from "./ports";

/**
 * Lifecycle recovery (Phase 5C). One run is a bounded pass over stale assets; it
 * is safe to run concurrently with workers, completions and other sweeps, because
 * every change is a conditional update that re-checks, in the database, the exact
 * condition that made the row a candidate. A row that moved on in the meantime is
 * left alone and reported as skipped.
 *
 *   A  UPLOADED past the completion deadline (createdAt + URL lifetime + grace):
 *        object missing → FAILED UPLOAD_EXPIRED
 *        object present or S3 unavailable → left for the uploader to complete, until
 *        abandoned (createdAt + 24 h) → FAILED UPLOAD_EXPIRED, whatever S3 says
 *   B  PROCESSING past the processing timeout (6 h), lease free → FAILED PROCESSING_TIMEOUT
 *   C  PROCESSING, lease free, attempts used up → FAILED RETRIES_EXHAUSTED
 *      PROCESSING, lease free, row inconsistent (bad source key/checksum) → FAILED INVALID_SOURCE
 *   D  PROCESSING, lease free, attempts left, started > 15 min ago → the job is re-sent
 *      (a lost message or a failed post-commit send); the worker is idempotent
 *
 * The sweeper never deletes objects: the ingest bucket's 7-day lifecycle rule does.
 * It is not scheduled yet; the intended trigger (an EventBridge schedule every
 * 15 minutes) is documented in infra/README.md and not deployed.
 */

export interface SweeperDependencies {
  readonly store: ProcessingStore;
  /** Optional existence check for category A; without it, only abandonment applies. */
  readonly inspector?: SourceInspector | null;
  /** Optional producer for category D. */
  readonly dispatch?: ((job: ProcessingJob) => Promise<void>) | null;
  readonly newJobId?: () => string;
  readonly now: () => Date;
  readonly log: ProcessingLogger;
  /** Rows examined per category per run. */
  readonly limit?: number;
}

export interface SweepReport {
  readonly uploadExpired: string[];
  readonly processingTimedOut: string[];
  readonly retriesExhausted: string[];
  readonly invalidSource: string[];
  readonly redispatched: string[];
  readonly skipped: Array<{ readonly id: string; readonly reason: string }>;
}

export const DEFAULT_SWEEP_LIMIT = 100;

const leaseFree = (row: ProcessingAssetRow, now: Date) => row.processingLeaseExpiresAt === null || row.processingLeaseExpiresAt.getTime() < now.getTime();

export async function runSweep(deps: SweeperDependencies): Promise<SweepReport> {
  const now = deps.now();
  const limit = deps.limit ?? DEFAULT_SWEEP_LIMIT;
  const report: SweepReport = { uploadExpired: [], processingTimedOut: [], retriesExhausted: [], invalidSource: [], redispatched: [], skipped: [] };
  const skip = (id: string, reason: string) => report.skipped.push({ id, reason });

  // ── A. Stale uploads ───────────────────────────────────────────────────────
  const missingCutoff = uploadMissingCutoff(now);
  const abandonedCutoff = uploadAbandonedCutoff(now);
  for (const row of await deps.store.listUploadedBefore(missingCutoff, limit)) {
    let failure: MediaFailure | null = null;
    let createdBefore = missingCutoff;
    if (row.createdAt.getTime() < abandonedCutoff.getTime()) {
      failure = { code: "UPLOAD_EXPIRED", diagnostic: "UPLOAD_EXPIRED: upload never completed; abandoned by the sweeper" };
      createdBefore = abandonedCutoff;
    } else if (deps.inspector && !checkCompletableSource(row)) {
      let status: "FOUND" | "NOT_FOUND" | "UNAVAILABLE";
      try {
        status = (await deps.inspector.inspect(row.sourceKey)).status;
      } catch {
        status = "UNAVAILABLE";
      }
      if (status === "NOT_FOUND") failure = { code: "UPLOAD_EXPIRED", diagnostic: "UPLOAD_EXPIRED: upload not received before the completion deadline" };
      else skip(row.id, status === "FOUND" ? "uploaded; awaiting completion" : "source existence unknown");
    } else {
      skip(row.id, "awaiting completion or abandonment");
    }
    if (!failure) continue;
    assertTransition("SWEEPER", "UPLOADED", "FAILED");
    const updated = await deps.store.failUpload(row.id, createdBefore, failure);
    if (updated === 1) report.uploadExpired.push(row.id);
    else skip(row.id, "state changed");
  }

  // ── B, C, D. Processing ────────────────────────────────────────────────────
  const timeoutCutoff = processingTimeoutCutoff(now);
  const resendCutoff = redispatchCutoff(now);
  for (const row of await deps.store.listProcessing(limit)) {
    if (!leaseFree(row, now)) {
      skip(row.id, "leased by a worker");
      continue;
    }
    const startedAt = row.processingStartedAt;
    let failure: MediaFailure | null = null;
    let bucket: string[] | null = null;
    let guard = {};
    if (startedAt && startedAt.getTime() < timeoutCutoff.getTime()) {
      failure = { code: "PROCESSING_TIMEOUT", diagnostic: `PROCESSING_TIMEOUT: still processing after ${PROCESSING_POLICY.processingTimeoutSeconds} s (${row.processingAttempts} attempts)` };
      bucket = report.processingTimedOut;
      guard = { leaseFreeAt: now, startedBefore: timeoutCutoff };
    } else if (row.processingAttempts >= PROCESSING_POLICY.maxAttempts) {
      failure = { code: "RETRIES_EXHAUSTED", diagnostic: `RETRIES_EXHAUSTED: ${row.processingAttempts} attempts used` };
      bucket = report.retriesExhausted;
      guard = { leaseFreeAt: now, minAttempts: PROCESSING_POLICY.maxAttempts };
    } else {
      const problem = checkCompletableSource(row);
      if (problem) {
        failure = { code: "INVALID_SOURCE", diagnostic: `INVALID_SOURCE: ${problem}` };
        bucket = report.invalidSource;
        guard = { leaseFreeAt: now, sourceKey: row.sourceKey };
      }
    }

    if (failure && bucket) {
      assertTransition("SWEEPER", "PROCESSING", "FAILED");
      const updated = await deps.store.failProcessing(row.id, guard, failure);
      if (updated === 1) bucket.push(row.id);
      else skip(row.id, "state changed");
      continue;
    }

    if (startedAt && startedAt.getTime() < resendCutoff.getTime() && deps.dispatch && deps.newJobId) {
      try {
        await deps.dispatch(buildProcessingJob(row, deps.newJobId(), now));
        report.redispatched.push(row.id);
      } catch (error) {
        skip(row.id, `redispatch failed (${error instanceof Error ? error.name : "UnknownError"})`);
      }
    } else {
      skip(row.id, "processing in progress");
    }
  }

  deps.log("media.processing.sweep", {
    uploadExpired: report.uploadExpired.length,
    processingTimedOut: report.processingTimedOut.length,
    retriesExhausted: report.retriesExhausted.length,
    invalidSource: report.invalidSource.length,
    redispatched: report.redispatched.length,
    skipped: report.skipped.length,
  });
  return report;
}
