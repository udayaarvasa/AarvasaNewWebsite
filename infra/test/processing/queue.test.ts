import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { buildProcessingJob, PROCESSING_POLICY } from "../../../shared/media-processing";
import { handleProcessingBatch } from "../../src/processing/sqs-handler";
import type { WorkerDependencies } from "../../src/processing/worker";
import { glbFrom, triangleGltf } from "../pipeline/fixtures";
import { FakeSourceReader, FakeSqsQueue, InMemoryProcessingStore, ManualClock, processingRow, WriteOnceObjectStore } from "./fakes";

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function system(options: { unavailable?: number } = {}) {
  const clock = new ManualClock();
  const bytes = glbFrom(triangleGltf());
  const row = processingRow(MEDIA, bytes, "GLB");
  const store = new InMemoryProcessingStore([row]);
  const reader = new FakeSourceReader();
  reader.put(row.sourceKey, bytes, "model/gltf-binary");
  reader.unavailable = options.unavailable ?? 0;
  const publisher = new WriteOnceObjectStore();
  const deps: WorkerDependencies = { store, reader, publisher, posterGenerator: null, now: clock.now, log: () => undefined, clock: clock.millis };
  const queue = new FakeSqsQueue(clock.millis, PROCESSING_POLICY.queueVisibilityTimeoutSeconds * 1000, PROCESSING_POLICY.queueMaxReceiveCount);
  /** One poll: receive, handle as the Lambda would, delete everything not reported as failed. */
  const poll = async () => {
    const Records = queue.receive();
    const { batchItemFailures } = await handleProcessingBatch({ Records }, deps);
    const failed = new Set(batchItemFailures.map((f) => f.itemIdentifier));
    for (const r of Records) if (!failed.has(r.messageId)) queue.delete(r.messageId);
    return { received: Records.length, failed: failed.size };
  };
  return { clock, store, reader, publisher, queue, poll, deps, row, job: () => buildProcessingJob(row, randomUUID(), clock.now()) };
}

describe("processing queue (SQS semantics, offline)", () => {
  it("a job is processed once and deleted", async () => {
    const s = system();
    await s.queue.send(s.job());
    assert.deepEqual(await s.poll(), { received: 1, failed: 0 });
    assert.equal(s.queue.messages.length, 0);
    assert.equal(s.store.get(MEDIA).status, "PENDING_REVIEW");
  });

  it("a duplicate job (sent twice, e.g. completion plus sweeper) processes the asset once", async () => {
    const s = system();
    await s.queue.send(s.job());
    await s.queue.send(s.job());
    assert.deepEqual(await s.poll(), { received: 2, failed: 0 });
    assert.equal(s.queue.messages.length, 0);
    assert.deepEqual(s.publisher.results.map((r) => r.result), ["created"]);
    assert.equal(s.store.writes.filter((w) => w.op === "complete" && w.count === 1).length, 1);
  });

  it("a transient failure keeps the message; it is redelivered after the visibility timeout and then succeeds", async () => {
    const s = system({ unavailable: 1 });
    await s.queue.send(s.job());
    assert.deepEqual(await s.poll(), { received: 1, failed: 1 });
    assert.deepEqual(await s.poll(), { received: 0, failed: 0 }, "invisible until the timeout");
    s.clock.advance(PROCESSING_POLICY.queueVisibilityTimeoutSeconds);
    assert.deepEqual(await s.poll(), { received: 1, failed: 0 });
    assert.equal(s.store.get(MEDIA).status, "PENDING_REVIEW");
    assert.equal(s.queue.deadLetters.length, 0);
  });

  it("persistent transient failures end in FAILED RETRIES_EXHAUSTED (database attempts), before the DLQ", async () => {
    const s = system({ unavailable: 100 });
    await s.queue.send(s.job());
    for (let i = 0; i < PROCESSING_POLICY.queueMaxReceiveCount + 1; i++) {
      await s.poll();
      s.clock.advance(PROCESSING_POLICY.queueVisibilityTimeoutSeconds);
    }
    assert.equal(s.store.get(MEDIA).status, "FAILED");
    assert.equal(s.store.get(MEDIA).failureCode, "RETRIES_EXHAUSTED");
    assert.equal(s.queue.messages.length, 0, "the message was acknowledged once the asset failed");
    assert.equal(s.queue.deadLetters.length, 0);
  });

  it("an invalid (poison) message is never acknowledged and lands in the DLQ after maxReceiveCount receives", async () => {
    const s = system();
    s.queue.sendRaw(JSON.stringify({ mediaAssetId: MEDIA, status: "PUBLISHED" }));
    for (let i = 0; i < PROCESSING_POLICY.queueMaxReceiveCount + 1; i++) {
      await s.poll();
      s.clock.advance(PROCESSING_POLICY.queueVisibilityTimeoutSeconds);
    }
    assert.equal(s.queue.messages.length, 0);
    assert.equal(s.queue.deadLetters.length, 1);
    assert.equal(s.queue.deadLetters[0].receiveCount, PROCESSING_POLICY.queueMaxReceiveCount);
    assert.equal(s.store.writes.length, 0, "a poison message never touches the database");
    assert.equal(s.store.get(MEDIA).status, "PROCESSING", "the asset is left for the sweeper's redispatch/timeout");
  });

  it("a batch mixes outcomes: only the non-acknowledged records are reported as failures", async () => {
    const s = system();
    const Records = [
      { messageId: "ok", body: JSON.stringify(s.job()), attributes: { ApproximateReceiveCount: "1" } },
      { messageId: "poison", body: "nope", attributes: { ApproximateReceiveCount: "1" } },
      { messageId: "dup", body: JSON.stringify(s.job()), attributes: { ApproximateReceiveCount: "3" } },
    ];
    // JSON.stringify of a job keeps field order; the worker accepts it.
    const { batchItemFailures } = await handleProcessingBatch({ Records }, s.deps);
    assert.deepEqual(batchItemFailures, [{ itemIdentifier: "poison" }]);
  });

  it("a worker that throws outright still only fails its own record", async () => {
    const s = system();
    const deps = { ...s.deps, store: { ...s.store, findAsset: async () => { throw new Error("boom"); } } } as unknown as WorkerDependencies;
    const { batchItemFailures } = await handleProcessingBatch({ Records: [{ messageId: "x", body: JSON.stringify(s.job()) }] }, deps);
    assert.deepEqual(batchItemFailures, [{ itemIdentifier: "x" }]);
  });
});
