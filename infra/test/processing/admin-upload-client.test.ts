import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { describe, it } from "node:test";
import { AdminUploadError, apiErrorMessage, checkUploadFile, runAdminUpload, type UploadFile, type UploadTransport } from "../../../src/lib/media/admin-upload-client";

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const BYTES = Buffer.from("glTF pilot bytes for the admin upload flow");
const SHA = createHash("sha256").update(BYTES).digest("base64");
const file = (name = "tower.glb", bytes: Uint8Array = BYTES, type = ""): UploadFile => ({
  name,
  size: bytes.length,
  type,
  arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
});

function transport(options: { intentStatus?: number; putStatus?: number; complete?: Array<{ status: number; body: unknown }> } = {}) {
  const calls: Array<{ kind: string; url: string; body?: unknown; headers?: Record<string, string> }> = [];
  const complete = options.complete ?? [{ status: 200, body: { success: true, data: { mediaAssetId: MEDIA, status: "PROCESSING", transitioned: true } } }];
  const t: UploadTransport = {
    async fetchJson(url, init) {
      calls.push({ kind: "json", url, body: init.body });
      if (url === "/api/media/upload-intent") {
        return options.intentStatus && options.intentStatus !== 201
          ? { status: options.intentStatus, body: { success: false, error: [{ path: "sha256", message: "sha256 must be a base64 SHA-256 digest" }] } }
          : { status: 201, body: { success: true, data: { mediaAssetId: MEDIA, upload: { method: "PUT", url: "https://bucket.s3.ap-south-1.amazonaws.com/uploads/x?X-Amz-Signature=s", headers: { "Content-Type": "model/gltf-binary", "x-amz-checksum-sha256": SHA } } } } };
      }
      return complete.shift() ?? { status: 500, body: {} };
    },
    async put(url, headers, f, onProgress) {
      calls.push({ kind: "put", url, headers: { ...headers } });
      onProgress(f.size / 2, f.size);
      onProgress(f.size, f.size);
      return { status: options.putStatus ?? 200 };
    },
    digestSha256: (data) => webcrypto.subtle.digest("SHA-256", data),
    sleep: async () => undefined,
  };
  return { t, calls };
}

describe("admin upload flow (browser side, offline)", () => {
  it("hashes, requests an intent with only client-owned fields, PUTs directly to S3, then completes", async () => {
    const { t, calls } = transport();
    const stages: string[] = [];
    const result = await runAdminUpload({ target: { subjectType: "PROPERTY", propertyId: "prop-1" }, format: "GLB", file: file(), title: " Tower ", altText: "A tower" }, t, (s) => stages.push(s));
    assert.deepEqual(result, { mediaAssetId: MEDIA, status: "PROCESSING" });
    assert.deepEqual(calls.map((c) => `${c.kind} ${c.url.split("?")[0]}`), [
      "json /api/media/upload-intent",
      "put https://bucket.s3.ap-south-1.amazonaws.com/uploads/x",
      `json /api/media/${MEDIA}/complete`,
    ]);
    assert.deepEqual(calls[0].body, { subjectType: "PROPERTY", propertyId: "prop-1", kind: "MODEL", expectedFormat: "GLB", filename: "tower.glb", sourceSizeBytes: BYTES.length, sha256: SHA, title: "Tower", altText: "A tower" });
    assert.deepEqual(calls[1].headers, { "Content-Type": "model/gltf-binary", "x-amz-checksum-sha256": SHA }, "exactly the signed headers");
    assert.deepEqual(calls[2].body, {});
    assert.deepEqual([...new Set(stages)], ["hashing", "authorizing", "uploading", "completing", "done"]);
  });

  it("never sends keys, status, checksum overrides or ownership", async () => {
    const { t, calls } = transport();
    await runAdminUpload({ target: { subjectType: "PROJECT", projectSlug: "reef-996-dubai-production-city" }, format: "EQUIRECT_JPEG", file: file("pano.JPEG", BYTES, "image/jpeg") }, t);
    const intent = calls[0].body as Record<string, unknown>;
    assert.deepEqual(Object.keys(intent).sort(), ["expectedFormat", "filename", "kind", "projectSlug", "sha256", "sourceMimeType", "sourceSizeBytes", "subjectType"]);
    assert.equal(intent.sourceMimeType, "image/jpeg");
  });

  it("omits a browser MIME type the format does not accept (the server derives the real one)", async () => {
    const { t, calls } = transport();
    await runAdminUpload({ target: { subjectType: "PROPERTY", propertyId: "p" }, format: "GLB", file: file("m.glb", BYTES, "text/plain") }, t);
    assert.ok(!("sourceMimeType" in (calls[0].body as object)));
  });

  it("pre-checks extension, empty and oversized files before any request", async () => {
    assert.match(checkUploadFile("GLB", { name: "a.gltf", size: 10 }) ?? "", /\.glb/);
    assert.match(checkUploadFile("GLB", { name: "a.glb", size: 0 }) ?? "", /empty/);
    assert.match(checkUploadFile("EQUIRECT_JPEG", { name: "a.jpg", size: 50_000_001 }) ?? "", /larger than 50 MB/);
    assert.match(checkUploadFile("GLB", { name: "a.glb", size: 100_000_001 }) ?? "", /larger than 100 MB/);
    const { t, calls } = transport();
    await assert.rejects(runAdminUpload({ target: { subjectType: "PROPERTY", propertyId: "p" }, format: "GLB", file: file("a.obj") }, t), AdminUploadError);
    assert.equal(calls.length, 0);
  });

  it("surfaces the API's validation message, and stops after a failed intent or PUT", async () => {
    const bad = transport({ intentStatus: 400 });
    await assert.rejects(runAdminUpload({ target: { subjectType: "PROPERTY", propertyId: "p" }, format: "GLB", file: file() }, bad.t), /sha256 must be a base64/);
    assert.equal(bad.calls.length, 1);
    const put = transport({ putStatus: 403 });
    await assert.rejects(runAdminUpload({ target: { subjectType: "PROPERTY", propertyId: "p" }, format: "GLB", file: file() }, put.t), /could not be uploaded/);
    assert.ok(!put.calls.some((c) => c.url.endsWith("/complete")));
  });

  it("retries completion only while the upload is not visible yet, then gives a clear error", async () => {
    const notYet = { status: 409, body: { success: false, error: "The upload has not been received yet.", code: "UPLOAD_NOT_FOUND", retryable: true } };
    const ok = { status: 200, body: { success: true, data: { status: "PROCESSING" } } };
    const eventually = transport({ complete: [notYet, notYet, ok] });
    assert.equal((await runAdminUpload({ target: { subjectType: "PROPERTY", propertyId: "p" }, format: "GLB", file: file() }, eventually.t)).status, "PROCESSING");
    const failed = transport({ complete: [{ status: 422, body: { success: false, error: "The uploaded file could not be verified. Please upload it again.", code: "UPLOAD_VERIFICATION_FAILED", retryable: false } }] });
    await assert.rejects(runAdminUpload({ target: { subjectType: "PROPERTY", propertyId: "p" }, format: "GLB", file: file() }, failed.t), /could not be verified/);
    assert.equal(failed.calls.filter((c) => c.url.endsWith("/complete")).length, 1, "a permanent failure is not retried");
  });

  it("formats API errors safely", () => {
    assert.equal(apiErrorMessage({ error: "Forbidden" }, "x"), "Forbidden");
    assert.equal(apiErrorMessage({ error: [{ message: "a" }, { message: "b" }] }, "x"), "a; b");
    assert.equal(apiErrorMessage(null, "fallback"), "fallback");
  });
});
