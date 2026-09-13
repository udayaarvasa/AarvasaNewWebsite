import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readJpeg, readKtx2, readPng, readWebp, sha256Hex, sniff } from "../../src/pipeline/formats";
import { glbFrom, jpeg, ktx2, png, triangleGltf, webp, zip } from "./fixtures";

describe("pipeline formats: MIME detection by magic bytes", () => {
  it("identifies each supported container regardless of file name", () => {
    assert.equal(sniff(glbFrom(triangleGltf())), "glb");
    assert.equal(sniff(jpeg(8, 4)), "jpeg");
    assert.equal(sniff(png(8, 4)), "png");
    assert.equal(sniff(webp(8, 4, { lossless: false })), "webp");
    assert.equal(sniff(ktx2({ width: 4, height: 4 })), "ktx2");
    assert.equal(sniff(zip([{ name: "a", data: new Uint8Array([1]) }])), "zip");
    assert.equal(sniff(Buffer.from('{"asset":{"version":"2.0"}}')), "gltf-json");
    assert.equal(sniff(Buffer.from("sB\x00\x13")), "basis");
    assert.equal(sniff(Buffer.from("<html></html>")), "unknown");
    assert.equal(sniff(new Uint8Array()), "unknown");
  });
});

describe("pipeline formats: header readers", () => {
  it("reads JPEG dimensions, progressive flag, colour components and EXIF/GPS", () => {
    assert.deepEqual(readJpeg(jpeg(4096, 2048)), { width: 4096, height: 2048, components: 3, progressive: false, hasExif: false, hasGps: false });
    assert.equal(readJpeg(jpeg(10, 5, { progressive: true }))?.progressive, true);
    assert.equal(readJpeg(jpeg(10, 5, { components: 4 }))?.components, 4);
    assert.deepEqual(
      { exif: readJpeg(jpeg(10, 5, { exif: true }))?.hasExif, gps: readJpeg(jpeg(10, 5, { exif: true }))?.hasGps },
      { exif: true, gps: false },
    );
    assert.equal(readJpeg(jpeg(10, 5, { gps: true }))?.hasGps, true);
    assert.equal(readJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), null);
  });

  it("reads lossy, lossless, animated and GPS-tagged WebP headers", () => {
    assert.deepEqual(readWebp(webp(8192, 4096, { lossless: false })), { width: 8192, height: 4096, lossless: false, animated: false, hasExif: false, hasGps: false });
    assert.equal(readWebp(webp(16, 16, { lossless: true }))?.lossless, true);
    assert.equal(readWebp(webp(16, 16, { lossless: false, animated: true }))?.animated, true);
    assert.equal(readWebp(webp(16, 16, { lossless: false, gps: true }))?.hasGps, true);
  });

  it("reads PNG dimensions", () => {
    assert.deepEqual(readPng(png(300, 200)), { width: 300, height: 200 });
  });

  it("recognises KTX2 Basis Universal (ETC1S/UASTC) versus GPU-specific formats", () => {
    assert.equal(readKtx2(ktx2({ width: 1024, height: 512, colorModel: 163 }))?.encoding, "basis-etc1s");
    assert.equal(readKtx2(ktx2({ width: 1024, height: 512, colorModel: 166, scheme: 2 }))?.encoding, "basis-uastc");
    const gpu = readKtx2(ktx2({ width: 64, height: 64, vkFormat: 37, scheme: 0 }));
    assert.equal(gpu?.encoding, "gpu-format");
    assert.equal(gpu?.supercompression, "none");
    assert.equal(readKtx2(ktx2({ width: 2048, height: 1024 }))?.supercompression, "basislz");
  });
});

describe("pipeline formats: SHA-256", () => {
  it("is deterministic and content-sensitive", () => {
    const bytes = glbFrom(triangleGltf());
    assert.equal(sha256Hex(bytes), sha256Hex(Uint8Array.from(bytes)));
    assert.match(sha256Hex(bytes), /^[a-f0-9]{64}$/);
    const changed = Uint8Array.from(bytes);
    changed[changed.length - 1] ^= 1;
    assert.notEqual(sha256Hex(changed), sha256Hex(bytes));
    assert.equal(sha256Hex(new Uint8Array()), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});
