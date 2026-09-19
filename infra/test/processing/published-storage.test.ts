import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, it } from "node:test";
import {
  CDN_PREFIXES,
  PUBLISHED_BUCKET_PREFIXES,
  publishedKeyFor,
  publishedObjectMetadata,
  REVIEW_CACHE_CONTROL,
  reviewKeyFor,
  reviewObjectMetadata,
} from "../../../shared/media-contract";
import {
  createReviewAccess,
  createWriteOncePublisher,
  ImmutableObjectConflictError,
  readPublishedStorageConfig,
  RetryableProcessingError,
  REVIEW_PREVIEW_MAX_SECONDS,
  ReviewCopyMissingError,
} from "../../../src/lib/media/published-storage";

const MEDIA = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
const HASH = "de1d54d4e9da0d02";
const M_KEY = `m/${MEDIA}/${HASH}/scene.glb`;
const R_KEY = `review/${MEDIA}/${HASH}/scene.glb`;
const BYTES = new Uint8Array(Buffer.from("glTF published bytes"));
const HEX = createHash("sha256").update(BYTES).digest("hex");
const B64 = createHash("sha256").update(BYTES).digest("base64");
const config = { region: "ap-south-1", bucket: "example-published-bucket" };
const credentials = { accessKeyId: "TESTONLYACCESSKEYID", secretAccessKey: "test-only-secret-not-a-real-key" };

type Req = { method: string; path: string; headers: Record<string, string>; query: Record<string, unknown> };
function stub(responses: Array<{ statusCode: number; headers?: Record<string, string>; body?: Uint8Array }>) {
  const requests: Req[] = [];
  const requestHandler = {
    handle: async (req: Req & { body?: unknown }) => {
      requests.push({ method: req.method, path: decodeURIComponent(req.path), headers: req.headers, query: req.query });
      // Drain a streamed request body, as a real transport would.
      if (req.body && typeof (req.body as Readable).on === "function") for await (const _ of req.body as Readable) void _;
      const r = responses.shift() ?? { statusCode: 500 };
      return { response: { statusCode: r.statusCode, headers: r.headers ?? {}, body: Readable.from(r.body ? [Buffer.from(r.body)] : []) } };
    },
  };
  return { requests, options: { credentials, requestHandler: requestHandler as never, maxAttempts: 1 } };
}
const objectHeaders = (overrides: Record<string, string> = {}) => ({
  "content-length": String(BYTES.length),
  "content-type": "model/gltf-binary",
  "x-amz-checksum-sha256": B64,
  "x-amz-checksum-type": "FULL_OBJECT",
  ...overrides,
});

describe("storage contract: private review prefix", () => {
  it("is a published-bucket prefix that the CDN never serves", () => {
    assert.ok((PUBLISHED_BUCKET_PREFIXES as readonly string[]).includes("review"));
    assert.ok(!(CDN_PREFIXES as readonly string[]).includes("review"));
    assert.equal(publishedObjectMetadata(R_KEY), null, "review keys are not CDN-publishable");
  });

  it("maps m/ ↔ review/ keys one-to-one and refuses everything else", () => {
    assert.equal(reviewKeyFor(M_KEY), R_KEY);
    assert.equal(publishedKeyFor(R_KEY), M_KEY);
    for (const bad of [`originals/${MEDIA}/${HASH}/x.glb`, `uploads/${MEDIA}/x/source.glb`, `m/${MEDIA}/${HASH}/../x.glb`, `lib/draco/1.5.7/draco.js`]) {
      assert.throws(() => reviewKeyFor(bad));
      assert.throws(() => publishedKeyFor(bad));
    }
    assert.deepEqual(reviewObjectMetadata(R_KEY), { contentType: "model/gltf-binary", cacheControl: REVIEW_CACHE_CONTROL });
    assert.equal(reviewObjectMetadata(`review/${MEDIA}/${HASH}/scene.html`), null);
  });
});

describe("write-once publisher", () => {
  it("writes review copies with private, uncacheable metadata and If-None-Match", async () => {
    const s = stub([{ statusCode: 200 }]);
    const result = await createWriteOncePublisher(config, s.options).publish({ key: R_KEY, bytes: BYTES, contentType: "model/gltf-binary", cacheControl: REVIEW_CACHE_CONTROL, sha256: HEX });
    assert.equal(result, "created");
    assert.equal(s.requests[0].path, `/${R_KEY}`);
    assert.equal(s.requests[0].headers["if-none-match"], "*");
    assert.equal(s.requests[0].headers["cache-control"], "private, no-store");
    assert.equal(s.requests[0].headers["x-amz-checksum-sha256"], B64);
  });

  it("refuses review keys with CDN cache headers, and m/ keys with review headers", async () => {
    const p = createWriteOncePublisher(config, stub([]).options);
    await assert.rejects(p.publish({ key: R_KEY, bytes: BYTES, contentType: "model/gltf-binary", cacheControl: "public, max-age=31536000, immutable", sha256: HEX }), /Refusing/);
    await assert.rejects(p.publish({ key: M_KEY, bytes: BYTES, contentType: "model/gltf-binary", cacheControl: REVIEW_CACHE_CONTROL, sha256: HEX }), /Refusing/);
    await assert.rejects(p.publish({ key: `originals/${MEDIA}/${HASH}/scene.glb`, bytes: BYTES, contentType: "model/gltf-binary", cacheControl: REVIEW_CACHE_CONTROL, sha256: HEX }), /Refusing/);
  });
});

describe("review access (preview + publication)", () => {
  it("presigns short-lived GETs for review copies only", async () => {
    const access = createReviewAccess(config, stub([]).options);
    const url = new URL(await access.presignGet(R_KEY, REVIEW_PREVIEW_MAX_SECONDS));
    assert.equal(url.host, "example-published-bucket.s3.ap-south-1.amazonaws.com");
    assert.equal(decodeURIComponent(url.pathname), `/${R_KEY}`);
    assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
    assert.equal(url.searchParams.get("response-cache-control"), "private, no-store");
    for (const key of [M_KEY, `originals/${MEDIA}/${HASH}/x.glb`, `uploads/${MEDIA}/0f1e2d3c4b5a69788796a5b4c3d2e1f0/source.glb`]) {
      await assert.rejects(access.presignGet(key, 60), /Refusing/);
    }
    await assert.rejects(access.presignGet(R_KEY, REVIEW_PREVIEW_MAX_SECONDS + 1), /lifetime/);
  });

  it("checks review-copy existence with HEAD (404 → false; other errors are retryable)", async () => {
    assert.equal(await createReviewAccess(config, stub([{ statusCode: 200, headers: objectHeaders() }]).options).exists(R_KEY), true);
    assert.equal(await createReviewAccess(config, stub([{ statusCode: 404 }]).options).exists(R_KEY), false);
    await assert.rejects(createReviewAccess(config, stub([{ statusCode: 503 }]).options).exists(R_KEY), RetryableProcessingError);
  });

  it("streams a verified review copy to its m/ key, write-once, with the immutable CDN headers", async () => {
    const s = stub([{ statusCode: 200, headers: objectHeaders(), body: BYTES }, { statusCode: 200 }]);
    assert.equal(await createReviewAccess(config, s.options).publish(R_KEY, HEX), "created");
    assert.deepEqual(s.requests.map((r) => `${r.method} ${r.path}`), [`GET /${R_KEY}`, `PUT /${M_KEY}`]);
    const put = s.requests[1];
    assert.equal(put.headers["if-none-match"], "*");
    assert.equal(put.headers["x-amz-checksum-sha256"], B64);
    assert.equal(put.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.equal(put.headers["content-type"], "model/gltf-binary");
  });

  it("is idempotent: an identical existing m/ object → exists; a different one → conflict", async () => {
    const same = stub([{ statusCode: 200, headers: objectHeaders(), body: BYTES }, { statusCode: 412 }, { statusCode: 200, headers: objectHeaders() }]);
    assert.equal(await createReviewAccess(config, same.options).publish(R_KEY, HEX), "exists");
    const other = createHash("sha256").update("other").digest("base64");
    const diff = stub([{ statusCode: 200, headers: objectHeaders(), body: BYTES }, { statusCode: 412 }, { statusCode: 200, headers: objectHeaders({ "x-amz-checksum-sha256": other }) }]);
    await assert.rejects(createReviewAccess(config, diff.options).publish(R_KEY, HEX), ImmutableObjectConflictError);
  });

  it("refuses a review copy whose checksum differs from the processed contentHash, or whose type is wrong", async () => {
    const wrongHash = createHash("sha256").update("x").digest("hex");
    const s = stub([{ statusCode: 200, headers: objectHeaders(), body: BYTES }]);
    await assert.rejects(createReviewAccess(config, s.options).publish(R_KEY, wrongHash), ImmutableObjectConflictError);
    assert.equal(s.requests.filter((r) => r.method === "PUT").length, 0, "nothing written");
    const wrongType = stub([{ statusCode: 200, headers: objectHeaders({ "content-type": "text/html" }), body: BYTES }]);
    await assert.rejects(createReviewAccess(config, wrongType.options).publish(R_KEY, HEX), ImmutableObjectConflictError);
  });

  it("maps a missing review copy to ReviewCopyMissingError and S3 trouble to retryable", async () => {
    await assert.rejects(createReviewAccess(config, stub([{ statusCode: 404 }]).options).publish(R_KEY, HEX), ReviewCopyMissingError);
    await assert.rejects(createReviewAccess(config, stub([{ statusCode: 503 }]).options).publish(R_KEY, HEX), RetryableProcessingError);
    await assert.rejects(createReviewAccess(config, stub([{ statusCode: 200, headers: objectHeaders(), body: BYTES }, { statusCode: 503 }]).options).publish(R_KEY, HEX), RetryableProcessingError);
    await assert.rejects(createReviewAccess(config, stub([]).options).publish(M_KEY, HEX), /Refusing/);
  });

  it("reads the bucket only from server configuration and fails closed", () => {
    assert.deepEqual(readPublishedStorageConfig({ MEDIA_REGION: "ap-south-1", MEDIA_PUBLISHED_BUCKET: "example-published-bucket" }), config);
    for (const env of [{}, { MEDIA_REGION: "ap-south-1" }, { MEDIA_PUBLISHED_BUCKET: "b-b-b" }, { MEDIA_REGION: "x", MEDIA_PUBLISHED_BUCKET: "example-published-bucket" }]) {
      assert.equal(readPublishedStorageConfig(env), null);
    }
  });
});
