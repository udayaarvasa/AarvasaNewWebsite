import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { UPLOAD_COMPLETION_GRACE_SECONDS, UPLOAD_INTENT_TTL_SECONDS } from "../../../shared/media-asset";
import { buildProcessingJob, parseProcessingJob, PROCESSING_POLICY, serializeProcessingJob, type ProcessingJob } from "../../../shared/media-processing";
import { runSweep, type SweeperDependencies } from "../../src/processing/sweeper";
import { processJob } from "../../src/processing/worker";
import { glbFrom, triangleGltf } from "../pipeline/fixtures";
import { FakeSourceReader, InMemoryProcessingStore, ManualClock, processingRow, WriteOnceObjectStore, type StoredRow } from "./fakes";

const bytes = glbFrom(triangleGltf());
const id = (n: number) => `${String(n).padStart(8, "0")}aaaaaaaaaaaaaaaaaaaaaaaa`;
const clock = () => new ManualClock();
const SECONDS_TO_MISSING = UPLOAD_INTENT_TTL_SECONDS + UPLOAD_COMPLETION_GRACE_SECONDS;

function uploaded(n: number, createdAt: Date): StoredRow {
  return processingRow(id(n), bytes, "GLB", { status: "UPLOADED", processingStartedAt: null, createdAt });
}
function processing(n: number, overrides: Partial<StoredRow> = {}): StoredRow {
  return processingRow(id(n), bytes, "GLB", overrides);
}

function sweeper(store: InMemoryProcessingStore, c: ManualClock, extra: Partial<SweeperDependencies> = {}) {
  const sent: ProcessingJob[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const deps: SweeperDependencies = {
    store,
    now: c.now,
    log: (event, fields) => logs.push({ event, ...fields }),
    dispatch: async (job) => void sent.push(job),
    newJobId: () => randomUUID(),
    ...extra,
  };
  return { run: () => runSweep(deps), sent, logs };
}

const ago = (c: ManualClock, seconds: number) => new Date(c.ms - seconds * 1000);

describe("sweeper A: stale UPLOADED assets", () => {
  it("fails an upload whose object is missing past the completion deadline; the exact boundary is not yet expired", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([uploaded(1, ago(c, SECONDS_TO_MISSING)), uploaded(2, new Date(c.ms - SECONDS_TO_MISSING * 1000 - 1))]);
    const inspector = new FakeSourceReader();
    const report = await sweeper(store, c, { inspector: { inspect: async (key) => ({ status: inspector.objects.has(key) ? "FOUND" : "NOT_FOUND" }) } }).run();
    assert.deepEqual(report.uploadExpired, [id(2)]);
    assert.equal(store.get(id(1)).status, "UPLOADED", "created exactly at the deadline: still within grace");
    assert.equal(store.get(id(2)).status, "FAILED");
    assert.equal(store.get(id(2)).failureCode, "UPLOAD_EXPIRED");
  });

  it("leaves an uploaded-but-uncompleted object for the uploader until it is abandoned (24 h), then fails it", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([
      uploaded(1, ago(c, SECONDS_TO_MISSING + 60)),
      uploaded(2, ago(c, PROCESSING_POLICY.uploadAbandonedAfterSeconds)),
      uploaded(3, new Date(c.ms - PROCESSING_POLICY.uploadAbandonedAfterSeconds * 1000 - 1)),
    ]);
    const report = await sweeper(store, c, { inspector: { inspect: async () => ({ status: "FOUND" }) } }).run();
    assert.deepEqual(report.uploadExpired, [id(3)]);
    assert.equal(store.get(id(1)).status, "UPLOADED");
    assert.equal(store.get(id(2)).status, "UPLOADED", "exactly 24 h: not yet abandoned");
    assert.match(store.get(id(3)).processingError!, /abandoned/);
  });

  it("S3 unavailable or no inspector: never fails before abandonment", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([uploaded(1, ago(c, SECONDS_TO_MISSING + 60))]);
    await sweeper(store, c, { inspector: { inspect: async () => ({ status: "UNAVAILABLE" }) } }).run();
    await sweeper(store, c, { inspector: { inspect: async () => { throw new Error("boom"); } } }).run();
    await sweeper(store, c, { inspector: null }).run();
    assert.equal(store.get(id(1)).status, "UPLOADED");
  });

  it("does not overwrite an upload that was completed between the listing and the update", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([uploaded(1, ago(c, SECONDS_TO_MISSING + 60))]);
    store.beforeWrite = (op, rowId) => {
      if (op === "failUpload") store.rows.set(rowId, { ...store.get(rowId), status: "PROCESSING", processingStartedAt: c.now() });
    };
    const report = await sweeper(store, c, { inspector: { inspect: async () => ({ status: "NOT_FOUND" }) } }).run();
    assert.deepEqual(report.uploadExpired, []);
    assert.deepEqual(report.skipped[0], { id: id(1), reason: "state changed" });
    assert.equal(store.get(id(1)).status, "PROCESSING");
  });
});

describe("sweeper B/C: stale and inconsistent PROCESSING assets", () => {
  it("fails processing past the timeout; the exact boundary is not yet timed out", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([
      processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.processingTimeoutSeconds) }),
      processing(2, { processingStartedAt: new Date(c.ms - PROCESSING_POLICY.processingTimeoutSeconds * 1000 - 1) }),
    ]);
    const report = await sweeper(store, c).run();
    assert.deepEqual(report.processingTimedOut, [id(2)]);
    assert.equal(store.get(id(1)).status, "PROCESSING");
    assert.equal(store.get(id(2)).failureCode, "PROCESSING_TIMEOUT");
    assert.equal(store.get(id(2)).processingLeaseExpiresAt, null);
  });

  it("never fails an asset while a worker holds its lease", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([
      processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.processingTimeoutSeconds + 60), processingAttempts: 1, processingLeaseExpiresAt: new Date(c.ms + 60_000) }),
    ]);
    const report = await sweeper(store, c).run();
    assert.deepEqual(report.skipped, [{ id: id(1), reason: "leased by a worker" }]);
    assert.equal(store.get(id(1)).status, "PROCESSING");
  });

  it("fails an asset whose attempts are used up and whose lease has lapsed", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([processing(1, { processingAttempts: PROCESSING_POLICY.maxAttempts, processingLeaseExpiresAt: new Date(c.ms - 1) })]);
    const report = await sweeper(store, c).run();
    assert.deepEqual(report.retriesExhausted, [id(1)]);
    assert.equal(store.get(id(1)).failureCode, "RETRIES_EXHAUSTED");
  });

  it("fails an inconsistent PROCESSING row (no canonical checksum, foreign key) as INVALID_SOURCE", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([
      processing(1, { sourceChecksumSha256: null }),
      processing(2, { sourceKey: `uploads/${id(9)}/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.glb` }),
    ]);
    const report = await sweeper(store, c).run();
    assert.deepEqual(report.invalidSource.sort(), [id(1), id(2)]);
  });

  it("uses conditional updates: a row that completed meanwhile is not overwritten", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.processingTimeoutSeconds + 60) })]);
    store.beforeWrite = (op, rowId) => {
      if (op === "failProcessing") store.rows.set(rowId, { ...store.get(rowId), status: "PENDING_REVIEW" });
    };
    const report = await sweeper(store, c).run();
    assert.deepEqual(report.processingTimedOut, []);
    assert.equal(store.get(id(1)).status, "PENDING_REVIEW");
  });

  it("leaves PENDING_REVIEW, PUBLISHED, REJECTED, FAILED and ARCHIVED rows alone", async () => {
    const c = clock();
    const old = ago(c, 30 * 24 * 3600);
    const rows = (["PENDING_REVIEW", "PUBLISHED", "REJECTED", "FAILED", "ARCHIVED"] as const).map((status, i) =>
      processing(i + 1, { status, createdAt: old, processingStartedAt: old, failureCode: status === "FAILED" ? "VALIDATION_FAILED" : null }),
    );
    const store = new InMemoryProcessingStore(rows);
    const report = await sweeper(store, c).run();
    assert.equal(store.writes.length, 0);
    assert.equal(report.skipped.length, 0);
  });
});

describe("sweeper D: redispatch", () => {
  it("re-sends a job for an unclaimed PROCESSING asset older than the redispatch delay, and only then", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([
      processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.redispatchAfterSeconds + 1) }),
      processing(2, { processingStartedAt: ago(c, 60) }),
    ]);
    const s = sweeper(store, c);
    const report = await s.run();
    assert.deepEqual(report.redispatched, [id(1)]);
    assert.equal(s.sent.length, 1);
    const parsed = parseProcessingJob(serializeProcessingJob(s.sent[0]));
    assert.ok(parsed.ok);
    assert.equal(s.sent[0].sourceKey, store.get(id(1)).sourceKey);
    assert.equal(store.writes.length, 0, "redispatch never writes");
  });

  it("does nothing for redispatch without a producer, and survives a failing producer", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.redispatchAfterSeconds + 1) })]);
    assert.deepEqual((await sweeper(store, c, { dispatch: null }).run()).redispatched, []);
    const report = await sweeper(store, c, { dispatch: async () => { throw new Error("queue down"); } }).run();
    assert.match(report.skipped[0].reason, /redispatch failed/);
  });

  it("logs counts only", async () => {
    const c = clock();
    const store = new InMemoryProcessingStore([processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.processingTimeoutSeconds + 1) })]);
    const s = sweeper(store, c);
    await s.run();
    assert.deepEqual(s.logs, [{ event: "media.processing.sweep", uploadExpired: 0, processingTimedOut: 1, retriesExhausted: 0, invalidSource: 0, redispatched: 0, skipped: 0 }]);
  });
});

describe("sweeper + worker concurrency", () => {
  function workerDeps(store: InMemoryProcessingStore, c: ManualClock, row: StoredRow) {
    const reader = new FakeSourceReader();
    reader.put(row.sourceKey, bytes, "model/gltf-binary");
    return { store, reader, publisher: new WriteOnceObjectStore(), posterGenerator: null, now: c.now, log: () => undefined, clock: c.millis };
  }

  it("worker finishes first: the sweeper's timeout update matches nothing", async () => {
    const c = clock();
    const row = processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.processingTimeoutSeconds + 60) });
    const store = new InMemoryProcessingStore([row]);
    const job = buildProcessingJob(row, randomUUID(), c.now());
    const outcome = await processJob(serializeProcessingJob(job), { messageId: "m", receiveCount: 1 }, workerDeps(store, c, row));
    assert.equal(outcome.result, "COMPLETED");
    const report = await sweeper(store, c).run();
    assert.deepEqual(report.processingTimedOut, []);
    assert.equal(store.get(id(1)).status, "PENDING_REVIEW");
  });

  it("sweeper fails first (the worker stalled past its lease): the late worker cannot overwrite FAILED", async () => {
    const c = clock();
    const row = processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.processingTimeoutSeconds + 60) });
    const store = new InMemoryProcessingStore([row]);
    const job = buildProcessingJob(row, randomUUID(), c.now());
    const deps = workerDeps(store, c, row);
    // Hold the worker inside publication, as a stalled process would be.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let entered!: () => void;
    const inPublish = new Promise<void>((resolve) => (entered = resolve));
    const publisher = deps.publisher;
    const gated = { publish: async (o: Parameters<typeof publisher.publish>[0]) => (entered(), await gate, publisher.publish(o)) };
    const running = processJob(serializeProcessingJob(job), { messageId: "m", receiveCount: 1 }, { ...deps, publisher: gated });
    await inPublish;
    assert.deepEqual((await sweeper(store, c).run()).skipped, [{ id: id(1), reason: "leased by a worker" }], "lease still held: untouched");
    c.advance(PROCESSING_POLICY.leaseSeconds + 1);
    const report = await sweeper(store, c).run();
    assert.deepEqual(report.processingTimedOut, [id(1)]);
    release();
    const outcome = await running;
    assert.equal(outcome.result, "SKIPPED");
    assert.equal(store.get(id(1)).status, "FAILED");
    assert.equal(store.get(id(1)).failureCode, "PROCESSING_TIMEOUT");
  });

  it("many sweeps and workers racing on one asset end in exactly one terminal state", async () => {
    const c = clock();
    const row = processing(1, { processingStartedAt: ago(c, PROCESSING_POLICY.processingTimeoutSeconds + 60) });
    const store = new InMemoryProcessingStore([row]);
    const job = serializeProcessingJob(buildProcessingJob(row, randomUUID(), c.now()));
    const deps = workerDeps(store, c, row);
    await Promise.all([
      processJob(job, { messageId: "a", receiveCount: 1 }, deps),
      runSweep({ store, now: c.now, log: () => undefined }),
      processJob(job, { messageId: "b", receiveCount: 1 }, deps),
      runSweep({ store, now: c.now, log: () => undefined }),
    ]);
    const final = store.get(id(1));
    assert.ok(final.status === "PENDING_REVIEW" || final.status === "FAILED", final.status);
    const terminalWrites = store.writes.filter((w) => (w.op === "complete" || w.op === "failProcessing") && w.count === 1);
    assert.equal(terminalWrites.length, 1, JSON.stringify(store.writes));
  });
});
