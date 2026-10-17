import { boundDiagnostic, type MediaFailure, type MediaFailureCode } from "../../../shared/media-processing";
import type { ItemManifest } from "../pipeline/process";

/**
 * Maps the pipeline's failing rule ids to a failure code. The rules themselves are
 * the Phase 2B-2 validators', unchanged; only their meaning for the user is added.
 *
 * Retry policy (enforced by the worker):
 *   retryable     S3 5xx, throttling, network or credential failures, 409 conditional-write
 *                 conflicts, unexpected worker exceptions, database errors
 *                 → lease released, SQS redelivers, at most PROCESSING_POLICY.maxAttempts
 *   permanent     every validation failure below, source missing, integrity mismatch,
 *                 invalid source key, immutable-object conflict
 *                 → FAILED at once, never retried
 */
const SIZE_RULES: ReadonlySet<string> = new Set(["size.hard-limit", "size.source-max"]);
const UNSUPPORTED_RULES: ReadonlySet<string> = new Set([
  "input.extension",
  "input.file",
  "mime.content-mismatch",
  // A QuickTime or HEIC file in an .mp4 name, or a codec no browser plays: the
  // wrong kind of file, not a broken one, and a re-export is the fix.
  "video.brand",
  "video.codec",
  "gltf.external-uri",
  "gltf.data-uri",
  "gltf.meshopt",
  "gltf.extensions-required",
  "panorama.animated",
]);

export interface ClassifiedFailure extends MediaFailure {
  /** Failing rule ids only: safe to log (messages can quote user content, e.g. a URI). */
  readonly rules: readonly string[];
}

export function classifyValidationFailure(item: ItemManifest): ClassifiedFailure {
  const failures = item.validation.filter((f) => f.level === "fail");
  const rules = [...new Set(failures.map((f) => f.rule))];
  const code: MediaFailureCode = rules.some((r) => SIZE_RULES.has(r))
    ? "SIZE_LIMIT_EXCEEDED"
    : rules.some((r) => UNSUPPORTED_RULES.has(r))
      ? "UNSUPPORTED_CONTENT"
      : "VALIDATION_FAILED";
  const diagnostic = boundDiagnostic(`${code}: ${failures.map((f) => `${f.rule}: ${f.message}`).join("; ")}`);
  return { code, diagnostic, rules };
}
