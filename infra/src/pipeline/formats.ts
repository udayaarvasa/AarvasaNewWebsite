import { createHash } from "node:crypto";

/**
 * Offline, dependency-free readers for the headers the pipeline needs. They
 * never decode pixels; they only read structure, dimensions and flags.
 */

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type SniffedType = "glb" | "gltf-json" | "jpeg" | "png" | "webp" | "ktx2" | "basis" | "zip" | "isobmff" | "unknown";

export const KTX2_IDENTIFIER = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i++) if (bytes[offset + i] !== signature[i]) return false;
  return true;
}

const ascii = (bytes: Uint8Array, start: number, end: number) => Buffer.from(bytes.subarray(start, end)).toString("latin1");

/** Identifies content by magic bytes, independent of the file extension. */
export function sniff(bytes: Uint8Array): SniffedType {
  if (startsWith(bytes, [0x67, 0x6c, 0x54, 0x46])) return "glb"; // "glTF"
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "webp";
  if (startsWith(bytes, KTX2_IDENTIFIER)) return "ktx2";
  if (startsWith(bytes, [0x73, 0x42])) return "basis"; // legacy .basis container ("sB")
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  // An ISO base media file: MP4, but also QuickTime and HEIC. Named for the
  // container family on purpose — it proves the box structure, not that the
  // file is an MP4 a browser will play. readMp4 decides that.
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp") return "isobmff";
  const head = Buffer.from(bytes.subarray(0, 64)).toString("utf8").trimStart();
  if (head.startsWith("{") && head.includes('"asset"')) return "gltf-json";
  return "unknown";
}

export interface ImageInfo {
  readonly width: number;
  readonly height: number;
}

// ── PNG ───────────────────────────────────────────────────────────────────────

export function readPng(bytes: Uint8Array): ImageInfo | null {
  if (sniff(bytes) !== "png" || bytes.length < 24 || ascii(bytes, 12, 16) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

// ── JPEG ──────────────────────────────────────────────────────────────────────

export interface JpegInfo extends ImageInfo {
  readonly progressive: boolean;
  readonly components: number;
  readonly hasExif: boolean;
  readonly hasGps: boolean;
}

/** Does a TIFF structure (EXIF payload) have IFD0 pointing at a GPS IFD (tag 0x8825)? */
function tiffHasGps(tiff: Uint8Array): boolean {
  if (tiff.length < 8) return false;
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return false;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const ifd0 = view.getUint32(4, little);
  if (ifd0 + 2 > tiff.length) return false;
  const entries = view.getUint16(ifd0, little);
  for (let i = 0; i < entries; i++) {
    const at = ifd0 + 2 + i * 12;
    if (at + 12 > tiff.length) return false;
    if (view.getUint16(at, little) === 0x8825) return true;
  }
  return false;
}

export function readJpeg(bytes: Uint8Array): JpegInfo | null {
  if (sniff(bytes) !== "jpeg") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  let hasExif = false;
  let hasGps = false;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    let marker = bytes[offset + 1];
    while (marker === 0xff && offset + 2 < bytes.length) marker = bytes[++offset + 1]; // fill bytes
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS before a frame header
    const length = view.getUint16(offset + 2);
    const segment = bytes.subarray(offset + 4, offset + 2 + length);
    if (marker === 0xe1 && ascii(segment, 0, 6) === "Exif\0\0") {
      hasExif = true;
      hasGps = hasGps || tiffHasGps(segment.subarray(6));
    }
    // SOF0–SOF15 except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (segment.length < 6) return null;
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
        components: bytes[offset + 9],
        progressive: marker === 0xc2 || marker === 0xc6 || marker === 0xca || marker === 0xce,
        hasExif,
        hasGps,
      };
    }
    offset += 2 + length;
  }
  return null;
}

// ── WebP ──────────────────────────────────────────────────────────────────────

export interface WebpInfo extends ImageInfo {
  readonly lossless: boolean;
  readonly animated: boolean;
  readonly hasExif: boolean;
  readonly hasGps: boolean;
}

export function readWebp(bytes: Uint8Array): WebpInfo | null {
  // RIFF header (12) + one chunk header (8); tiny lossless files are legitimately ~26 bytes.
  if (sniff(bytes) !== "webp" || bytes.length < 20) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = Math.min(bytes.length, 8 + view.getUint32(4, true));
  let width = 0;
  let height = 0;
  let lossless: boolean | null = null;
  let animated = false;
  let hasExif = false;
  let hasGps = false;
  let offset = 12;
  while (offset + 8 <= riffEnd) {
    const fourcc = ascii(bytes, offset, offset + 4);
    const size = view.getUint32(offset + 4, true);
    const data = offset + 8;
    if (data + size > bytes.length) return null;
    if (fourcc === "VP8X" && size >= 10) {
      const flags = bytes[data];
      animated = (flags & 0x02) !== 0;
      hasExif = (flags & 0x08) !== 0;
      width = 1 + (bytes[data + 4] | (bytes[data + 5] << 8) | (bytes[data + 6] << 16));
      height = 1 + (bytes[data + 7] | (bytes[data + 8] << 8) | (bytes[data + 9] << 16));
    } else if (fourcc === "VP8L" && size >= 5) {
      if (bytes[data] !== 0x2f) return null;
      const bits = view.getUint32(data + 1, true);
      if (!width) {
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      }
      lossless = lossless ?? true;
    } else if (fourcc === "VP8 " && size >= 10) {
      if (!(bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a)) return null;
      if (!width) {
        width = view.getUint16(data + 6, true) & 0x3fff;
        height = view.getUint16(data + 8, true) & 0x3fff;
      }
      lossless = false;
    } else if (fourcc === "ANIM" || fourcc === "ANMF") {
      animated = true;
    } else if (fourcc === "EXIF") {
      hasExif = true;
      const payload = bytes.subarray(data, data + size);
      // Some writers keep the JPEG-style "Exif\0\0" prefix inside the chunk.
      hasGps = tiffHasGps(ascii(payload, 0, 6) === "Exif\0\0" ? payload.subarray(6) : payload);
    }
    offset = data + size + (size % 2);
  }
  if (!width || !height || lossless === null) return null;
  return { width, height, lossless, animated, hasExif, hasGps };
}

// ── KTX2 ──────────────────────────────────────────────────────────────────────

/** Khronos Data Format colour models used by Basis Universal. */
const KHR_DF_MODEL_ETC1S = 163;
const KHR_DF_MODEL_UASTC = 166;

export type Ktx2Encoding = "basis-etc1s" | "basis-uastc" | "gpu-format";

export interface Ktx2Info extends ImageInfo {
  readonly vkFormat: number;
  readonly supercompression: "none" | "basislz" | "zstd" | "zlib" | "unknown";
  readonly encoding: Ktx2Encoding;
  readonly levels: number;
  readonly faces: number;
}

export function readKtx2(bytes: Uint8Array): Ktx2Info | null {
  if (sniff(bytes) !== "ktx2" || bytes.length < 80) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vkFormat = view.getUint32(12, true);
  const width = view.getUint32(20, true);
  const height = view.getUint32(24, true);
  const faces = view.getUint32(36, true);
  const levels = view.getUint32(40, true);
  const scheme = view.getUint32(44, true);
  const dfdOffset = view.getUint32(48, true);
  const dfdLength = view.getUint32(52, true);
  if (width === 0 || dfdOffset + dfdLength > bytes.length || dfdLength < 16) return null;
  const colorModel = bytes[dfdOffset + 12];
  const supercompression = (["none", "basislz", "zstd", "zlib"] as const)[scheme] ?? "unknown";
  let encoding: Ktx2Encoding = "gpu-format";
  if (vkFormat === 0 && colorModel === KHR_DF_MODEL_ETC1S) encoding = "basis-etc1s";
  else if (vkFormat === 0 && colorModel === KHR_DF_MODEL_UASTC) encoding = "basis-uastc";
  return { width, height: height || 1, vkFormat, supercompression, encoding, levels: Math.max(levels, 1), faces };
}

/** Dimensions for any raster a GLB may embed. */
export function readImageDimensions(bytes: Uint8Array): ImageInfo | null {
  switch (sniff(bytes)) {
    case "png":
      return readPng(bytes);
    case "jpeg":
      return readJpeg(bytes);
    case "webp":
      return readWebp(bytes);
    case "ktx2":
      return readKtx2(bytes);
    default:
      return null;
  }
}


// ── MP4 (ISO base media) ─────────────────────────────────────────────────────

export interface Mp4Info {
  readonly majorBrand: string;
  readonly compatibleBrands: readonly string[];
  /** Top-level box types in file order, e.g. ["ftyp", "moov", "mdat"]. */
  readonly topLevel: readonly string[];
  /** moov before mdat: playback can begin before the whole file has arrived. */
  readonly faststart: boolean;
  readonly durationSeconds: number | null;
  /** Sample-entry fourcc of the first video track, e.g. "avc1". Null if none. */
  readonly videoCodec: string | null;
  readonly hasAudio: boolean;
  /** As displayed: the track's rotation matrix is applied, so a phone clip
   *  stored landscape-plus-90° reads as the portrait it is. */
  readonly width: number | null;
  readonly height: number | null;
}

interface Box {
  readonly type: string;
  /** Payload start (after the header) and end, as absolute offsets. */
  readonly start: number;
  readonly end: number;
}

/** The boxes directly inside [from, to). Null on any size that does not fit. */
function childBoxes(bytes: Uint8Array, from: number, to: number): Box[] | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: Box[] = [];
  let at = from;
  while (at < to) {
    if (to - at < 8) return null;
    let size = view.getUint32(at);
    const type = ascii(bytes, at + 4, at + 8);
    let header = 8;
    if (size === 1) {
      if (to - at < 16) return null;
      const big = view.getBigUint64(at + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
      header = 16;
    } else if (size === 0) {
      size = to - at; // runs to the end of its parent
    }
    if (size < header || at + size > to) return null;
    out.push({ type, start: at + header, end: at + size });
    at += size;
  }
  return out;
}

const child = (boxes: readonly Box[], type: string) => boxes.find((b) => b.type === type);

/**
 * Reads what the pipeline needs from an MP4's structure: brand, box order,
 * duration, video codec and displayed dimensions. Never decodes a frame.
 * Null when the box structure is malformed or there is no moov.
 */
export function readMp4(bytes: Uint8Array): Mp4Info | null {
  if (sniff(bytes) !== "isobmff") return null;
  const top = childBoxes(bytes, 0, bytes.length);
  if (!top || top.length === 0 || top[0].type !== "ftyp") return null;
  const ftyp = top[0];
  if (ftyp.end - ftyp.start < 8) return null;
  const majorBrand = ascii(bytes, ftyp.start, ftyp.start + 4);
  const compatibleBrands: string[] = [];
  for (let at = ftyp.start + 8; at + 4 <= ftyp.end; at += 4) compatibleBrands.push(ascii(bytes, at, at + 4));

  const topLevel = top.map((b) => b.type);
  const moov = child(top, "moov");
  if (!moov) return null;
  const moovIndex = topLevel.indexOf("moov");
  const mdatIndex = topLevel.indexOf("mdat");
  const faststart = mdatIndex === -1 ? false : moovIndex < mdatIndex;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const moovKids = childBoxes(bytes, moov.start, moov.end);
  if (!moovKids) return null;

  let durationSeconds: number | null = null;
  const mvhd = child(moovKids, "mvhd");
  if (mvhd && mvhd.end - mvhd.start >= 20) {
    const version = bytes[mvhd.start];
    if (version === 1 && mvhd.end - mvhd.start >= 32) {
      const timescale = view.getUint32(mvhd.start + 20);
      const duration = Number(view.getBigUint64(mvhd.start + 24));
      if (timescale > 0) durationSeconds = duration / timescale;
    } else {
      const timescale = view.getUint32(mvhd.start + 12);
      const duration = view.getUint32(mvhd.start + 16);
      if (timescale > 0) durationSeconds = duration / timescale;
    }
  }

  let videoCodec: string | null = null;
  let hasAudio = false;
  let width: number | null = null;
  let height: number | null = null;

  for (const trak of moovKids.filter((b) => b.type === "trak")) {
    const trakKids = childBoxes(bytes, trak.start, trak.end);
    if (!trakKids) return null;
    const mdia = child(trakKids, "mdia");
    if (!mdia) continue;
    const mdiaKids = childBoxes(bytes, mdia.start, mdia.end);
    if (!mdiaKids) return null;
    const hdlr = child(mdiaKids, "hdlr");
    if (!hdlr || hdlr.end - hdlr.start < 12) continue;
    const handler = ascii(bytes, hdlr.start + 8, hdlr.start + 12);
    if (handler === "soun") {
      hasAudio = true;
      continue;
    }
    if (handler !== "vide" || videoCodec !== null) continue;

    // Codec: the first sample entry's fourcc, inside minf/stbl/stsd.
    const minf = child(mdiaKids, "minf");
    const stbl = minf ? child(childBoxes(bytes, minf.start, minf.end) ?? [], "stbl") : undefined;
    const stsd = stbl ? child(childBoxes(bytes, stbl.start, stbl.end) ?? [], "stsd") : undefined;
    if (stsd && stsd.end - stsd.start >= 16) videoCodec = ascii(bytes, stsd.start + 12, stsd.start + 16);

    // Dimensions and rotation, from tkhd.
    const tkhd = child(trakKids, "tkhd");
    if (tkhd) {
      const version = bytes[tkhd.start];
      const matrixAt = tkhd.start + (version === 1 ? 52 : 40);
      const sizeAt = tkhd.start + (version === 1 ? 88 : 76);
      if (sizeAt + 8 <= tkhd.end) {
        const w = view.getUint32(sizeAt) / 65536;
        const h = view.getUint32(sizeAt + 4) / 65536;
        // Matrix a and d are zero when the track is rotated a quarter turn.
        const a = view.getInt32(matrixAt);
        const d = view.getInt32(matrixAt + 16);
        const quarterTurn = a === 0 && d === 0;
        width = Math.round(quarterTurn ? h : w);
        height = Math.round(quarterTurn ? w : h);
      }
    }
  }

  return { majorBrand, compatibleBrands, topLevel, faststart, durationSeconds, videoCodec, hasAudio, width, height };
}
