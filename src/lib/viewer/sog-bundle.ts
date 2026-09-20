import type { SplatBounds } from "./types";

/**
 * Browser-side pre-check of a bundled SOG (`.sog`) before it reaches the
 * PlayCanvas parser. Pure: no DOM, no PlayCanvas; decompression is injected
 * (DecompressionStream in the browser, zlib in tests).
 *
 * Published splats were already validated by the Phase 2B-2 pipeline
 * (infra/src/pipeline/sog.ts, which needs Node). This check is cheaper and
 * narrower, and exists because the engine's parser has two properties the
 * viewer must not rely on:
 *
 * - if meta.json names a file that is not inside the ZIP, PlayCanvas 2.22.2
 *   fetches that name relative to the page (a URL chosen by the file's
 *   contents), so every referenced file must be a flat entry of the bundle;
 * - it reads the end-of-central-directory record only at the very end of the
 *   file, so anything else is "not a SOG" here too, with a clear error.
 *
 * It also reads the gaussian count and bounds without touching the GPU, so an
 * oversized scene is refused before any texture is created.
 */

export type SogErrorCode = "not-sog" | "corrupt" | "unsafe-entry" | "missing-file" | "unsupported-version" | "invalid-meta";

export class SogBundleError extends Error {
  constructor(
    readonly code: SogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SogBundleError";
  }
}

export type SogSummary = {
  version: 1 | 2;
  gaussians: number;
  /** True when the bundle carries higher-order spherical harmonics (shN). */
  hasShN: boolean;
  files: number;
  bounds: SplatBounds;
};

export type Inflate = (compressed: Uint8Array) => Promise<Uint8Array>;

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_ENTRIES = 64;
const MAX_META_BYTES = 1_000_000;
const SAFE_ENTRY_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;
const REQUIRED_FILES: Readonly<Record<string, number>> = { means: 2, scales: 1, quats: 1, sh0: 1 };

type Entry = { name: string; method: number; flags: number; compressedSize: number; dataOffset: number };

const fail = (code: SogErrorCode, message: string): never => {
  throw new SogBundleError(code, message);
};

function readDirectory(bytes: Uint8Array): Entry[] {
  if (bytes.length < 22) fail("not-sog", "File is too small to be a SOG bundle");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  if (view.getUint32(eocd, true) !== EOCD) fail("not-sog", "Not a SOG bundle (no ZIP end record)");
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) fail("corrupt", "ZIP64 bundles are not supported");
  if (count === 0 || count > MAX_ENTRIES) fail("corrupt", `Bundle has ${count} entries; expected 1–${MAX_ENTRIES}`);
  if (cdOffset + cdSize > eocd) fail("corrupt", "Central directory overlaps the end record");

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const entries: Entry[] = [];
  let offset = cdOffset;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > eocd || view.getUint32(offset, true) !== CENTRAL) fail("corrupt", `Corrupt directory entry ${i}`);
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    let name = "";
    try {
      name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    } catch {
      fail("unsafe-entry", `Entry ${i} has a non-UTF-8 name`);
    }
    if (!SAFE_ENTRY_NAME.test(name)) fail("unsafe-entry", "Bundle entries must be flat, plain file names");
    if (entries.some((e) => e.name === name)) fail("unsafe-entry", `Duplicate entry ${name}`);
    if (flags & 0x1) fail("unsafe-entry", `${name} is encrypted`);
    if (method !== 0 && method !== 8) fail("corrupt", `${name} uses an unsupported compression method`);
    if (localOffset + 30 > cdOffset || view.getUint32(localOffset, true) !== LOCAL) fail("corrupt", `${name}: local header not found`);
    const dataOffset = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    if (dataOffset + compressedSize > cdOffset) fail("corrupt", `${name}: data runs past the end of the archive`);
    entries.push({ name, method, flags, compressedSize, dataOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

type Json = Record<string, unknown>;
const record = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const vec3 = (v: unknown): [number, number, number] | null =>
  Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => typeof n === "number" && Number.isFinite(n)) ? [v[0], v[1], v[2]] : null;
/** 256 finite values; the engine replaces a null first entry (an encoder's −∞) itself. */
const codebook = (v: unknown) =>
  Array.isArray(v) && v.length === 256 && v.every((n, i) => (typeof n === "number" && Number.isFinite(n)) || (i === 0 && n === null));

/** Inverse of SOG's position transform: sign(v) · (e^|v| − 1). */
const unlog = (v: number) => Math.sign(v) * (Math.exp(Math.abs(v)) - 1);

/** Bounding sphere from meta.json `means.mins/maxs`, as PlayCanvas computes the scene's AABB. */
export function sogBounds(mins: readonly number[], maxs: readonly number[]): SplatBounds {
  const lo = mins.map(unlog);
  const hi = maxs.map(unlog);
  const center: [number, number, number] = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const radius = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
  return { center, radius: Math.max(radius, 1e-3) };
}

/** Reads and checks a SOG bundle's directory and meta.json. Throws SogBundleError. */
export async function inspectSogBundle(bytes: Uint8Array, inflate: Inflate): Promise<SogSummary> {
  const entries = readDirectory(bytes);
  const metaEntry = entries.find((e) => e.name === "meta.json") ?? fail("missing-file", "meta.json not found in the bundle");
  if (metaEntry.compressedSize > MAX_META_BYTES) fail("invalid-meta", "meta.json is too large");
  const raw = bytes.subarray(metaEntry.dataOffset, metaEntry.dataOffset + metaEntry.compressedSize);
  let metaBytes: Uint8Array;
  try {
    metaBytes = metaEntry.method === 8 ? await inflate(raw) : raw;
  } catch {
    return fail("corrupt", "meta.json could not be decompressed");
  }
  if (metaBytes.length > MAX_META_BYTES) fail("invalid-meta", "meta.json is too large");

  let meta: Json | null = null;
  try {
    meta = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(metaBytes)));
  } catch {
    fail("invalid-meta", "meta.json is not valid JSON");
  }
  if (!meta) return fail("invalid-meta", "meta.json is not an object");

  const means = record(meta.means);
  let version: 1 | 2;
  let gaussians: unknown;
  if (meta.version === 2) {
    version = 2;
    gaussians = meta.count;
  } else if (meta.version === undefined && Array.isArray(means?.shape)) {
    version = 1;
    gaussians = (means.shape as unknown[])[0];
  } else {
    return fail("unsupported-version", `SOG version ${JSON.stringify(meta.version ?? null)} is not supported (expected 1 or 2)`);
  }
  if (typeof gaussians !== "number" || !Number.isSafeInteger(gaussians) || gaussians <= 0) fail("invalid-meta", "meta.json has no valid gaussian count");

  const names = new Set(entries.map((e) => e.name));
  const sections = { ...REQUIRED_FILES, ...(meta.shN !== undefined ? { shN: 2 } : {}) };
  for (const [section, needed] of Object.entries(sections)) {
    const files = record(meta[section])?.files;
    if (!Array.isArray(files) || files.length < needed || !files.every((f) => typeof f === "string")) {
      fail("invalid-meta", `meta.json "${section}.files" must list ${needed} file(s)`);
    }
    for (const file of files as string[]) {
      if (!SAFE_ENTRY_NAME.test(file) || !file.toLowerCase().endsWith(".webp")) fail("unsafe-entry", `meta.json references an unexpected file for "${section}"`);
      if (!names.has(file)) fail("missing-file", `meta.json references ${file}, which is not in the bundle`);
    }
    if (version === 2 && section !== "means" && section !== "quats" && !codebook(record(meta[section])?.codebook)) {
      fail("invalid-meta", `meta.json "${section}.codebook" is missing or invalid`);
    }
  }

  const mins = vec3(means?.mins);
  const maxs = vec3(means?.maxs);
  if (!mins || !maxs || mins.some((m, i) => m > maxs[i])) return fail("invalid-meta", "meta.json has invalid position bounds");

  return { version, gaussians: gaussians as number, hasShN: meta.shN !== undefined, files: entries.length, bounds: sogBounds(mins, maxs) };
}
