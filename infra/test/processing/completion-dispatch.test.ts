import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { parseProcessingJob, serializeProcessingJob, type ProcessingJob } from "../../../shared/media-processing";
import { handleUploadCompletion, type CompletionMediaAsset, type UploadCompletionDependencies } from "../../../src/lib/services/media-completion.service";

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const KEY = `uploads/${MEDIA}/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.glb`;
const SHA = createHash("sha256").update("pilot bytes").digest("base64");
const NOW = new Date("2026-09-19T10:05:00.000Z");

function harness(options: { head?: Record<string, unknown>; dispatchError?: Error } = {}) {
  let row: CompletionMediaAsset & { processingStartedAt?: Date } = {
    id: MEDIA, subjectType: "PROPERTY", propertyId: "prop-1", projectSlug: null, kind: "MODEL", status: "UPLOADED",
    sourceKey: KEY, sourceSizeBytes: 1840, sourceMimeType: "model/gltf-binary", sourceChecksumSha256: SHA, uploadedById: "owner",
    createdAt: new Date(NOW.getTime() - 60_000),
  };
  const events: string[] = [];
  const sent: ProcessingJob[] = [];
  const failed: Array<{ code: string }> = [];
  const deps: UploadCompletionDependencies = {
    store: {
      findUser: async (id) => (id === "owner" ? { id, role: "USER" } : null),
      findMediaAsset: async () => ({ ...row }),
      findPropertyOwner: async () => ({ ownerId: "owner" }),
      transitionToProcessing: async (_id, _v, _a, startedAt) => {
        if (row.status !== "UPLOADED") return 0;
        row = { ...row, status: "PROCESSING", processingStartedAt: startedAt };
        events.push("committed");
        return 1;
      },
      markFailed: async (_id, _k, _e, _a, failureCode) => {
        failed.push({ code: failureCode });
        row = { ...row, status: "FAILED" };
        return 1;
      },
    },
    getInspector: () => ({
      inspect: async () => ({ status: "FOUND", head: { contentLength: 1840, contentType: "model/gltf-binary", checksumSha256: SHA, checksumType: "FULL_OBJECT", serverSideEncryption: "AES256", ...options.head } }),
    }),
    projectExists: () => true,
    now: () => NOW,
    log: (message) => events.push(`log:${message}`),
    dispatchProcessing: async (job) => {
      events.push("dispatch");
      if (options.dispatchError) throw options.dispatchError;
      sent.push(job);
    },
    newJobId: () => randomUUID(),
  };
  const complete = () => handleUploadCompletion({ caller: { id: "owner" }, mediaAssetId: MEDIA, contentType: "application/json", contentLength: 2, readBody: async () => ({}) }, deps);
  return { complete, events, sent, failed, row: () => row };
}

describe("upload completion → processing handoff", () => {
  it("dispatches one job only after UPLOADED → PROCESSING has committed, and records processingStartedAt", async () => {
    const h = harness();
    const result = await h.complete();
    assert.equal(result.status, 200);
    assert.deepEqual(h.events.filter((e) => !e.startsWith("log:")), ["committed", "dispatch"]);
    assert.equal(h.sent.length, 1);
    assert.equal(h.sent[0].mediaAssetId, MEDIA);
    assert.equal(h.sent[0].sourceKey, KEY);
    assert.ok(parseProcessingJob(serializeProcessingJob(h.sent[0])).ok);
    assert.deepEqual(h.row().processingStartedAt, NOW);
  });

  it("does not dispatch again when the asset was already completed", async () => {
    const h = harness();
    await h.complete();
    await h.complete();
    assert.equal(h.sent.length, 1);
  });

  it("a failed dispatch is logged and left to the sweeper; the completion still succeeds", async () => {
    const h = harness({ dispatchError: new Error("queue unavailable") });
    const result = await h.complete();
    assert.equal(result.status, 200);
    assert.equal(h.row().status, "PROCESSING");
    assert.ok(h.events.some((e) => e.includes("sweeper will re-send")));
  });

  it("never dispatches for a verification failure, and records its failure code", async () => {
    const h = harness({ head: { contentLength: 1 } });
    const result = await h.complete();
    assert.equal(result.status, 422);
    assert.equal(h.sent.length, 0);
    assert.deepEqual(h.failed, [{ code: "UPLOAD_VERIFICATION_FAILED" }]);
  });
});
