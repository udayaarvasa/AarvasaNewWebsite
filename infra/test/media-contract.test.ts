import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IMMUTABLE_CACHE_CONTROL,
  LIB_KEY_PATTERN,
  MEDIA_KEY_PATTERN,
  ORIGINAL_KEY_PATTERN,
  PUBLISHED_CONTENT_TYPES,
  publishedObjectMetadata,
} from "../../shared/media-contract";

const MEDIA_ID = "cm1abcd2ef3gh4";
const HASH = "3f9a1c2b7d4e8f60";

describe("media contract", () => {
  it("uses the approved MIME types for every published extension", () => {
    assert.deepEqual(
      { ...PUBLISHED_CONTENT_TYPES },
      {
        glb: "model/gltf-binary",
        ktx2: "image/ktx2",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        sog: "application/zip",
        json: "application/json",
        wasm: "application/wasm",
      },
    );
    assert.ok(!Object.values(PUBLISHED_CONTENT_TYPES).includes("application/octet-stream"));
  });

  it("marks every CDN object immutable for one year", () => {
    assert.equal(IMMUTABLE_CACHE_CONTROL, "public, max-age=31536000, immutable");
  });

  it("accepts content-addressed media keys, including multi-file splat sets", () => {
    for (const key of [
      `m/${MEDIA_ID}/${HASH}/scene.glb`,
      `m/${MEDIA_ID}/${HASH}/poster-1280.webp`,
      `m/${MEDIA_ID}/${HASH}/lod-meta.json`,
      `m/${MEDIA_ID}/${HASH}/chunks/0/means_l.webp`,
      `m/${MEDIA_ID}/${HASH}/scene.sog`,
    ]) {
      const meta = publishedObjectMetadata(key);
      assert.ok(meta, `expected ${key} to be publishable`);
      assert.equal(meta.cacheControl, IMMUTABLE_CACHE_CONTROL);
    }
    assert.equal(publishedObjectMetadata(`m/${MEDIA_ID}/${HASH}/scene.glb`)?.contentType, "model/gltf-binary");
    assert.equal(publishedObjectMetadata(`m/${MEDIA_ID}/${HASH}/pano.JPG`)?.contentType, "image/jpeg");
  });

  it("refuses keys that would break immutability or escape the layout", () => {
    for (const key of [
      `m/${MEDIA_ID}/scene.glb`, // no content hash
      `m/${MEDIA_ID}/latest/scene.glb`, // mutable alias instead of a hash
      `m/${MEDIA_ID}/${HASH.toUpperCase()}/scene.glb`, // non-canonical hash
      `m/${MEDIA_ID}/${HASH}/../other/scene.glb`, // traversal
      `m/${MEDIA_ID}/${HASH}//scene.glb`, // empty segment
      `m/${MEDIA_ID}/${HASH}/scene.html`, // unknown type
      `m/${MEDIA_ID}/${HASH}/scene.svg`,
      `m/${MEDIA_ID}/${HASH}/loader.js`, // scripts only under lib/
      `m/${MEDIA_ID}/${HASH}/scene.ply`, // source format, never published
      `originals/${MEDIA_ID}/${HASH}/scene.ply`, // private prefix
      `uploads/${MEDIA_ID}/u1/scene.glb`,
      `/m/${MEDIA_ID}/${HASH}/scene.glb`, // leading slash
    ]) {
      assert.equal(publishedObjectMetadata(key), null, `expected ${key} to be refused`);
    }
  });

  it("allows decoder scripts only under versioned lib/ paths", () => {
    assert.equal(publishedObjectMetadata("lib/draco/1.5.7/draco_decoder.js")?.contentType, "text/javascript");
    assert.equal(publishedObjectMetadata("lib/draco/1.5.7/draco_decoder.wasm")?.contentType, "application/wasm");
    assert.ok(LIB_KEY_PATTERN.test("lib/basis/1.16.4/basis_transcoder.wasm"));
    assert.equal(publishedObjectMetadata("lib/draco/draco_decoder.js"), null, "version segment is required");
  });

  it("recognises originals without making them CDN-servable", () => {
    const key = `originals/${MEDIA_ID}/${HASH}/capture.ply`;
    assert.ok(ORIGINAL_KEY_PATTERN.test(key));
    assert.ok(!MEDIA_KEY_PATTERN.test(key));
    assert.equal(publishedObjectMetadata(key), null);
  });
});
