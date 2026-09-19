import type { IngestObjectHead } from "../../../shared/media-asset";

/**
 * Worker-side ports. The data store and job types live in shared/media-processing.ts;
 * the publisher is the pipeline's ObjectPublisher (src/pipeline/adapters.ts).
 */

/** A private source object as read from the ingest bucket. */
export type SourceRead =
  /** `bytes` is null when the object was not read because it failed an integrity precondition (size, checksum). */
  | { readonly status: "FOUND"; readonly head: IngestObjectHead; readonly bytes: Uint8Array | null }
  | { readonly status: "NOT_FOUND" }
  /** Throttled, 5xx, network, credentials or permission problems. `reason` is for logs only. */
  | { readonly status: "UNAVAILABLE"; readonly reason: string };

export interface SourceReader {
  /** Reads one ingest source. Never reads more than `expectedBytes`. */
  read(key: string, expectedBytes: number): Promise<SourceRead>;
}

/** Existence check used by the sweeper for UPLOADED assets (the upload-completion inspector satisfies it). */
export interface SourceInspector {
  inspect(key: string): Promise<{ readonly status: "FOUND" | "NOT_FOUND" | "UNAVAILABLE" }>;
}

export type LogFields = Readonly<Record<string, string | number | boolean | null | readonly string[]>>;

/**
 * Structured, internal-only logging. Callers pass identifiers, counts, codes and
 * rule ids; never URLs, credentials, object bodies, validator messages (they can
 * quote user content) or AWS error bodies.
 */
export type ProcessingLogger = (event: string, fields: LogFields) => void;
