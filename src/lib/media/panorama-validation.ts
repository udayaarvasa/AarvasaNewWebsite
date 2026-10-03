/**
 * Upload-boundary validation for 360° panoramas.
 *
 * Same contract as model-validation.ts: the decision rests on the bytes, never
 * on the filename or the browser's reported MIME type, and the identical rules
 * run again server-side on what actually arrives.
 *
 * The check that matters is the projection. An equirectangular panorama is
 * exactly twice as wide as it is tall, because it maps a full sphere — 360°
 * around, 180° top to bottom — onto a rectangle. A normal photograph wrapped
 * onto the viewer's sphere does not become a 360° view; it becomes a smear, and
 * a visitor told they are "inside" a room is being misled about what they are
 * looking at. So an ordinary 4:3 or 16:9 photograph is refused here rather than
 * accepted and displayed wrongly.
 *
 * Pure: no I/O, no DOM, so the rules are asserted directly by tests. Dimensions
 * are read from the container headers, which is all the first few kilobytes of a
 * file are needed for.
 */

export const PANORAMA_LIMITS = {
  /** Smaller than this cannot hold a JPEG or WebP header plus any image data. */
  minBytes: 64,
  /** 64 MB. A single equirectangular frame has no business being larger. */
  maxBytes: 64 * 1024 * 1024,
  /** Below this a panorama looks soft at any sensible field of view. */
  minWidth: 2048,
  /** Above this needs tiled delivery, which the viewer does not do. */
  maxWidth: 8192,
  /** Allowed deviation from exactly 2:1, as a fraction. Covers off-by-one exports. */
  aspectTolerance: 0.02,
} as const;

export type PanoramaRejection =
  | "EMPTY_FILE"
  | "TOO_LARGE"
  | "TOO_SMALL"
  | "NOT_AN_IMAGE"
  | "UNREADABLE_HEADER"
  | "NOT_EQUIRECTANGULAR"
  | "RESOLUTION_TOO_LOW"
  | "RESOLUTION_TOO_HIGH"
  | "ANIMATED";

export const PANORAMA_REJECTION_MESSAGES: Readonly<Record<PanoramaRejection, string>> = {
  EMPTY_FILE: "That file is empty.",
  TOO_LARGE: "That panorama is larger than 64 MB. Export it again at a lower quality.",
  TOO_SMALL: "That file is too small to be a panorama.",
  NOT_AN_IMAGE: "That is not a JPEG or WebP image. Export your panorama as .jpg or .webp.",
  UNREADABLE_HEADER: "That image looks damaged — its dimensions could not be read. Export it again.",
  NOT_EQUIRECTANGULAR:
    "That is not a 360° panorama. An equirectangular panorama is exactly twice as wide as it is tall, such as 4096 × 2048. An ordinary photograph cannot be shown as a 360° view.",
  RESOLUTION_TOO_LOW: `That panorama is too small to look sharp. Export it at least ${PANORAMA_LIMITS.minWidth} pixels wide.`,
  RESOLUTION_TOO_HIGH: `That panorama is wider than ${PANORAMA_LIMITS.maxWidth} pixels, which the viewer cannot hold in memory. Export it smaller.`,
  ANIMATED: "That is an animated image. A panorama is a single still frame.",
};

export type PanoramaKind = "jpeg" | "webp";

export type PanoramaValidation =
  | {
      readonly ok: true;
      readonly kind: PanoramaKind;
      readonly width: number;
      readonly height: number;
      readonly sizeBytes: number;
    }
  | { readonly ok: false; readonly rejection: PanoramaRejection; readonly message: string };

const fail = (rejection: PanoramaRejection): PanoramaValidation => ({
  ok: false,
  rejection,
  message: PANORAMA_REJECTION_MESSAGES[rejection],
});

const u16be = (b: Uint8Array, at: number): number => (b[at] << 8) | b[at + 1];
const u24le = (b: Uint8Array, at: number): number => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const u32le = (b: Uint8Array, at: number): number =>
  (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

/** Does the file start with the JPEG start-of-image marker? */
const isJpeg = (b: Uint8Array): boolean => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** RIFF....WEBP */
const isWebp = (b: Uint8Array): boolean =>
  b.length >= 12 &&
  b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
  b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;

/**
 * Width and height from a JPEG's first start-of-frame marker.
 *
 * Walks the marker chain rather than scanning for a byte pattern: SOF bytes
 * occur inside compressed data too, and a scan finds those first.
 */
export function readJpegSize(b: Uint8Array): { width: number; height: number } | null {
  let at = 2;
  while (at + 3 < b.length) {
    if (b[at] !== 0xff) return null;
    const marker = b[at + 1];
    // Standalone markers carry no payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) return null; // scan data begins; no SOF seen
    const length = u16be(b, at + 2);
    if (length < 2) return null;
    // Every SOF marker except DHT (c4), DAC (cc) and the restart range carries size.
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (at + 9 >= b.length) return null;
      return { height: u16be(b, at + 5), width: u16be(b, at + 7) };
    }
    at += 2 + length;
  }
  return null;
}

/** Width, height and animation flag from a WebP container's first chunk. */
export function readWebpSize(
  b: Uint8Array,
): { width: number; height: number; animated: boolean } | null {
  if (b.length < 30) return null;
  const fourCc = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (fourCc === "VP8X") {
    // Extended format: a flags byte, then 24-bit width-1 and height-1.
    const animated = (b[20] & 0x02) !== 0;
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1, animated };
  }
  if (fourCc === "VP8 ") {
    // Lossy: a 3-byte frame tag and the 3-byte start code, then the dimensions
    // as two 14-bit little-endian values (the top two bits are a scale hint).
    return {
      width: (b[26] | (b[27] << 8)) & 0x3fff,
      height: (b[28] | (b[29] << 8)) & 0x3fff,
      animated: false,
    };
  }
  if (fourCc === "VP8L") {
    // Lossless: a signature byte, then 14-bit width-1 and height-1, bit-packed.
    const bits = u32le(b, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1, animated: false };
  }
  return null;
}

/** True for an image twice as wide as it is tall, within the export tolerance. */
export function isEquirectangularSize(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  return Math.abs(width / height - 2) <= 2 * PANORAMA_LIMITS.aspectTolerance;
}

/**
 * Validate the bytes actually received. `bytes` may be a prefix: everything
 * checked here lives in the container header, so the first 64 KB is enough.
 */
export function validatePanoramaBytes(bytes: Uint8Array, declaredSize: number): PanoramaValidation {
  if (declaredSize === 0 || bytes.length === 0) return fail("EMPTY_FILE");
  if (declaredSize > PANORAMA_LIMITS.maxBytes) return fail("TOO_LARGE");
  if (declaredSize < PANORAMA_LIMITS.minBytes) return fail("TOO_SMALL");

  let kind: PanoramaKind;
  let size: { width: number; height: number; animated?: boolean } | null;

  if (isJpeg(bytes)) {
    kind = "jpeg";
    size = readJpegSize(bytes);
  } else if (isWebp(bytes)) {
    kind = "webp";
    size = readWebpSize(bytes);
    if (size && (size as { animated: boolean }).animated) return fail("ANIMATED");
  } else {
    return fail("NOT_AN_IMAGE");
  }

  if (!size || size.width <= 0 || size.height <= 0) return fail("UNREADABLE_HEADER");
  // The projection check comes before resolution, because telling someone their
  // holiday snap is "too small" would send them to re-export the wrong thing.
  if (!isEquirectangularSize(size.width, size.height)) return fail("NOT_EQUIRECTANGULAR");
  if (size.width < PANORAMA_LIMITS.minWidth) return fail("RESOLUTION_TOO_LOW");
  if (size.width > PANORAMA_LIMITS.maxWidth) return fail("RESOLUTION_TOO_HIGH");

  return { ok: true, kind, width: size.width, height: size.height, sizeBytes: declaredSize };
}

/** Content types the upload endpoint will issue a signed URL for. */
export const ACCEPTED_PANORAMA_MIME = ["image/jpeg", "image/webp"] as const;

/** File-picker hint only. Never the basis of a decision. */
export const ACCEPTED_PANORAMA_EXTENSIONS = [".jpg", ".jpeg", ".webp"] as const;
