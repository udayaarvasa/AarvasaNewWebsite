import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { COMPLETED_UPLOAD_STATUSES, MEDIA_ASSET_STATUSES, NOT_COMPLETABLE_STATUSES, type MediaAssetStatus } from "../../../shared/media-asset";
import {
  ACTOR_TRANSITIONS,
  assertTransition,
  buildProcessingJob,
  canTransition,
  MEDIA_ASSET_TRANSITIONS,
  MEDIA_FAILURE_CODES,
  parseProcessingJob,
  PROCESSING_JOB_MAX_BYTES,
  PROCESSING_POLICY,
  PROCESSING_VERSION,
  PUBLIC_FAILURE_MESSAGES,
  publicFailureMessage,
  serializeProcessingJob,
  type LifecycleActor,
} from "../../../shared/media-processing";
import { DEV_DEFAULTS } from "../../src/config";
import { PIPELINE_VERSION, PROCESSING_PROFILE } from "../../src/pipeline/process";

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const KEY = `uploads/${MEDIA}/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.glb`;
const NOW = new Date("2026-09-19T10:00:00.000Z");
const job = () => buildProcessingJob({ id: MEDIA, sourceKey: KEY }, randomUUID(), NOW);

describe("processing job contract", () => {
  it("serializes deterministically and round-trips", () => {
    const j = job();
    const body = serializeProcessingJob(j);
    assert.deepEqual(Object.keys(JSON.parse(body)), ["schemaVersion", "jobId", "mediaAssetId", "sourceKey", "processingVersion", "idempotencyKey", "dispatchedAt"]);
    assert.equal(serializeProcessingJob({ ...j }), body);
    assert.deepEqual(parseProcessingJob(body), { ok: true, job: j });
    assert.ok(body.length < PROCESSING_JOB_MAX_BYTES);
  });

  it("carries identifiers only: no owner, subject, status, MIME type, size, checksum or output key", () => {
    const fields = Object.keys(job());
    for (const forbidden of ["ownerId", "uploadedById", "subjectType", "propertyId", "projectSlug", "status", "sourceMimeType", "mimeType", "sourceSizeBytes", "sizeBytes", "sourceChecksumSha256", "contentHash", "storageKey", "posterKey", "bucket", "url"]) {
      assert.ok(!fields.includes(forbidden), forbidden);
    }
  });

  it("uses the pipeline's own version and a deterministic idempotency key", () => {
    assert.equal(PROCESSING_VERSION, `${PIPELINE_VERSION}/${PROCESSING_PROFILE}`);
    const a = job();
    const b = job();
    assert.notEqual(a.jobId, b.jobId, "jobId is per dispatch");
    assert.equal(a.idempotencyKey, b.idempotencyKey);
    assert.equal(a.idempotencyKey, `${MEDIA}:${PROCESSING_VERSION}`);
  });

  it("rejects anything that is not exactly a valid job", () => {
    const body = JSON.parse(serializeProcessingJob(job())) as Record<string, unknown>;
    const cases: Array<[string, unknown]> = [
      ["not a string", body],
      ["not JSON", "{job"],
      ["array", "[]"],
      ["null", "null"],
      ["too large", JSON.stringify({ ...body, pad: "x".repeat(PROCESSING_JOB_MAX_BYTES) })],
      ["extra status", JSON.stringify({ ...body, status: "PUBLISHED" })],
      ["extra checksum", JSON.stringify({ ...body, sourceChecksumSha256: "x" })],
      ["extra owner", JSON.stringify({ ...body, ownerId: "attacker" })],
      ["missing field", JSON.stringify({ ...body, jobId: undefined })],
      ["schema v2", JSON.stringify({ ...body, schemaVersion: 2 })],
      ["schema as string", JSON.stringify({ ...body, schemaVersion: "1" })],
      ["other processing version", JSON.stringify({ ...body, processingVersion: "2.0.0/optimize-v1" })],
      ["bad jobId", JSON.stringify({ ...body, jobId: "1" })],
      ["uppercase id", JSON.stringify({ ...body, mediaAssetId: MEDIA.toUpperCase() })],
      ["another asset's key", JSON.stringify({ ...body, sourceKey: KEY.replace(MEDIA, "ffffffffffffffffffffffffffffffff") })],
      ["originals key", JSON.stringify({ ...body, sourceKey: `originals/${MEDIA}/de1d54d4e9da0d02/x.glb` })],
      ["published key", JSON.stringify({ ...body, sourceKey: `m/${MEDIA}/de1d54d4e9da0d02/scene.glb` })],
      ["traversal", JSON.stringify({ ...body, sourceKey: `uploads/${MEDIA}/../x/source.glb` })],
      ["forged idempotency key", JSON.stringify({ ...body, idempotencyKey: "anything" })],
      ["non-ISO date", JSON.stringify({ ...body, dispatchedAt: "yesterday" })],
      ["non-canonical date", JSON.stringify({ ...body, dispatchedAt: "2026-09-19T10:00:00Z" })],
    ];
    for (const [label, value] of cases) assert.equal(parseProcessingJob(value).ok, false, label);
  });

  it("refuses to build a job from invalid identifiers", () => {
    assert.throws(() => buildProcessingJob({ id: MEDIA, sourceKey: "m/x/y/scene.glb" }, randomUUID(), NOW), /invalid processing job/);
    assert.throws(() => buildProcessingJob({ id: MEDIA, sourceKey: KEY }, "not-a-uuid", NOW), /invalid processing job/);
  });
});

describe("lifecycle state machine", () => {
  it("defines transitions for every status and never introduces VERIFIED", () => {
    assert.deepEqual(Object.keys(MEDIA_ASSET_TRANSITIONS).sort(), [...MEDIA_ASSET_STATUSES].sort());
    assert.ok(!(MEDIA_ASSET_STATUSES as readonly string[]).includes("VERIFIED"));
    for (const targets of Object.values(MEDIA_ASSET_TRANSITIONS)) for (const t of targets) assert.ok(MEDIA_ASSET_STATUSES.includes(t));
  });

  it("allows exactly the documented changes", () => {
    const allowed = MEDIA_ASSET_STATUSES.flatMap((from) => MEDIA_ASSET_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}→${to}`));
    assert.deepEqual(allowed.sort(), [
      "FAILED→ARCHIVED",
      "PENDING_REVIEW→ARCHIVED",
      "PENDING_REVIEW→PUBLISHED",
      "PENDING_REVIEW→REJECTED",
      "PROCESSING→FAILED",
      "PROCESSING→PENDING_REVIEW",
      "PUBLISHED→ARCHIVED",
      "REJECTED→ARCHIVED",
      "UPLOADED→FAILED",
      "UPLOADED→PROCESSING",
    ]);
  });

  it("rejects invalid transitions, including skipping review and leaving terminal states", () => {
    for (const [from, to] of [["PROCESSING", "PUBLISHED"], ["UPLOADED", "PENDING_REVIEW"], ["FAILED", "PROCESSING"], ["PUBLISHED", "PENDING_REVIEW"], ["ARCHIVED", "PUBLISHED"], ["PENDING_REVIEW", "PROCESSING"]] as const) {
      assert.equal(canTransition(from, to), false, `${from}→${to}`);
    }
  });

  it("limits each component to its own transitions: the worker can never publish", () => {
    const pairs = (actor: LifecycleActor) => ACTOR_TRANSITIONS[actor].map(([f, t]) => `${f}→${t}`);
    assert.deepEqual(pairs("PROCESSING_WORKER"), ["PROCESSING→PENDING_REVIEW", "PROCESSING→FAILED"]);
    assert.deepEqual(pairs("SWEEPER"), ["UPLOADED→FAILED", "PROCESSING→FAILED"]);
    assert.deepEqual(pairs("UPLOAD_COMPLETION"), ["UPLOADED→PROCESSING", "UPLOADED→FAILED"]);
    assert.throws(() => assertTransition("PROCESSING_WORKER", "PROCESSING", "PUBLISHED"), /Lifecycle violation/);
    assert.throws(() => assertTransition("PROCESSING_WORKER", "PENDING_REVIEW", "PUBLISHED"), /Lifecycle violation/);
    assert.throws(() => assertTransition("SWEEPER", "PENDING_REVIEW", "FAILED"), /Lifecycle violation/);
    assert.doesNotThrow(() => assertTransition("PROCESSING_WORKER", "PROCESSING", "PENDING_REVIEW"));
    for (const [actor, list] of Object.entries(ACTOR_TRANSITIONS)) for (const [f, t] of list) assert.ok(canTransition(f, t), `${actor} ${f}→${t}`);
  });

  it("stays compatible with Phase 5B's completion statuses", () => {
    const after: MediaAssetStatus[] = ["PROCESSING", "PENDING_REVIEW", "PUBLISHED", "REJECTED"];
    assert.deepEqual([...COMPLETED_UPLOAD_STATUSES], after);
    assert.deepEqual([...NOT_COMPLETABLE_STATUSES], ["FAILED", "ARCHIVED"]);
  });
});

describe("failure codes", () => {
  it("has a generic public message for every code, with no internal detail", () => {
    assert.deepEqual(Object.keys(PUBLIC_FAILURE_MESSAGES).sort(), [...MEDIA_FAILURE_CODES].sort());
    for (const message of Object.values(PUBLIC_FAILURE_MESSAGES)) assert.doesNotMatch(message, /gltf|sha|s3|bucket|key|http|meshopt|uploads\//i);
    assert.equal(publicFailureMessage("NOT_A_CODE"), publicFailureMessage(null));
  });
});

describe("timing policy", () => {
  it("orders worker run < lease < visibility, and DB attempts < SQS receives", () => {
    const p = PROCESSING_POLICY;
    assert.ok(p.workerTimeoutSeconds < p.leaseSeconds);
    assert.ok(p.leaseSeconds < p.queueVisibilityTimeoutSeconds);
    assert.ok(p.maxAttempts < p.queueMaxReceiveCount, "the database, not the DLQ, decides when retries end");
    assert.ok(p.redispatchAfterSeconds >= p.queueVisibilityTimeoutSeconds, "no redispatch while a delivery may be in flight");
    assert.ok(p.maxAttempts * p.queueVisibilityTimeoutSeconds < p.processingTimeoutSeconds);
  });

  it("keeps every deadline far inside the 7-day ingest lifecycle, which the CDK config really sets", () => {
    const p = PROCESSING_POLICY;
    assert.equal(p.ingestRetentionDays, DEV_DEFAULTS.ingest.expireAfterDays);
    const retention = p.ingestRetentionDays * 86_400;
    for (const seconds of [p.processingTimeoutSeconds, p.uploadAbandonedAfterSeconds, p.queueRetentionSeconds]) assert.ok(seconds < retention);
    assert.ok(p.deadLetterRetentionSeconds > p.queueRetentionSeconds);
  });
});
