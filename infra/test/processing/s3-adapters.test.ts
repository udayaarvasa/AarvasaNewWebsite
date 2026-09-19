import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import { ImmutableObjectConflictError, RetryableProcessingError } from "../../src/processing/errors";
import { createS3ObjectPublisher, createS3SourceReader } from "../../src/processing/s3-adapters";

/** Offline: every request goes to a stub transport with fake credentials. Nothing reaches AWS. */
const credentials = { accessKeyId: "TESTONLYACCESSKEYID", secretAccessKey: "test-only-secret-not-a-real-key" };
type Req = { method: string; hostname: string; path: string; headers: Record<string, string>; query: Record<string, unknown>; body?: unknown };
type Res = { statusCode: number; headers?: Record<string, string>; body?: Uint8Array };

function stub(responses: Res[]) {
  const requests: Req[] = [];
  const requestHandler = {
    handle: async (request: Req) => {
      requests.push({ method: request.method, hostname: request.hostname, path: request.path, headers: request.headers, query: request.query, body: request.body });
      const r = responses.shift() ?? { statusCode: 500 };
      return { response: { statusCode: r.statusCode, headers: r.headers ?? {}, body: Readable.from(r.body ? [Buffer.from(r.body)] : []) } };
    },
  };
  return { requests, options: { credentials, requestHandler: requestHandler as never, maxAttempts: 1 } };
}

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const KEY = `uploads/${MEDIA}/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.glb`;
const BYTES = new Uint8Array(Buffer.from("glTF source bytes for the adapter test"));
const B64 = createHash("sha256").update(BYTES).digest("base64");
const HEX = createHash("sha256").update(BYTES).digest("hex");
const PUBLISHED_KEY = `m/${MEDIA}/de1d54d4e9da0d02/scene.glb`;
const ingest = { region: "ap-south-1", bucket: "example-ingest-bucket" };
const published = { region: "ap-south-1", bucket: "example-published-bucket" };
const objectHeaders = (overrides: Record<string, string> = {}) => ({
  "content-length": String(BYTES.length),
  "content-type": "model/gltf-binary",
  "x-amz-checksum-sha256": B64,
  "x-amz-checksum-type": "FULL_OBJECT",
  "x-amz-server-side-encryption": "AES256",
  ...overrides,
});

describe("S3 source reader (GetObject, offline)", () => {
  it("GETs exactly the ingest key with ChecksumMode ENABLED and returns bytes and headers", async () => {
    const s = stub([{ statusCode: 200, headers: objectHeaders(), body: BYTES }]);
    const result = await createS3SourceReader(ingest, s.options).read(KEY, BYTES.length);
    assert.equal(s.requests[0].method, "GET");
    assert.equal(s.requests[0].hostname, "example-ingest-bucket.s3.ap-south-1.amazonaws.com");
    assert.equal(decodeURIComponent(s.requests[0].path), `/${KEY}`);
    assert.equal(s.requests[0].headers["x-amz-checksum-mode"], "ENABLED");
    assert.equal(result.status, "FOUND");
    assert.deepEqual(result.status === "FOUND" && Buffer.from(result.bytes!), Buffer.from(BYTES));
    assert.equal(result.status === "FOUND" && result.head.checksumSha256, B64);
  });

  it("does not read a body whose length differs from the verified size", async () => {
    const s = stub([{ statusCode: 200, headers: objectHeaders({ "content-length": String(BYTES.length + 1) }), body: new Uint8Array(BYTES.length + 1) }]);
    const result = await createS3SourceReader(ingest, s.options).read(KEY, BYTES.length);
    assert.equal(result.status === "FOUND" && result.bytes, null);
  });

  it("maps 404 to NOT_FOUND and 403/5xx/throttling/network to UNAVAILABLE", async () => {
    assert.deepEqual(await createS3SourceReader(ingest, stub([{ statusCode: 404 }]).options).read(KEY, 1), { status: "NOT_FOUND" });
    for (const statusCode of [403, 500, 503]) {
      const result = await createS3SourceReader(ingest, stub([{ statusCode }]).options).read(KEY, 1);
      assert.equal(result.status, "UNAVAILABLE", String(statusCode));
    }
    const failing = { credentials, maxAttempts: 1, requestHandler: { handle: async () => { throw Object.assign(new Error("ECONNRESET"), { name: "NetworkingError" }); } } as never };
    assert.deepEqual(await createS3SourceReader(ingest, failing).read(KEY, 1), { status: "UNAVAILABLE", reason: "NetworkingError" });
  });

  it("refuses keys outside the ingest source layout before any request", async () => {
    const s = stub([]);
    for (const key of [`originals/${MEDIA}/de1d54d4e9da0d02/x.glb`, PUBLISHED_KEY, `uploads/${MEDIA}/x/../source.glb`]) {
      await assert.rejects(createS3SourceReader(ingest, s.options).read(key, 1), /Refusing/);
    }
    assert.equal(s.requests.length, 0);
  });
});

describe("S3 object publisher (write-once PutObject, offline)", () => {
  const object = { key: PUBLISHED_KEY, bytes: BYTES, contentType: "model/gltf-binary", cacheControl: "public, max-age=31536000, immutable", sha256: HEX };

  it("PUTs with If-None-Match: *, the SHA-256, Content-Type and Cache-Control", async () => {
    const s = stub([{ statusCode: 200 }]);
    assert.equal(await createS3ObjectPublisher(published, s.options).publish(object), "created");
    const put = s.requests[0];
    assert.equal(put.method, "PUT");
    assert.equal(put.hostname, "example-published-bucket.s3.ap-south-1.amazonaws.com");
    assert.equal(decodeURIComponent(put.path), `/${PUBLISHED_KEY}`);
    assert.equal(put.headers["if-none-match"], "*");
    assert.equal(put.headers["x-amz-checksum-sha256"], B64);
    assert.equal(put.headers["content-type"], "model/gltf-binary");
    assert.equal(put.headers["cache-control"], "public, max-age=31536000, immutable");
  });

  it("412 with identical stored content → exists (idempotent rerun)", async () => {
    const s = stub([{ statusCode: 412 }, { statusCode: 200, headers: objectHeaders() }]);
    assert.equal(await createS3ObjectPublisher(published, s.options).publish(object), "exists");
    assert.equal(s.requests[1].method, "HEAD");
    assert.equal(s.requests[1].headers["x-amz-checksum-mode"], "ENABLED");
  });

  it("412 with different stored content → ImmutableObjectConflictError, never an overwrite", async () => {
    const other = createHash("sha256").update("other").digest("base64");
    const s = stub([{ statusCode: 412 }, { statusCode: 200, headers: objectHeaders({ "x-amz-checksum-sha256": other }) }]);
    await assert.rejects(createS3ObjectPublisher(published, s.options).publish(object), ImmutableObjectConflictError);
    assert.equal(s.requests.filter((r) => r.method === "PUT").length, 1);
  });

  it("409/5xx/403 → RetryableProcessingError", async () => {
    for (const statusCode of [409, 500, 503, 403]) {
      await assert.rejects(createS3ObjectPublisher(published, stub([{ statusCode }]).options).publish(object), RetryableProcessingError, String(statusCode));
    }
  });

  it("refuses keys outside m/, wrong metadata and bytes that do not match their hash, before any request", async () => {
    const s = stub([]);
    const p = createS3ObjectPublisher(published, s.options);
    for (const bad of [
      { ...object, key: `originals/${MEDIA}/de1d54d4e9da0d02/scene.glb` },
      { ...object, key: `lib/draco/1.5.7/draco.js`, contentType: "text/javascript" },
      { ...object, key: `uploads/${MEDIA}/x/source.glb` },
      { ...object, key: `m/${MEDIA}/de1d54d4e9da0d02/scene.html` },
      { ...object, contentType: "text/html" },
      { ...object, cacheControl: "no-cache" },
      { ...object, sha256: "0".repeat(64) },
    ]) {
      await assert.rejects(p.publish(bad), /Refusing/, bad.key);
    }
    assert.equal(s.requests.length, 0);
  });
});
