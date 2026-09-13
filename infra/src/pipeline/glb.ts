import { MODEL_TRIANGLE_BUDGET, TEXTURE_DIMENSION_BUDGET } from "../media-budgets";
import { checkCountBudget } from "./budget-checks";
import type { Findings } from "./findings";
import { readImageDimensions, readKtx2, sniff } from "./formats";
import { GLB_IMAGE_MIME_TYPES, REJECTED_GLTF_EXTENSIONS, SUPPORTED_GLTF_EXTENSIONS } from "./viewer-capabilities";

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const MAX_JSON_BYTES = 64 * 1024 * 1024;

export interface ModelMetrics {
  readonly meshes: number;
  readonly primitives: number;
  readonly triangles: number;
  readonly materials: number;
  readonly textures: number;
  readonly images: number;
  readonly maxTextureDimension: number;
}

export interface ModelCompression {
  readonly draco: boolean;
  readonly ktx2Basis: boolean;
  readonly webpTextures: boolean;
}

export interface GlbResult {
  readonly metrics: ModelMetrics;
  readonly compression: ModelCompression;
  readonly extensionsUsed: string[];
  readonly extensionsRequired: string[];
}

type Json = Record<string, unknown>;

const record = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const records = (v: unknown): Json[] => list(v).map(record).filter((r): r is Json => r !== null);
const strings = (v: unknown): string[] => list(v).filter((s): s is string => typeof s === "string");
const int = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

/** A URI is safe to print only after trimming, so a hostile value cannot flood the report. */
const shortUri = (uri: string) => (uri.length > 80 ? `${uri.slice(0, 77)}...` : uri);

/**
 * Validates a binary glTF 2.0 file for the Aarvasa viewer. Never decodes geometry
 * or pixels (Draco and Basis payloads are recognised structurally, not decoded).
 * Returns null when the file is too broken to report metrics.
 */
export function validateGlb(bytes: Uint8Array, findings: Findings): GlbResult | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // ── Container ──────────────────────────────────────────────────────────────
  if (bytes.length < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    findings.fail("glb.header", "Not a binary glTF: missing 'glTF' magic");
    return null;
  }
  const version = view.getUint32(4, true);
  const declared = view.getUint32(8, true);
  if (version !== 2) {
    findings.fail("glb.header", `GLB container version ${version}; only version 2 is supported`);
    return null;
  }
  if (declared !== bytes.length) {
    findings.fail("glb.header", `Header declares ${declared} bytes but the file has ${bytes.length}`);
    return null;
  }
  findings.pass("glb.header", "glTF binary container version 2, length matches");

  let offset = 12;
  let json: Uint8Array | null = null;
  let bin: Uint8Array | null = null;
  let chunkIndex = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      findings.fail("glb.chunks", `Truncated chunk header at byte ${offset}`);
      return null;
    }
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + length > bytes.length) {
      findings.fail("glb.chunks", `Chunk ${chunkIndex} overruns the file`);
      return null;
    }
    if (length % 4 !== 0) {
      findings.fail("glb.chunks", `Chunk ${chunkIndex} is not 4-byte aligned`);
      return null;
    }
    if (chunkIndex === 0 && type !== CHUNK_JSON) {
      findings.fail("glb.chunks", "The first chunk must be JSON");
      return null;
    }
    if (type === CHUNK_JSON && chunkIndex === 0) json = bytes.subarray(start, start + length);
    else if (type === CHUNK_BIN && chunkIndex === 1) bin = bytes.subarray(start, start + length);
    else if (type === CHUNK_JSON || type === CHUNK_BIN) {
      findings.fail("glb.chunks", `Unexpected ${type === CHUNK_JSON ? "JSON" : "BIN"} chunk at position ${chunkIndex}`);
      return null;
    } else {
      findings.warn("glb.chunks", `Unknown chunk type 0x${type.toString(16)} at position ${chunkIndex} will be ignored by loaders`);
    }
    offset = start + length;
    chunkIndex++;
  }
  if (!json || json.length === 0 || json.length > MAX_JSON_BYTES) {
    findings.fail("glb.chunks", "Missing, empty or oversized JSON chunk");
    return null;
  }
  findings.pass("glb.chunks", `JSON chunk ${json.length} B${bin ? `, BIN chunk ${bin.length} B` : ", no BIN chunk"}`);

  let gltf: Json | null;
  try {
    gltf = record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json).replace(/[ ]+$/, "")));
  } catch (error) {
    findings.fail("gltf.json", `JSON chunk is not valid UTF-8 JSON: ${(error as Error).message}`);
    return null;
  }
  if (!gltf) {
    findings.fail("gltf.json", "JSON chunk is not an object");
    return null;
  }
  const assetVersion = record(gltf.asset)?.version;
  if (typeof assetVersion !== "string" || !assetVersion.startsWith("2.")) {
    findings.fail("gltf.asset", `asset.version must be 2.x (found ${JSON.stringify(assetVersion)})`);
    return null;
  }
  findings.pass("gltf.asset", `glTF ${assetVersion}`);

  // ── Extensions ─────────────────────────────────────────────────────────────
  const used = strings(gltf.extensionsUsed);
  const required = strings(gltf.extensionsRequired);
  const bufferViews = records(gltf.bufferViews);
  const meshoptInViews = bufferViews.some((v) => REJECTED_GLTF_EXTENSIONS.some((ext) => record(v.extensions)?.[ext] !== undefined));
  const meshopt = [...new Set([...used, ...required].filter((e) => REJECTED_GLTF_EXTENSIONS.includes(e)))];
  if (meshopt.length > 0 || meshoptInViews) {
    findings.fail(
      "gltf.meshopt",
      `Meshopt compression (${meshopt.join(", ") || "bufferView extension"}) is not supported by the viewer's PlayCanvas engine; re-export without meshopt (Draco is supported)`,
    );
  }
  const unsupportedRequired = required.filter((e) => !SUPPORTED_GLTF_EXTENSIONS.includes(e) && !REJECTED_GLTF_EXTENSIONS.includes(e));
  if (unsupportedRequired.length > 0) {
    findings.fail("gltf.extensions-required", `Required extensions not supported by the viewer: ${unsupportedRequired.join(", ")}`);
  }
  const unsupportedUsed = used.filter(
    (e) => !SUPPORTED_GLTF_EXTENSIONS.includes(e) && !REJECTED_GLTF_EXTENSIONS.includes(e) && !required.includes(e),
  );
  if (unsupportedUsed.length > 0) {
    findings.warn("gltf.extensions-used", `Optional extensions the viewer will ignore: ${unsupportedUsed.join(", ")}`);
  }
  const missingFromUsed = required.filter((e) => !used.includes(e));
  if (missingFromUsed.length > 0) {
    findings.warn("gltf.extensions-used", `extensionsRequired entries missing from extensionsUsed: ${missingFromUsed.join(", ")}`);
  }
  if (meshopt.length === 0 && !meshoptInViews && unsupportedRequired.length === 0 && unsupportedUsed.length === 0) {
    findings.pass("gltf.extensions", used.length ? `Extensions supported: ${used.join(", ")}` : "No extensions used");
  }
  if (used.includes("KHR_gaussian_splatting")) {
    findings.warn("gltf.gaussian-splatting", "GLB Gaussian splats are uncompressed; publish splats as SOG instead");
  }

  // ── Buffers: everything must be embedded in the BIN chunk ──────────────────
  const buffers = records(gltf.buffers);
  let embeddedOk = true;
  const bufferLengths: number[] = [];
  buffers.forEach((buffer, i) => {
    const byteLength = int(buffer.byteLength);
    bufferLengths.push(byteLength ?? 0);
    if (typeof buffer.uri === "string") {
      embeddedOk = false;
      if (/^data:/i.test(buffer.uri)) {
        findings.fail("gltf.data-uri", `buffers[${i}] uses a base64 data URI; embed binary data in the GLB BIN chunk`);
      } else {
        findings.fail("gltf.external-uri", `buffers[${i}] references an external resource (${shortUri(buffer.uri)}); all resources must be embedded`);
      }
      return;
    }
    if (i !== 0 || !bin) {
      embeddedOk = false;
      findings.fail("gltf.buffers", `buffers[${i}] has no uri and no GLB BIN chunk backs it`);
      return;
    }
    if (byteLength === null || byteLength > bin.length) {
      embeddedOk = false;
      findings.fail("gltf.buffers", `buffers[0].byteLength ${String(buffer.byteLength)} exceeds the BIN chunk (${bin.length} B)`);
    }
  });

  bufferViews.forEach((bv, i) => {
    const buffer = int(bv.buffer);
    const length = int(bv.byteLength);
    const start = int(bv.byteOffset ?? 0);
    if (buffer === null || buffer >= buffers.length || length === null || start === null || start + length > (bufferLengths[buffer] ?? 0)) {
      embeddedOk = false;
      findings.fail("gltf.buffer-views", `bufferViews[${i}] points outside its buffer`);
    }
  });

  // ── Images ─────────────────────────────────────────────────────────────────
  const images = records(gltf.images);
  let maxTextureDimension = 0;
  let ktx2Basis = false;
  let webpTextures = false;
  images.forEach((image, i) => {
    if (typeof image.uri === "string") {
      embeddedOk = false;
      if (/^data:/i.test(image.uri)) {
        findings.fail("gltf.data-uri", `images[${i}] uses a base64 data URI; embed images via bufferView`);
      } else {
        findings.fail("gltf.external-uri", `images[${i}] references an external resource (${shortUri(image.uri)}); all resources must be embedded`);
      }
      return;
    }
    const viewIndex = int(image.bufferView);
    const mimeType = typeof image.mimeType === "string" ? image.mimeType : "";
    if (viewIndex === null || viewIndex >= bufferViews.length || !mimeType) {
      embeddedOk = false;
      findings.fail("gltf.images", `images[${i}] needs a valid bufferView and mimeType`);
      return;
    }
    if (!(mimeType in GLB_IMAGE_MIME_TYPES)) {
      findings.fail("gltf.images", `images[${i}] has unsupported mimeType ${mimeType}; use PNG, JPEG, WebP or KTX2`);
      return;
    }
    const needs = GLB_IMAGE_MIME_TYPES[mimeType];
    if (needs && !used.includes(needs)) {
      findings.fail("gltf.images", `images[${i}] is ${mimeType} but ${needs} is not declared in extensionsUsed`);
    }
    const bv = bufferViews[viewIndex];
    const start = int(bv.byteOffset ?? 0) ?? 0;
    const length = int(bv.byteLength) ?? 0;
    if (!bin || start + length > bin.length) return; // already reported above
    const data = bin.subarray(start, start + length);
    const expected = { "image/png": "png", "image/jpeg": "jpeg", "image/webp": "webp", "image/ktx2": "ktx2" }[mimeType];
    const actual = sniff(data);
    if (actual !== expected) {
      findings.fail("gltf.images", `images[${i}] declares ${mimeType} but its bytes are ${actual}`);
      return;
    }
    if (mimeType === "image/ktx2") {
      const ktx = readKtx2(data);
      if (ktx && ktx.encoding !== "gpu-format") ktx2Basis = true;
      else findings.warn("gltf.images", `images[${i}] is KTX2 but not Basis Universal; it may not transcode on every GPU`);
    }
    if (mimeType === "image/webp") webpTextures = true;
    const dims = readImageDimensions(data);
    if (!dims) {
      findings.fail("gltf.images", `images[${i}] header could not be read`);
      return;
    }
    maxTextureDimension = Math.max(maxTextureDimension, dims.width, dims.height);
  });
  if (embeddedOk) findings.pass("gltf.embedded-resources", "All buffers and images are embedded in the GLB");

  const textures = records(gltf.textures);
  textures.forEach((texture, i) => {
    const sources = [texture.source, record(record(texture.extensions)?.KHR_texture_basisu)?.source, record(record(texture.extensions)?.EXT_texture_webp)?.source]
      .filter((s) => s !== undefined)
      .map(int);
    if (sources.some((s) => s === null || s >= images.length)) {
      findings.fail("gltf.textures", `textures[${i}] references a missing image`);
    }
  });

  // ── Geometry ───────────────────────────────────────────────────────────────
  const accessors = records(gltf.accessors);
  const meshes = records(gltf.meshes);
  let primitives = 0;
  let triangles = 0;
  let dracoPrimitives = 0;
  meshes.forEach((mesh, m) => {
    records(mesh.primitives).forEach((primitive, p) => {
      primitives++;
      const draco = record(record(primitive.extensions)?.KHR_draco_mesh_compression);
      if (draco) {
        dracoPrimitives++;
        const dracoView = int(draco.bufferView);
        if (dracoView === null || dracoView >= bufferViews.length) {
          findings.fail("gltf.draco", `meshes[${m}].primitives[${p}] Draco extension points at a missing bufferView`);
        }
      }
      const mode = int(primitive.mode ?? 4);
      const indexAccessor = int(primitive.indices);
      const position = int(record(primitive.attributes)?.POSITION);
      const accessor = accessors[indexAccessor ?? position ?? -1];
      const count = accessor ? int(accessor.count) ?? 0 : 0;
      if (mode === 4) triangles += Math.floor(count / 3);
      else if (mode === 5 || mode === 6) triangles += Math.max(count - 2, 0);
    });
  });

  if (dracoPrimitives > 0) {
    if (!used.includes("KHR_draco_mesh_compression")) {
      findings.fail("gltf.draco", "Primitives use Draco but KHR_draco_mesh_compression is not in extensionsUsed");
    } else {
      findings.pass(
        "gltf.draco",
        `Draco-compressed geometry on ${dracoPrimitives} primitive(s); the viewer must load the Draco decoder from lib/draco/{version}/ (not decoded here)`,
      );
    }
  }
  if (ktx2Basis) {
    findings.pass("gltf.ktx2", "KTX2/Basis Universal textures; the viewer must load the Basis transcoder from lib/basis/{version}/ (not transcoded here)");
  }
  if (meshes.length === 0) findings.warn("gltf.meshes", "The GLB contains no meshes");
  else checkCountBudget(findings, "gltf.triangles", "Triangle count", triangles, MODEL_TRIANGLE_BUDGET);
  if (maxTextureDimension > 0) {
    checkCountBudget(findings, "gltf.texture-dimensions", "Largest texture dimension", maxTextureDimension, TEXTURE_DIMENSION_BUDGET);
  }

  return {
    metrics: {
      meshes: meshes.length,
      primitives,
      triangles,
      materials: records(gltf.materials).length,
      textures: textures.length,
      images: images.length,
      maxTextureDimension,
    },
    compression: { draco: dracoPrimitives > 0, ktx2Basis, webpTextures },
    extensionsUsed: used,
    extensionsRequired: required,
  };
}
