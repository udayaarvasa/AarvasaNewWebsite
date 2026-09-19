/**
 * Offline doubles for the processing layer: no database, no AWS, no network.
 * The in-memory store implements exactly the predicates of the Prisma store
 * (src/lib/services/media-processing.store.ts); the disposable-PostgreSQL run
 * exercises the real one.
 */
import { createHash } from "node:crypto";
import { MEDIA_FORMAT_SPECS, type IngestObjectHead, type MediaAssetFormat, type MediaAssetStatus } from "../../../shared/media-asset";
import {
  type MediaFailure,
  type ProcessedAssetData,
  type ProcessingAssetRow,
  type ProcessingFailureGuard,
  type ProcessingJob,
  type ProcessingJobQueue,
  type ProcessingStore,
  serializeProcessingJob,
} from "../../../shared/media-processing";
import type { GeneratedPoster, ObjectPublisher, PosterGenerator } from "../../src/pipeline/adapters";
import { sha256Hex } from "../../src/pipeline/formats";
import { ImmutableObjectConflictError, RetryableProcessingError } from "../../src/processing/errors";
import type { SourceRead, SourceReader } from "../../src/processing/ports";
import { webp } from "../pipeline/fixtures";

export const T0 = new Date("2026-09-19T10:00:00.000Z");
export const UPLOAD_ID = "0f1e2d3c4b5a69788796a5b4c3d2e1f0";
export const base64Sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("base64");

export type StoredRow = ProcessingAssetRow & {
  format: MediaAssetFormat | null;
  storageKey: string | null;
  entryFile: string | null;
  contentHash: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fileCount: number | null;
  posterKey: string | null;
  dimensions: unknown;
  metrics: unknown;
  processorVersion: string | null;
  processingError: string | null;
  failureCode: string | null;
};

/** A row as upload completion leaves it: PROCESSING, verified source, no attempts yet. */
export function processingRow(id: string, bytes: Uint8Array, format: MediaAssetFormat, overrides: Partial<StoredRow> = {}): StoredRow {
  const spec = MEDIA_FORMAT_SPECS[format];
  return {
    id,
    subjectType: "PROPERTY",
    propertyId: "prop-1",
    projectSlug: null,
    kind: spec.kind,
    status: "PROCESSING",
    sourceKey: `uploads/${id}/${UPLOAD_ID}/source.${spec.keyExtension}`,
    sourceSizeBytes: bytes.length,
    sourceMimeType: spec.contentType,
    sourceChecksumSha256: base64Sha256(bytes),
    processingStartedAt: T0,
    processingAttempts: 0,
    processingLeaseExpiresAt: null,
    altText: null,
    createdAt: new Date(T0.getTime() - 5 * 60_000),
    format: null,
    storageKey: null,
    entryFile: null,
    contentHash: null,
    mimeType: null,
    sizeBytes: null,
    fileCount: null,
    posterKey: null,
    dimensions: null,
    metrics: null,
    processorVersion: null,
    processingError: null,
    failureCode: null,
    ...overrides,
  };
}

export class InMemoryProcessingStore implements ProcessingStore {
  readonly rows = new Map<string, StoredRow>();
  readonly writes: Array<{ op: string; id: string; count: number }> = [];
  /** Called before each write evaluates its predicate: simulates a concurrent change or a crash. */
  beforeWrite: ((op: string, id: string) => void) | null = null;
  failNext: { op: string; error: Error } | null = null;

  constructor(rows: StoredRow[] = []) {
    for (const row of rows) this.rows.set(row.id, { ...row });
  }

  get(id: string): StoredRow {
    const row = this.rows.get(id);
    if (!row) throw new Error(`no row ${id}`);
    return row;
  }

  private write(op: string, id: string, apply: (row: StoredRow) => Partial<StoredRow> | null): number {
    this.beforeWrite?.(op, id);
    if (this.failNext?.op === op) {
      const { error } = this.failNext;
      this.failNext = null;
      throw error;
    }
    const row = this.rows.get(id);
    const patch = row ? apply(row) : null;
    if (row && patch) this.rows.set(id, { ...row, ...patch });
    const count = row && patch ? 1 : 0;
    this.writes.push({ op, id, count });
    return count;
  }

  private static leaseFree(row: StoredRow, now: Date) {
    return row.processingLeaseExpiresAt === null || row.processingLeaseExpiresAt.getTime() < now.getTime();
  }

  async findAsset(id: string) {
    const row = this.rows.get(id);
    return row ? { ...row } : null;
  }

  async claim(id: string, sourceKey: string, now: Date, leaseExpiresAt: Date, maxAttempts: number) {
    const count = this.write("claim", id, (r) =>
      r.status === "PROCESSING" && r.sourceKey === sourceKey && r.processingAttempts < maxAttempts && InMemoryProcessingStore.leaseFree(r, now)
        ? { processingAttempts: r.processingAttempts + 1, processingLeaseExpiresAt: leaseExpiresAt }
        : null,
    );
    return count === 1 ? this.get(id).processingAttempts : null;
  }

  async release(id: string, attempt: number) {
    return this.write("release", id, (r) => (r.status === "PROCESSING" && r.processingAttempts === attempt ? { processingLeaseExpiresAt: null } : null));
  }

  async completeProcessing(id: string, attempt: number, expected: { sourceKey: string; sourceChecksumSha256: string }, data: ProcessedAssetData) {
    return this.write("complete", id, (r) =>
      r.status === "PROCESSING" && r.processingAttempts === attempt && r.sourceKey === expected.sourceKey && r.sourceChecksumSha256 === expected.sourceChecksumSha256
        ? { ...data, status: "PENDING_REVIEW" as MediaAssetStatus, processingError: null, failureCode: null, processingLeaseExpiresAt: null }
        : null,
    );
  }

  async failProcessing(id: string, guard: ProcessingFailureGuard, failure: MediaFailure) {
    return this.write("failProcessing", id, (r) => {
      const ok =
        r.status === "PROCESSING" &&
        (guard.attempt === undefined || r.processingAttempts === guard.attempt) &&
        (!guard.leaseFreeAt || InMemoryProcessingStore.leaseFree(r, guard.leaseFreeAt)) &&
        (!guard.startedBefore || (r.processingStartedAt !== null && r.processingStartedAt.getTime() < guard.startedBefore.getTime())) &&
        (guard.minAttempts === undefined || r.processingAttempts >= guard.minAttempts) &&
        (guard.sourceKey === undefined || r.sourceKey === guard.sourceKey);
      return ok ? { status: "FAILED" as MediaAssetStatus, failureCode: failure.code, processingError: failure.diagnostic, processingLeaseExpiresAt: null } : null;
    });
  }

  async failUpload(id: string, createdBefore: Date, failure: MediaFailure) {
    return this.write("failUpload", id, (r) =>
      r.status === "UPLOADED" && r.createdAt.getTime() < createdBefore.getTime()
        ? { status: "FAILED" as MediaAssetStatus, failureCode: failure.code, processingError: failure.diagnostic }
        : null,
    );
  }

  async listUploadedBefore(createdBefore: Date, limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.status === "UPLOADED" && r.createdAt.getTime() < createdBefore.getTime())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }

  async listProcessing(limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.status === "PROCESSING")
      .sort((a, b) => (a.processingStartedAt?.getTime() ?? 0) - (b.processingStartedAt?.getTime() ?? 0) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map((r) => ({ ...r }));
  }
}

/** Private ingest objects. `script` lets a test make the next reads fail transiently. */
export class FakeSourceReader implements SourceReader {
  readonly objects = new Map<string, { bytes: Uint8Array; head: IngestObjectHead }>();
  readonly reads: string[] = [];
  unavailable = 0;

  put(key: string, bytes: Uint8Array, contentType: string, overrides: Partial<IngestObjectHead> = {}) {
    this.objects.set(key, {
      bytes,
      head: { contentLength: bytes.length, contentType, checksumSha256: base64Sha256(bytes), checksumType: "FULL_OBJECT", serverSideEncryption: "AES256", ...overrides },
    });
  }

  async read(key: string, expectedBytes: number): Promise<SourceRead> {
    this.reads.push(key);
    if (this.unavailable > 0) {
      this.unavailable--;
      return { status: "UNAVAILABLE", reason: "SlowDown (HTTP 503)" };
    }
    const object = this.objects.get(key);
    if (!object) return { status: "NOT_FOUND" };
    return { status: "FOUND", head: object.head, bytes: object.bytes.length === expectedBytes ? object.bytes : null };
  }
}

/** The published bucket's write-once behaviour (If-None-Match: *). */
export class WriteOnceObjectStore implements ObjectPublisher {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string; cacheControl: string; sha256: string }>();
  readonly results: Array<{ key: string; result: "created" | "exists" }> = [];
  transientFailures = 0;
  /** Throws after this many successful publishes (simulated crash mid-publication). */
  crashAfter: number | null = null;

  async publish(object: { key: string; bytes: Uint8Array; contentType: string; cacheControl: string; sha256: string }) {
    if (this.transientFailures > 0) {
      this.transientFailures--;
      throw new RetryableProcessingError("SlowDown (HTTP 503)");
    }
    if (this.crashAfter !== null && this.results.length >= this.crashAfter) throw new Error("simulated crash");
    const existing = this.objects.get(object.key);
    if (existing) {
      if (existing.sha256 !== object.sha256 || sha256Hex(existing.bytes) !== object.sha256) throw new ImmutableObjectConflictError("different content");
      this.results.push({ key: object.key, result: "exists" });
      return "exists" as const;
    }
    this.objects.set(object.key, { bytes: object.bytes, contentType: object.contentType, cacheControl: object.cacheControl, sha256: object.sha256 });
    this.results.push({ key: object.key, result: "created" });
    return "created" as const;
  }
}

export const fakePosterGenerator: PosterGenerator = {
  id: "fake-poster-v1/webp-1280x640",
  async fromEquirectangular(): Promise<GeneratedPoster> {
    return { bytes: webp(1280, 640, { lossless: false }), mimeType: "image/webp", width: 1280, height: 640 };
  },
};

/**
 * A standard SQS queue, clock-driven: at-least-once delivery, visibility timeout,
 * ApproximateReceiveCount, and a redrive to a dead-letter queue after maxReceiveCount.
 */
export class FakeSqsQueue implements ProcessingJobQueue {
  private seq = 0;
  readonly messages: Array<{ messageId: string; body: string; receiveCount: number; visibleAt: number }> = [];
  readonly deadLetters: Array<{ messageId: string; body: string; receiveCount: number }> = [];

  constructor(
    private readonly clock: () => number,
    private readonly visibilityTimeoutMs: number,
    private readonly maxReceiveCount: number,
  ) {}

  async send(job: ProcessingJob) {
    this.sendRaw(serializeProcessingJob(job));
  }

  sendRaw(body: string) {
    this.messages.push({ messageId: `m-${++this.seq}`, body, receiveCount: 0, visibleAt: this.clock() });
  }

  /** Receives visible messages; a message past maxReceiveCount moves to the DLQ instead. */
  receive(max = 10): Array<{ messageId: string; body: string; attributes: { ApproximateReceiveCount: string } }> {
    const now = this.clock();
    const out = [];
    for (const message of [...this.messages]) {
      if (out.length >= max || message.visibleAt > now) continue;
      if (message.receiveCount >= this.maxReceiveCount) {
        this.messages.splice(this.messages.indexOf(message), 1);
        this.deadLetters.push({ messageId: message.messageId, body: message.body, receiveCount: message.receiveCount });
        continue;
      }
      message.receiveCount++;
      message.visibleAt = now + this.visibilityTimeoutMs;
      out.push({ messageId: message.messageId, body: message.body, attributes: { ApproximateReceiveCount: String(message.receiveCount) } });
    }
    return out;
  }

  delete(messageId: string) {
    const index = this.messages.findIndex((m) => m.messageId === messageId);
    if (index >= 0) this.messages.splice(index, 1);
  }
}

export class ManualClock {
  constructor(public ms: number = T0.getTime()) {}
  now = () => new Date(this.ms);
  millis = () => this.ms;
  advance(seconds: number) {
    this.ms += seconds * 1000;
  }
}
