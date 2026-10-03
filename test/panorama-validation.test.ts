/**
 * Upload-boundary validation for 360° panoramas.
 *
 * The check that earns its keep is the projection one. An ordinary photograph
 * and an equirectangular panorama are both just JPEG bytes; only the shape of
 * the image separates them. Wrapping a 4:3 holiday snap onto the viewer's sphere
 * does not produce a 360° view, it produces a smear — and a visitor told they
 * are standing inside a room is being misled about what they are looking at. So
 * it is refused here, by its dimensions, before anything is uploaded.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PANORAMA_LIMITS,
  isEquirectangularSize,
  readJpegSize,
  readWebpSize,
  validatePanoramaBytes,
} from "../src/lib/media/panorama-validation.ts";

/** A JPEG with a real marker chain: APP0, a comment, then SOF0 carrying the size. */
function jpeg(width: number, height: number): Uint8Array {
  const out: number[] = [0xff, 0xd8]; // SOI
  // APP0/JFIF, 16 bytes of payload.
  out.push(0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0);
  // A comment, so the walker has to skip a variable-length segment to reach SOF0.
  out.push(0xff, 0xfe, 0x00, 0x06, 0x41, 0x41, 0x41, 0x41);
  // SOF0: length 17, 8-bit, height, width, 3 components.
  out.push(0xff, 0xc0, 0x00, 0x11, 0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, 3);
  for (let c = 0; c < 3; c++) out.push(c + 1, 0x11, 0);
  out.push(0xff, 0xda); // SOS
  return new Uint8Array(out);
}

/** A WebP in the extended (VP8X) form, which is where animation is declared. */
function webpExtended(width: number, height: number, animated = false): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  b.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  b.set([0x56, 0x50, 0x38, 0x58], 12); // VP8X
  b[16] = 10;
  b[20] = animated ? 0x02 : 0x00;
  const w = width - 1;
  const h = height - 1;
  b[24] = w & 0xff; b[25] = (w >> 8) & 0xff; b[26] = (w >> 16) & 0xff;
  b[27] = h & 0xff; b[28] = (h >> 8) & 0xff; b[29] = (h >> 16) & 0xff;
  return b;
}

/* ── header reading ───────────────────────────────────────────────────────── */

test("JPEG dimensions come from the marker chain, not from a byte scan", () => {
  // A scan for 0xffc0 would stop inside the comment segment above.
  assert.deepEqual(readJpegSize(jpeg(4096, 2048)), { width: 4096, height: 2048 });
  assert.deepEqual(readJpegSize(jpeg(640, 480)), { width: 640, height: 480 });
});

test("a truncated JPEG reports nothing rather than a guess", () => {
  assert.equal(readJpegSize(new Uint8Array([0xff, 0xd8, 0xff])), null);
  assert.equal(readJpegSize(jpeg(4096, 2048).subarray(0, 10)), null);
});

test("WebP dimensions are read from the extended header", () => {
  const info = readWebpSize(webpExtended(4096, 2048));
  assert.deepEqual(info && { width: info.width, height: info.height }, { width: 4096, height: 2048 });
});

/* ── the projection rule ──────────────────────────────────────────────────── */

test("equirectangular means twice as wide as tall, with a little export slack", () => {
  assert.equal(isEquirectangularSize(4096, 2048), true);
  assert.equal(isEquirectangularSize(3840, 1920), true);
  assert.equal(isEquirectangularSize(4096, 2049), true); // off-by-one export
  assert.equal(isEquirectangularSize(4000, 3000), false); // 4:3 photograph
  assert.equal(isEquirectangularSize(3840, 2160), false); // 16:9 video still
  assert.equal(isEquirectangularSize(2048, 2048), false); // square
  assert.equal(isEquirectangularSize(0, 0), false);
});

test("an ordinary photograph is refused, and told why", () => {
  const photo = jpeg(4000, 3000);
  const v = validatePanoramaBytes(photo, 5_000_000);
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.rejection, "NOT_EQUIRECTANGULAR");
  assert.ok(!v.ok && /twice as wide/i.test(v.message));
});

test("a genuine equirectangular panorama is accepted", () => {
  const b = jpeg(4096, 2048);
  const v = validatePanoramaBytes(b, 2_000_000);
  assert.equal(v.ok, true);
  assert.deepEqual(v.ok && { kind: v.kind, width: v.width, height: v.height }, {
    kind: "jpeg",
    width: 4096,
    height: 2048,
  });
});

test("the header alone is enough, so nothing has to be uploaded first", () => {
  const b = jpeg(4096, 2048);
  // Declared size is the whole file; the bytes given are only the head.
  const v = validatePanoramaBytes(b, 2_000_000);
  assert.equal(v.ok, true);
});

/* ── size and container rules ─────────────────────────────────────────────── */

test("resolution is judged only after the projection is right", () => {
  // A 2:1 image that is simply too small gets the resolution message...
  const small = validatePanoramaBytes(jpeg(1024, 512), 100_000);
  assert.equal(!small.ok && small.rejection, "RESOLUTION_TOO_LOW");
  // ...and one that is too wide for the viewer's texture budget is refused too.
  const huge = validatePanoramaBytes(jpeg(16384, 8192), 20_000_000);
  assert.equal(!huge.ok && huge.rejection, "RESOLUTION_TOO_HIGH");
});

test("an animated WebP is not a panorama", () => {
  const v = validatePanoramaBytes(webpExtended(4096, 2048, true), 3_000_000);
  assert.equal(!v.ok && v.rejection, "ANIMATED");
});

/** The rejection reason, or "accepted" when the bytes passed. */
const refusal = (bytes: Uint8Array, declaredSize: number): string => {
  const v = validatePanoramaBytes(bytes, declaredSize);
  return v.ok ? "accepted" : v.rejection;
};

test("a non-image is refused by its bytes, whatever it is called", () => {
  // "glTF" — a 3D model picked in the panorama slot.
  const glb = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 2, 0, 0, 0, 100, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(refusal(glb, 952), "NOT_AN_IMAGE");
  assert.equal(refusal(new Uint8Array(64).fill(0x89), 64), "NOT_AN_IMAGE");
});

test("empty and oversized files are refused before anything is parsed", () => {
  assert.equal(refusal(new Uint8Array(0), 0), "EMPTY_FILE");
  const b = jpeg(4096, 2048);
  assert.equal(refusal(b, PANORAMA_LIMITS.maxBytes + 1), "TOO_LARGE");
  assert.equal(refusal(b, 10), "TOO_SMALL");
});

test("a header that cannot be read is refused rather than assumed square", () => {
  // A valid JPEG SOI with no SOF at all.
  const headless = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 0]);
  assert.equal(refusal(headless, 1_000_000), "UNREADABLE_HEADER");
});
