import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { MEDIA_FORMAT_SPECS, type MediaAssetFormat, type MediaAssetStatus } from "../../../shared/media-asset";
import { mediaVersionPrefix } from "../../../shared/media-contract";
import { buildProcessingJob, PROCESSING_POLICY, publicFailureMessage, serializeProcessingJob, type ProcessingJob } from "../../../shared/media-processing";
import type { PosterGenerator } from "../../src/pipeline/adapters";
import { sha256Hex } from "../../src/pipeline/formats";
import { deriveKeyHash } from "../../src/pipeline/process";
import { acknowledges, processJob, type WorkerDependencies } from "../../src/processing/worker";
import { glb, glbFrom, jpeg, sogBundle, triangleGltf } from "../pipeline/fixtures";
import { FakeSourceReader, fakePosterGenerator, InMemoryProcessingStore, ManualClock, processingRow, UPLOAD_ID, WriteOnceObjectStore, type StoredRow } from "./fakes";

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

function harness(bytes: Uint8Array, format: MediaAssetFormat, options: { row?: Partial<StoredRow>; posterGenerator?: PosterGenerator | null; stored?: Uint8Array | null } = {}) {
  const clock = new ManualClock();
  const row = processingRow(MEDIA, bytes, format, options.row);
  const store = new InMemoryProcessingStore([row]);
  const reader = new FakeSourceReader();
  if (options.stored !== null) reader.put(row.sourceKey, options.stored ?? bytes, MEDIA_FORMAT_SPECS[format].contentType);
  const publisher = new WriteOnceObjectStore();
  const logs: Array<Record<string, unknown>> = [];
  const deps: WorkerDependencies = {
    store,
    reader,
    publisher,
    posterGenerator: options.posterGenerator === undefined ? null : options.posterGenerator,
    now: clock.now,
    log: (event, fields) => logs.push({ event, ...fields }),
    clock: clock.millis,
  };
  const job = buildProcessingJob(row, randomUUID(), clock.now());
  let deliveries = 0;
  const run = (j: ProcessingJob | string = job) => processJob(typeof j === "string" ? j : serializeProcessingJob(j), { messageId: "m-1", receiveCount: ++deliveries }, deps);
  return { clock, store, reader, publisher, logs, deps, job, run, row: () => store.get(MEDIA) };
}

const validGlb = () => glbFrom(triangleGltf());

describe("worker: supported sources → PENDING_REVIEW (never PUBLISHED)", () => {
  it("valid GLB: validated, published write-once, recorded with every processed field", async () => {
    const bytes = validGlb();
    const h = harness(bytes, "GLB");
    const outcome = await h.run();
    assert.equal(outcome.result, "COMPLETED");
    const row = h.row();
    assert.equal(row.status, "PENDING_REVIEW");
    assert.equal(row.format, "GLB");
    assert.equal(row.entryFile, "scene.glb");
    assert.equal(row.contentHash, sha256Hex(bytes));
    assert.equal(row.contentHash, Buffer.from(row.sourceChecksumSha256!, "base64").toString("hex"), "passthrough: entry is the verified source");
    assert.equal(row.mimeType, "model/gltf-binary");
    assert.equal(row.sizeBytes, bytes.length);
    assert.equal(row.fileCount, 1);
    assert.equal(row.posterKey, null);
    assert.equal(row.storageKey, mediaVersionPrefix(MEDIA, deriveKeyHash(sha256Hex(bytes), "none")));
    assert.equal(row.processorVersion, "1.0.0/passthrough-v1");
    assert.equal(row.processingLeaseExpiresAt, null);
    assert.equal(row.failureCode, null);
    assert.deepEqual([...h.publisher.objects.keys()], [`${row.storageKey}/scene.glb`]);
    const published = h.publisher.objects.get(`${row.storageKey}/scene.glb`)!;
    assert.deepEqual(Buffer.from(published.bytes), Buffer.from(bytes));
    assert.equal(published.cacheControl, "public, max-age=31536000, immutable");
  });

  it("panorama: generates the poster as a derived asset and records both dimensions", async () => {
    const h = harness(jpeg(4096, 2048), "EQUIRECT_JPEG", { posterGenerator: fakePosterGenerator });
    assert.equal((await h.run()).result, "COMPLETED");
    const row = h.row();
    assert.equal(row.status, "PENDING_REVIEW");
    assert.equal(row.format, "EQUIRECT_JPEG");
    assert.equal(row.fileCount, 2);
    assert.equal(row.posterKey, `${row.storageKey}/poster.webp`);
    assert.deepEqual(row.dimensions, { entry: { width: 4096, height: 2048 }, poster: { width: 1280, height: 640 } });
    assert.deepEqual([...h.publisher.objects.keys()].sort(), [`${row.storageKey}/panorama.jpg`, `${row.storageKey}/poster.webp`]);
  });

  it("SOG splat bundle → PENDING_REVIEW with splat metrics", async () => {
    const h = harness(sogBundle({ count: 400_000 }), "SOG");
    assert.equal((await h.run()).result, "COMPLETED");
    const row = h.row();
    assert.equal(row.format, "SOG");
    assert.equal(row.mimeType, "application/zip");
    assert.equal((row.metrics as Record<string, unknown>).gaussians, 400_000);
  });

  it("is deterministic: the same bytes give the same keys, record and manifest in a fresh run", async () => {
    const a = harness(jpeg(4096, 2048), "EQUIRECT_JPEG", { posterGenerator: fakePosterGenerator });
    const b = harness(jpeg(4096, 2048), "EQUIRECT_JPEG", { posterGenerator: fakePosterGenerator });
    await a.run();
    await b.run();
    const pick = (r: StoredRow) => ({ storageKey: r.storageKey, posterKey: r.posterKey, contentHash: r.contentHash, metrics: r.metrics, dimensions: r.dimensions });
    assert.deepEqual(pick(a.row()), pick(b.row()));
    assert.deepEqual([...a.publisher.objects.keys()], [...b.publisher.objects.keys()]);
  });
});

describe("worker: permanent failures → FAILED at once, never retried", () => {
  const failsWith = async (label: string, bytes: Uint8Array, format: MediaAssetFormat, code: string, options: Parameters<typeof harness>[2] = {}) => {
    const h = harness(bytes, format, options);
    const outcome = await h.run();
    assert.equal(outcome.result, "FAILED", label);
    assert.equal(outcome.result === "FAILED" && outcome.code, code, label);
    const row = h.row();
    assert.equal(row.status, "FAILED", label);
    assert.equal(row.failureCode, code, label);
    assert.ok(row.processingError?.startsWith(`${code}:`), label);
    assert.equal(row.processingLeaseExpiresAt, null, label);
    assert.equal(h.publisher.objects.size, 0, `${label}: nothing published`);
    assert.ok(acknowledges(outcome), `${label}: message deleted, not redelivered`);
    // A redelivery does nothing: no read, no write.
    const readsBefore = h.reader.reads.length;
    const writesBefore = h.store.writes.length;
    const again = await h.run();
    assert.equal(again.result, "SKIPPED", label);
    assert.equal(h.reader.reads.length, readsBefore, label);
    assert.equal(h.store.writes.length, writesBefore, label);
    return h;
  };

  it("invalid GLB → VALIDATION_FAILED", async () => {
    await failsWith("truncated header", new Uint8Array([...Buffer.from("glTF"), 2, 0, 0, 0, 99, 0, 0, 0]), "GLB", "VALIDATION_FAILED");
  });

  it("meshopt-compressed GLB → UNSUPPORTED_CONTENT", async () => {
    const f = triangleGltf();
    f.json.extensionsUsed = ["EXT_meshopt_compression"];
    f.json.extensionsRequired = ["EXT_meshopt_compression"];
    const h = await failsWith("meshopt", glbFrom(f), "GLB", "UNSUPPORTED_CONTENT");
    assert.match(h.row().processingError!, /gltf\.meshopt/);
  });

  it("external glTF URI → UNSUPPORTED_CONTENT, and the URI never reaches the logs or the public message", async () => {
    const f = triangleGltf();
    f.json.buffers = [{ uri: "https://attacker.example/model.bin", byteLength: 36 }];
    const h = await failsWith("external uri", glb(f.json), "GLB", "UNSUPPORTED_CONTENT");
    assert.match(h.row().processingError!, /gltf\.external-uri/, "internal diagnostic keeps the rule");
    assert.ok(!JSON.stringify(h.logs).includes("attacker.example"), "logs carry rule ids, not validator messages");
    assert.ok(!publicFailureMessage(h.row().failureCode).includes("attacker"));
    assert.ok(h.logs.some((l) => Array.isArray(l.rules) && (l.rules as string[]).includes("gltf.external-uri")));
  });

  it("content that does not match the declared format → UNSUPPORTED_CONTENT", async () => {
    await failsWith("jpeg bytes as GLB", jpeg(64, 32), "GLB", "UNSUPPORTED_CONTENT");
  });

  it("above the hard size limit → SIZE_LIMIT_EXCEEDED", async () => {
    await failsWith("13 MB panorama", jpeg(4096, 2048, { padTo: 13_000_000 }), "EQUIRECT_JPEG", "SIZE_LIMIT_EXCEEDED");
  });

  it("stored object differs from the verified checksum (same length) → SOURCE_INTEGRITY_FAILED", async () => {
    const bytes = validGlb();
    const tampered = Uint8Array.from(bytes);
    tampered[tampered.length - 1] ^= 0xff;
    const h = harness(bytes, "GLB", { stored: tampered });
    // The fake reports S3's checksum for the stored bytes, so the header check catches it first.
    const outcome = await h.run();
    assert.equal(outcome.result === "FAILED" && outcome.code, "SOURCE_INTEGRITY_FAILED");
  });

  it("S3 reports the right checksum but the bytes differ → SOURCE_INTEGRITY_FAILED (the worker re-hashes)", async () => {
    const bytes = validGlb();
    const h = harness(bytes, "GLB");
    const object = h.reader.objects.get(h.row().sourceKey)!;
    const tampered = Uint8Array.from(bytes);
    tampered[0] ^= 0x01;
    h.reader.objects.set(h.row().sourceKey, { head: object.head, bytes: tampered });
    const outcome = await h.run();
    assert.equal(outcome.result === "FAILED" && outcome.code, "SOURCE_INTEGRITY_FAILED");
    assert.match(h.row().processingError!, /SHA-256 differs/);
  });

  it("missing source → SOURCE_MISSING", async () => {
    await failsWith("missing", validGlb(), "GLB", "SOURCE_MISSING", { stored: null });
  });

  it("a row without a canonical stored checksum → INVALID_SOURCE, nothing read", async () => {
    const h = harness(validGlb(), "GLB", { row: { sourceChecksumSha256: null } });
    const outcome = await h.run();
    assert.equal(outcome.result === "FAILED" && outcome.code, "INVALID_SOURCE");
    assert.deepEqual(h.reader.reads, []);
  });

  it("an immutable key already holding different bytes → INTERNAL_ERROR, nothing overwritten", async () => {
    const bytes = validGlb();
    const h = harness(bytes, "GLB");
    const key = `${mediaVersionPrefix(MEDIA, deriveKeyHash(sha256Hex(bytes), "none"))}/scene.glb`;
    const other = new Uint8Array([1, 2, 3]);
    h.publisher.objects.set(key, { bytes: other, contentType: "model/gltf-binary", cacheControl: "x", sha256: sha256Hex(other) });
    const outcome = await h.run();
    assert.equal(outcome.result === "FAILED" && outcome.code, "INTERNAL_ERROR");
    assert.deepEqual(h.publisher.objects.get(key)!.bytes, other);
  });
});

describe("worker: transient failures → retry with the lease released, bounded by maxAttempts", () => {
  it("transient S3 failure → RETRY (message kept), then success on redelivery", async () => {
    const h = harness(validGlb(), "GLB");
    h.reader.unavailable = 1;
    const first = await h.run();
    assert.equal(first.result, "RETRY");
    assert.equal(acknowledges(first), false);
    assert.equal(h.row().status, "PROCESSING");
    assert.equal(h.row().processingAttempts, 1);
    assert.equal(h.row().processingLeaseExpiresAt, null, "lease released so the redelivery can claim at once");
    const second = await h.run();
    assert.equal(second.result, "COMPLETED");
    assert.equal(h.row().processingAttempts, 2);
  });

  it("transient failure on every attempt → FAILED RETRIES_EXHAUSTED on the last attempt", async () => {
    const h = harness(validGlb(), "GLB");
    h.reader.unavailable = 100;
    const results = [];
    for (let i = 0; i < PROCESSING_POLICY.maxAttempts; i++) results.push((await h.run()).result);
    assert.deepEqual(results, ["RETRY", "RETRY", "FAILED"]);
    assert.equal(h.row().failureCode, "RETRIES_EXHAUSTED");
    assert.equal(h.row().processingAttempts, PROCESSING_POLICY.maxAttempts);
    assert.equal((await h.run()).result, "SKIPPED");
  });

  it("transient publish failure → RETRY; the redelivery republishes nothing twice", async () => {
    const h = harness(validGlb(), "GLB");
    h.publisher.transientFailures = 1;
    assert.equal((await h.run()).result, "RETRY");
    assert.equal((await h.run()).result, "COMPLETED");
    assert.deepEqual(h.publisher.results.map((r) => r.result), ["created"]);
  });

  it("database unavailable before the claim → RETRY without touching the row", async () => {
    const h = harness(validGlb(), "GLB");
    h.store.findAsset = async () => {
      throw new Error("connection refused");
    };
    assert.equal((await h.run()).result, "RETRY");
    assert.equal(h.store.writes.length, 0);
  });

  it("an exhausted, unleased asset is failed by the next delivery instead of being retried forever", async () => {
    const h = harness(validGlb(), "GLB", { row: { processingAttempts: PROCESSING_POLICY.maxAttempts } });
    const outcome = await h.run();
    assert.equal(outcome.result === "FAILED" && outcome.code, "RETRIES_EXHAUSTED");
    assert.deepEqual(h.reader.reads, []);
  });
});

describe("worker: status gates and job trust", () => {
  const statuses: MediaAssetStatus[] = ["UPLOADED", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "FAILED", "ARCHIVED"];
  for (const status of statuses) {
    it(`${status} asset → SKIPPED with no claim, read, publish or write`, async () => {
      const h = harness(validGlb(), "GLB", { row: { status, processingStartedAt: status === "UPLOADED" ? null : new Date(), failureCode: status === "FAILED" ? "VALIDATION_FAILED" : null } });
      const outcome = await h.run();
      assert.equal(outcome.result, "SKIPPED");
      assert.ok(acknowledges(outcome));
      assert.equal(h.store.writes.length, 0);
      assert.deepEqual(h.reader.reads, []);
      assert.equal(h.publisher.objects.size, 0);
      assert.equal(h.row().status, status);
    });
  }

  it("a job naming a different source of the same asset is ignored (stale or forged)", async () => {
    const h = harness(validGlb(), "GLB");
    const stale = { ...h.job, sourceKey: `uploads/${MEDIA}/${"9".repeat(32)}/source.glb` };
    const outcome = await h.run(stale);
    assert.equal(outcome.result, "SKIPPED");
    assert.equal(h.store.writes.length, 0);
  });

  it("an unknown asset → SKIPPED", async () => {
    const h = harness(validGlb(), "GLB");
    const outcome = await h.run(buildProcessingJob({ id: "ffffffffffffffffffffffffffffffff", sourceKey: `uploads/ffffffffffffffffffffffffffffffff/${UPLOAD_ID}/source.glb` }, randomUUID(), new Date()));
    assert.equal(outcome.result, "SKIPPED");
  });

  it("an invalid job → REJECTED (left for the dead-letter queue), nothing read", async () => {
    const h = harness(validGlb(), "GLB");
    for (const body of ["not json", JSON.stringify({ ...h.job, status: "PUBLISHED" }), JSON.stringify({ ...h.job, schemaVersion: 2 })]) {
      const outcome = await h.run(body);
      assert.equal(outcome.result, "REJECTED");
      assert.equal(acknowledges(outcome), false);
    }
    assert.equal(h.store.writes.length, 0);
  });

  it("an asset leased by another worker → RETRY, nothing read", async () => {
    const h = harness(validGlb(), "GLB", { row: { processingAttempts: 1, processingLeaseExpiresAt: new Date(Date.parse("2026-09-19T10:05:00Z")) } });
    const outcome = await h.run();
    assert.equal(outcome.result, "RETRY");
    assert.deepEqual(h.reader.reads, []);
  });

  it("size, MIME type and checksum always come from the row, never the job", async () => {
    const h = harness(validGlb(), "GLB");
    await h.run();
    assert.deepEqual(Object.keys(h.job).sort(), ["dispatchedAt", "idempotencyKey", "jobId", "mediaAssetId", "processingVersion", "schemaVersion", "sourceKey"]);
  });
});

describe("worker: idempotency", () => {
  it("the same job twice: one COMPLETED, then SKIPPED; objects created once", async () => {
    const h = harness(jpeg(4096, 2048), "EQUIRECT_JPEG", { posterGenerator: fakePosterGenerator });
    assert.equal((await h.run()).result, "COMPLETED");
    assert.equal((await h.run()).result, "SKIPPED");
    assert.deepEqual(h.publisher.results.map((r) => r.result), ["created", "created"]);
  });

  it("the same job delivered concurrently: exactly one worker processes, the other retries later", async () => {
    const h = harness(validGlb(), "GLB");
    const results = (await Promise.all([h.run(), h.run(), h.run()])).map((o) => o.result).sort();
    assert.deepEqual(results, ["COMPLETED", "RETRY", "RETRY"]);
    assert.equal(h.row().processingAttempts, 1);
    assert.deepEqual(h.publisher.results.map((r) => r.result), ["created"]);
    assert.equal((await h.run()).result, "SKIPPED", "the redelivery finds the work done");
  });

  it("crash after derived objects were written but before the database update: the rerun finishes without overwriting", async () => {
    const h = harness(jpeg(4096, 2048), "EQUIRECT_JPEG", { posterGenerator: fakePosterGenerator });
    h.store.failNext = { op: "complete", error: new Error("connection terminated") };
    const crashed = await h.run();
    assert.equal(crashed.result, "RETRY");
    assert.equal(h.row().status, "PROCESSING");
    assert.equal(h.publisher.objects.size, 2, "derived objects exist");
    const snapshot = new Map([...h.publisher.objects].map(([k, v]) => [k, v.sha256]));
    // The lease is still held (no release after a failed write), so a redelivery must wait for it to lapse.
    assert.equal((await h.run()).result, "RETRY");
    h.clock.advance(PROCESSING_POLICY.leaseSeconds + 1);
    assert.equal((await h.run()).result, "COMPLETED");
    assert.equal(h.row().status, "PENDING_REVIEW");
    assert.equal(h.row().processingAttempts, 2);
    assert.deepEqual(new Map([...h.publisher.objects].map(([k, v]) => [k, v.sha256])), snapshot, "nothing overwritten");
    assert.deepEqual(h.publisher.results.map((r) => r.result), ["created", "created", "exists", "exists"]);
  });

  it("crash part-way through publishing, before any database update: the rerun completes the set", async () => {
    const h = harness(jpeg(4096, 2048), "EQUIRECT_JPEG", { posterGenerator: fakePosterGenerator });
    h.publisher.crashAfter = 1;
    h.store.failNext = { op: "release", error: new Error("process died") };
    assert.equal((await h.run()).result, "RETRY");
    assert.equal(h.publisher.objects.size, 1);
    h.publisher.crashAfter = null;
    h.clock.advance(PROCESSING_POLICY.leaseSeconds + 1);
    assert.equal((await h.run()).result, "COMPLETED");
    assert.deepEqual(h.publisher.results.map((r) => r.result), ["created", "exists", "created"]);
  });

  it("crash before anything was written: the rerun after the lease lapses processes normally", async () => {
    const h = harness(validGlb(), "GLB");
    h.reader.read = async () => {
      throw new Error("worker killed");
    };
    h.store.failNext = { op: "release", error: new Error("process died") };
    assert.equal((await h.run()).result, "RETRY");
    h.reader.read = FakeSourceReader.prototype.read.bind(h.reader);
    h.clock.advance(PROCESSING_POLICY.leaseSeconds + 1);
    assert.equal((await h.run()).result, "COMPLETED");
  });

  it("a slow worker that lost its lease cannot overwrite the newer outcome", async () => {
    const h = harness(validGlb(), "GLB");
    h.store.beforeWrite = (op) => {
      if (op === "complete") {
        // While this worker ran, its lease lapsed and another delivery claimed attempt 2.
        const r = h.store.get(MEDIA);
        h.store.rows.set(MEDIA, { ...r, processingAttempts: 2, processingLeaseExpiresAt: new Date(Date.now() + 60_000) });
        h.store.beforeWrite = null;
      }
    };
    const outcome = await h.run();
    assert.equal(outcome.result, "SKIPPED");
    assert.equal(h.row().status, "PROCESSING", "attempt 2 still owns the asset");
  });
});

describe("worker: observability", () => {
  it("logs one structured record per job with ids, attempt, version, duration, result and category; never URLs or content", async () => {
    const h = harness(validGlb(), "GLB");
    h.reader.unavailable = 1;
    await h.run();
    await h.run();
    const records = h.logs.filter((l) => l.event === "media.processing.job");
    assert.equal(records.length, 2);
    for (const r of records) {
      for (const field of ["mediaAssetId", "jobId", "attempt", "receiveCount", "processingVersion", "durationMs", "result", "errorCategory"]) assert.ok(field in r, field);
    }
    assert.deepEqual(records.map((r) => [r.result, r.attempt, r.status]), [["RETRY", 1, null], ["COMPLETED", 2, "PENDING_REVIEW"]]);
    assert.match(String(records[0].errorCategory), /source unavailable/);
    const text = JSON.stringify(h.logs);
    assert.ok(!/https?:\/\/|X-Amz-|glTF/.test(text));
  });
});
