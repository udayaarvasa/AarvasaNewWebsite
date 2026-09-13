/**
 * Byte-level builders for deterministic test fixtures. Every fixture is generated
 * in memory; no binary assets are committed and nothing is downloaded.
 */
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32, deflateRawSync } from "node:zlib";

type Json = Record<string, unknown>;

const u32 = (n: number) => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
};
const u16be = (n: number) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
};
const pad4 = (bytes: Uint8Array, fill: number) => {
  const padding = (4 - (bytes.length % 4)) % 4;
  return Buffer.concat([Buffer.from(bytes), Buffer.alloc(padding, fill)]);
};

// ── glTF / GLB ───────────────────────────────────────────────────────────────

export function glb(json: Json, bin?: Uint8Array): Uint8Array {
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json), "utf8"), 0x20);
  const parts = [u32(jsonChunk.length), u32(0x4e4f534a), jsonChunk];
  if (bin) {
    const binChunk = pad4(bin, 0);
    parts.push(u32(binChunk.length), u32(0x004e4942), binChunk);
  }
  const body = Buffer.concat(parts);
  return new Uint8Array(Buffer.concat([u32(0x46546c67), u32(2), u32(12 + body.length), body]));
}

export interface GltfFixture {
  json: Json;
  bin: Buffer;
}

/** One triangle; optionally one embedded texture image of the given MIME type. */
export function triangleGltf(texture?: { bytes: Uint8Array; mimeType: string }): GltfFixture {
  const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const bufferViews: Json[] = [{ buffer: 0, byteOffset: 0, byteLength: positions.length }];
  let bin = positions;
  const json: Json = {
    asset: { version: "2.0", generator: "aarvasa-test" },
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [1, 1, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
    bufferViews,
  };
  if (texture) {
    const offset = bin.length;
    bin = Buffer.concat([bin, Buffer.from(texture.bytes)]);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: texture.bytes.length });
    json.images = [{ bufferView: 1, mimeType: texture.mimeType }];
    json.textures = [{ source: 0 }];
    json.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }];
  }
  json.buffers = [{ byteLength: bin.length }];
  return { json, bin };
}

export const glbFrom = (f: GltfFixture) => glb(f.json, f.bin);

// ── Raster headers ───────────────────────────────────────────────────────────

export function png(width: number, height: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = Buffer.concat([Buffer.from([0, 0, 0, 13]), Buffer.from("IHDR"), ihdr, Buffer.alloc(4)]);
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk]));
}

export function jpeg(
  width: number,
  height: number,
  options: { progressive?: boolean; components?: number; exif?: boolean; gps?: boolean; padTo?: number } = {},
): Uint8Array {
  const components = options.components ?? 3;
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
  if (options.exif || options.gps) {
    // Little-endian TIFF with one IFD0 entry: tag 0x8825 (GPS pointer) or 0x010f (Make).
    const tiff = Buffer.alloc(26);
    tiff.write("II", 0, "latin1");
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(1, 8);
    tiff.writeUInt16LE(options.gps ? 0x8825 : 0x010f, 10);
    tiff.writeUInt16LE(4, 12);
    tiff.writeUInt32LE(1, 14);
    tiff.writeUInt32LE(0, 18);
    tiff.writeUInt32LE(0, 22);
    const payload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
    parts.push(Buffer.from([0xff, 0xe1]), u16be(payload.length + 2), payload);
  }
  const sof = Buffer.alloc(6 + components * 3);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = components;
  for (let c = 0; c < components; c++) sof.set([c + 1, 0x11, 0], 6 + c * 3);
  parts.push(Buffer.from([0xff, options.progressive ? 0xc2 : 0xc0]), u16be(sof.length + 2), sof, Buffer.from([0xff, 0xd9]));
  let bytes = Buffer.concat(parts);
  if (options.padTo && options.padTo > bytes.length) bytes = Buffer.concat([bytes, Buffer.alloc(options.padTo - bytes.length)]);
  return new Uint8Array(bytes);
}

export function webp(width: number, height: number, options: { lossless: boolean; animated?: boolean; gps?: boolean }): Uint8Array {
  const chunks: Buffer[] = [];
  if (options.animated || options.gps) {
    const vp8x = Buffer.alloc(10);
    vp8x[0] = (options.animated ? 0x02 : 0) | (options.gps ? 0x08 : 0);
    vp8x.writeUIntLE(width - 1, 4, 3);
    vp8x.writeUIntLE(height - 1, 7, 3);
    chunks.push(Buffer.from("VP8X"), u32(10), vp8x);
    if (options.animated) chunks.push(Buffer.from("ANIM"), u32(6), Buffer.alloc(6));
  }
  if (options.lossless) {
    const data = Buffer.alloc(6);
    data[0] = 0x2f;
    data.writeUInt32LE(((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14), 1);
    chunks.push(Buffer.from("VP8L"), u32(5), data); // 5 bytes + 1 pad byte
  } else {
    const data = Buffer.alloc(10);
    data.set([0x9d, 0x01, 0x2a], 3);
    data.writeUInt16LE(width, 6);
    data.writeUInt16LE(height, 8);
    chunks.push(Buffer.from("VP8 "), u32(10), data);
  }
  if (options.gps) {
    const tiff = Buffer.alloc(26);
    tiff.write("II", 0, "latin1");
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(1, 8);
    tiff.writeUInt16LE(0x8825, 10);
    chunks.push(Buffer.from("EXIF"), u32(26), tiff);
  }
  const body = Buffer.concat(chunks);
  return new Uint8Array(Buffer.concat([Buffer.from("RIFF"), u32(4 + body.length), Buffer.from("WEBP"), body]));
}

export function ktx2(options: { width: number; height: number; vkFormat?: number; scheme?: number; colorModel?: number }): Uint8Array {
  const dfdOffset = 80 + 24;
  const bytes = Buffer.alloc(dfdOffset + 44);
  Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes, 0);
  bytes.writeUInt32LE(options.vkFormat ?? 0, 12);
  bytes.writeUInt32LE(1, 16);
  bytes.writeUInt32LE(options.width, 20);
  bytes.writeUInt32LE(options.height, 24);
  bytes.writeUInt32LE(1, 36);
  bytes.writeUInt32LE(1, 40);
  bytes.writeUInt32LE(options.scheme ?? 1, 44);
  bytes.writeUInt32LE(dfdOffset, 48);
  bytes.writeUInt32LE(44, 52);
  bytes.writeUInt32LE(44, dfdOffset);
  bytes[dfdOffset + 12] = options.colorModel ?? 163;
  return new Uint8Array(bytes);
}

// ── ZIP / SOG ────────────────────────────────────────────────────────────────

export function zip(entries: Array<{ name: string; data: Uint8Array; deflate?: boolean; encrypted?: boolean }>): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.deflate ? deflateRawSync(entry.data) : Buffer.from(entry.data);
    const crc = crc32(entry.data) >>> 0;
    const flags = entry.encrypted ? 1 : 0;
    const method = entry.deflate ? 8 : 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

export function sogBundle(
  options: { count?: number; lossy?: string; extraFile?: string; omit?: string; nameOverride?: [string, string]; version?: 1 | 2; deflateMeta?: boolean } = {},
): Uint8Array {
  const files = { means: ["means_l.webp", "means_u.webp"], scales: ["scales.webp"], quats: ["quats.webp"], sh0: ["sh0.webp"] };
  const count = options.count ?? 256;
  const meta: Json =
    options.version === 1
      ? { means: { shape: [count, 3], mins: [0, 0, 0], maxs: [1, 1, 1], files: files.means }, scales: { files: files.scales }, quats: { files: files.quats }, sh0: { files: files.sh0 } }
      : { version: 2, count, means: { mins: [0, 0, 0], maxs: [1, 1, 1], files: files.means }, scales: { files: files.scales }, quats: { files: files.quats }, sh0: { files: files.sh0 } };
  const entries: Array<{ name: string; data: Uint8Array; deflate?: boolean }> = [
    { name: "meta.json", data: Buffer.from(JSON.stringify(meta)), deflate: options.deflateMeta ?? true },
  ];
  for (const name of Object.values(files).flat()) {
    if (name === options.omit) continue;
    const entryName = options.nameOverride?.[0] === name ? options.nameOverride[1] : name;
    entries.push({ name: entryName, data: webp(16, 16, { lossless: name !== options.lossy }) });
  }
  if (options.extraFile) entries.push({ name: options.extraFile, data: webp(16, 16, { lossless: true }) });
  return zip(entries);
}

// ── Filesystem ───────────────────────────────────────────────────────────────

export async function tempDir(prefix = "aarvasa-media-"): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function writeFiles(dir: string, files: Record<string, Uint8Array>): Promise<void> {
  for (const [name, bytes] of Object.entries(files)) await writeFile(join(dir, name), bytes);
}
