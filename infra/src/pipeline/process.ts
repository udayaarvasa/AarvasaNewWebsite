import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { BYTE_BUDGETS, type MediaKind, SET_BUDGETS, formatBytes } from "../media-budgets";
import { CONTENT_HASH_KEY_LENGTH, MEDIA_ID_PATTERN, mediaVersionPrefix, publishedObjectMetadata } from "../../../shared/media-contract";
import type { PosterGenerator } from "./adapters";
import { checkByteBudget } from "./budget-checks";
import { type Finding, Findings, type Level, worst } from "./findings";
import { readJpeg, readWebp, sha256Hex, sniff, type SniffedType } from "./formats";
import { type GlbResult, validateGlb } from "./glb";
import { type PanoramaResult, validatePanorama } from "./panorama";
import { type SplatMetrics, validateSog } from "./sog";
import { validateKtx2Texture } from "./texture";
import { validateMp4 } from "./video";
import { PLAYCANVAS_VERSION } from "./viewer-capabilities";

export const PIPELINE_NAME = "aarvasa-media-pipeline";
export const PIPELINE_VERSION = "1.0.0";
/** Entries are published byte-for-byte; the only derived files are posters. */
export const PROCESSING_PROFILE = "passthrough-v1";
export const MANIFEST_SCHEMA_VERSION = 1;

export type MediaFormat = "GLB" | "EQUIRECT_JPEG" | "EQUIRECT_WEBP" | "SOG" | "KTX2" | "MP4";

export interface ManifestObject {
  readonly role: "entry" | "poster";
  readonly key: string;
  readonly contentType: string;
  readonly cacheControl: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface ManifestPoster {
  readonly key: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly origin: "sidecar" | "generated";
  readonly sourceFilename: string | null;
  readonly generator: string | null;
}

export interface ItemManifest {
  readonly mediaId: string;
  readonly kind: MediaKind | null;
  readonly format: MediaFormat | null;
  readonly status: Level;
  /** Immutable version directory, m/{mediaId}/{hash16}. Null when the item failed. */
  readonly storageKey: string | null;
  readonly entryFile: string | null;
  /** SHA-256 of the entry file bytes (the published file is the source, unchanged). */
  readonly contentHash: string | null;
  readonly hashAlgorithm: "sha256";
  readonly mimeType: string | null;
  readonly sizeBytes: number;
  readonly dimensions: { readonly width: number; readonly height: number } | null;
  readonly metrics: Readonly<Record<string, number | boolean | string | null>>;
  readonly poster: ManifestPoster | null;
  readonly objects: readonly ManifestObject[];
  readonly source: { readonly filename: string; readonly sizeBytes: number; readonly sha256: string | null };
  readonly validation: readonly Finding[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly processingVersion: string;
}

export interface SetManifest {
  readonly schemaVersion: number;
  readonly pipeline: {
    readonly name: string;
    readonly version: string;
    readonly profile: string;
    readonly viewerEngine: string;
    readonly posterGenerator: string | null;
  };
  readonly setId: string;
  readonly status: Level;
  readonly reviewRequired: boolean;
  readonly totals: {
    readonly items: number;
    readonly pass: number;
    readonly warn: number;
    readonly fail: number;
    readonly publishedBytes: number;
    readonly initialViewBytes: number;
  };
  readonly validation: readonly Finding[];
  readonly items: readonly ItemManifest[];
}

/** Where each staged object's bytes come from, for --out. Never used for uploads. */
export interface StagedObject {
  readonly key: string;
  readonly sha256: string;
  readonly sourcePath: string | null;
  readonly bytes: Uint8Array | null;
}

export interface ProcessOptions {
  /** Groups items for per-listing budgets and seeds derived media ids. Defaults to the directory name. */
  readonly setId?: string;
  /** Explicit media id; only valid when processing a single file. */
  readonly mediaId?: string;
  /** null disables generated posters (sidecar posters are still used). */
  readonly posterGenerator: PosterGenerator | null;
}

export interface ProcessResult {
  readonly manifest: SetManifest;
  readonly staged: readonly StagedObject[];
}

export class UsageError extends Error {}

// ── Input classification ─────────────────────────────────────────────────────

interface KindSpec {
  readonly kind: MediaKind;
  readonly sniffed: SniffedType;
  readonly entryFile: string;
}

const SUPPORTED: Readonly<Record<string, KindSpec>> = {
  ".glb": { kind: "MODEL", sniffed: "glb", entryFile: "scene.glb" },
  ".jpg": { kind: "PANORAMA", sniffed: "jpeg", entryFile: "panorama.jpg" },
  ".jpeg": { kind: "PANORAMA", sniffed: "jpeg", entryFile: "panorama.jpg" },
  ".webp": { kind: "PANORAMA", sniffed: "webp", entryFile: "panorama.webp" },
  ".sog": { kind: "SPLAT", sniffed: "zip", entryFile: "scene.sog" },
  ".ktx2": { kind: "TEXTURE", sniffed: "ktx2", entryFile: "texture.ktx2" },
  ".mp4": { kind: "VIDEO", sniffed: "isobmff", entryFile: "film.mp4" },
};

/** Recognised formats that are deliberately not accepted, with the reason. */
const RECOGNISED_UNSUPPORTED: Readonly<Record<string, string>> = {
  ".gltf": "Multi-file .gltf is not accepted; export a single binary .glb with embedded resources",
  ".bin": "External glTF buffers are not accepted; export a single .glb",
  ".ply": "PLY is a splat source format; convert to SOG (the SplatConverter adapter is not available offline)",
  ".splat": "Convert .splat to SOG before publishing",
  ".ksplat": "Convert .ksplat to SOG before publishing",
  ".spz": "Convert .spz to SOG before publishing",
  ".basis": "Legacy .basis files are recognised but not accepted; use a KTX2 container (KHR_texture_basisu)",
  ".png": "PNG is not a published media type; panoramas must be JPEG or WebP",
  ".avif": "AVIF panoramas are not accepted (decode cost on mobile); use JPEG or WebP",
  ".hdr": "HDR environments are deferred to a later phase",
  ".exr": "EXR environments are deferred to a later phase",
  ".zip": "Generic ZIP archives are not accepted; SOG bundles must use the .sog extension",
  ".json": "Standalone JSON (e.g. streamed SOG lod-meta.json) is not supported yet",
  ".mov": "QuickTime .mov is not accepted; export MP4 (H.264). Nothing is transcoded here",
  ".m4v": "Rename an MP4-compatible .m4v to .mp4, or export MP4 (H.264)",
  ".webm": "WebM is not accepted; export MP4 (H.264). Nothing is transcoded here",
  ".mkv": "Matroska is not accepted; export MP4 (H.264)",
  ".avi": "AVI is not accepted; export MP4 (H.264)",
};

const POSTER_SIDECAR = /^(.+)\.poster\.(webp|jpe?g)$/i;

function normaliseSetId(raw: string): string {
  const id = raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return id || "media-set";
}

/** Stable per set + file name, so a new version of the same file keeps its media id. */
export function deriveMediaId(setId: string, filename: string): string {
  return sha256Hex(Buffer.from(`${setId}\n${filename}`, "utf8")).slice(0, 24);
}

/**
 * The version directory hash. Covers the profile, the entry bytes and the exact
 * poster input, so any change to what would be published yields a new path and
 * identical inputs always yield the same path.
 */
export function deriveKeyHash(entrySha256: string, posterDescriptor: string): string {
  return sha256Hex(Buffer.from(`${PIPELINE_NAME}/${PROCESSING_PROFILE}\n${entrySha256}\n${posterDescriptor}`, "utf8")).slice(
    0,
    CONTENT_HASH_KEY_LENGTH,
  );
}

// ── Posters ──────────────────────────────────────────────────────────────────

interface PosterCandidate {
  readonly poster: Omit<ManifestPoster, "key">;
  readonly descriptor: string;
  readonly fileName: string;
  readonly staged: Omit<StagedObject, "key">;
}

async function sidecarPoster(path: string, filename: string, findings: Findings): Promise<PosterCandidate | null> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    findings.fail("poster.sidecar", `${filename} is not a regular file`);
    return null;
  }
  if (stat.size > BYTE_BUDGETS.POSTER.sourceMax) {
    findings.fail("poster.size", `${filename} is ${formatBytes(stat.size)}; the poster source limit is ${formatBytes(BYTE_BUDGETS.POSTER.sourceMax)}`);
    return null;
  }
  const bytes = new Uint8Array(await readFile(path));
  const isWebp = extname(filename).toLowerCase() === ".webp";
  const sniffed = sniff(bytes);
  if (sniffed !== (isWebp ? "webp" : "jpeg")) {
    findings.fail("poster.mime", `${filename} extension does not match its content (${sniffed})`);
    return null;
  }
  const info = isWebp ? readWebp(bytes) : readJpeg(bytes);
  if (!info) {
    findings.fail("poster.header", `${filename} header could not be read`);
    return null;
  }
  if ("animated" in info && info.animated) {
    findings.fail("poster.animated", `${filename} is animated`);
    return null;
  }
  if (info.hasGps) {
    findings.fail("poster.gps", `${filename} contains GPS location data; strip it before publishing`);
    return null;
  }
  checkByteBudget(findings, "Poster", bytes.length, BYTE_BUDGETS.POSTER);
  const sha256 = sha256Hex(bytes);
  findings.pass("poster.sidecar", `Using ${filename} (${info.width}×${info.height})`);
  return {
    poster: {
      mimeType: isWebp ? "image/webp" : "image/jpeg",
      sizeBytes: bytes.length,
      width: info.width,
      height: info.height,
      sha256,
      origin: "sidecar",
      sourceFilename: filename,
      generator: null,
    },
    descriptor: `sidecar:${sha256}`,
    fileName: isWebp ? "poster.webp" : "poster.jpg",
    staged: { sha256, sourcePath: path, bytes: null },
  };
}

async function generatedPoster(bytes: Uint8Array, generator: PosterGenerator, findings: Findings): Promise<PosterCandidate | null> {
  try {
    const poster = await generator.fromEquirectangular(bytes);
    const sha256 = sha256Hex(poster.bytes);
    checkByteBudget(findings, "Generated poster", poster.bytes.length, BYTE_BUDGETS.POSTER);
    findings.pass("poster.generated", `Generated ${poster.width}×${poster.height} WebP poster (${generator.id}); source not modified`);
    return {
      poster: { mimeType: poster.mimeType, sizeBytes: poster.bytes.length, width: poster.width, height: poster.height, sha256, origin: "generated", sourceFilename: null, generator: generator.id },
      descriptor: `generated:${generator.id}`,
      fileName: "poster.webp",
      staged: { sha256, sourcePath: null, bytes: poster.bytes },
    };
  } catch (error) {
    findings.fail("poster.generated", `Panorama could not be decoded to generate a poster: ${(error as Error).message}`);
    return null;
  }
}

// ── Item processing ──────────────────────────────────────────────────────────

async function processItem(
  path: string,
  filename: string,
  mediaId: string,
  sidecarPath: { path: string; filename: string } | null,
  options: ProcessOptions,
): Promise<{ item: ItemManifest; staged: StagedObject[] }> {
  const findings = new Findings();
  const ext = extname(filename).toLowerCase();
  const spec = SUPPORTED[ext];
  const stat = await lstat(path);

  const failed = (sha256: string | null, kind: MediaKind | null = spec?.kind ?? null): { item: ItemManifest; staged: StagedObject[] } => ({
    item: {
      mediaId,
      kind,
      format: null,
      status: findings.status,
      storageKey: null,
      entryFile: null,
      contentHash: null,
      hashAlgorithm: "sha256",
      mimeType: null,
      sizeBytes: stat.size,
      dimensions: null,
      metrics: {},
      poster: null,
      objects: [],
      source: { filename, sizeBytes: stat.size, sha256 },
      validation: findings.list,
      warnings: findings.list.filter((f) => f.level === "warn").map((f) => `${f.rule}: ${f.message}`),
      errors: findings.list.filter((f) => f.level === "fail").map((f) => `${f.rule}: ${f.message}`),
      processingVersion: `${PIPELINE_VERSION}/${PROCESSING_PROFILE}`,
    },
    staged: [],
  });

  if (stat.isSymbolicLink() || !stat.isFile()) {
    findings.fail("input.file", "Not a regular file (symbolic links are not followed)");
    return failed(null, null);
  }
  if (!spec) {
    findings.fail("input.extension", RECOGNISED_UNSUPPORTED[ext] ?? `Unsupported file extension "${ext || "(none)"}"`);
    return failed(null, null);
  }

  const budget = spec.kind === "TEXTURE" ? null : BYTE_BUDGETS[spec.kind];
  if (budget && stat.size > budget.sourceMax) {
    findings.fail("size.source-max", `Source is ${formatBytes(stat.size)}; the ${spec.kind.toLowerCase()} source limit is ${formatBytes(budget.sourceMax)} (not read)`);
    return failed(null);
  }

  const bytes = new Uint8Array(await readFile(path));
  const sha256 = sha256Hex(bytes);

  const sniffed = sniff(bytes);
  if (sniffed !== spec.sniffed) {
    findings.fail("mime.content-mismatch", `Extension ${ext} expects ${spec.sniffed} content but the bytes are ${sniffed}`);
    return failed(sha256);
  }

  let format: MediaFormat;
  let dimensions: { width: number; height: number } | null = null;
  let metrics: Record<string, number | boolean | string | null> = {};

  switch (spec.kind) {
    case "MODEL": {
      format = "GLB";
      const result: GlbResult | null = validateGlb(bytes, findings);
      if (result) {
        metrics = { ...result.metrics, ...Object.fromEntries(Object.entries(result.compression).map(([k, v]) => [`compression.${k}`, v])) };
      }
      break;
    }
    case "PANORAMA": {
      const result: PanoramaResult | null = validatePanorama(bytes, spec.sniffed === "jpeg" ? "jpeg" : "webp", findings);
      format = result?.format ?? (spec.sniffed === "jpeg" ? "EQUIRECT_JPEG" : "EQUIRECT_WEBP");
      if (result) dimensions = { width: result.width, height: result.height };
      break;
    }
    case "SPLAT": {
      format = "SOG";
      const result: SplatMetrics | null = validateSog(bytes, findings);
      if (result) metrics = { ...result };
      break;
    }
    case "VIDEO": {
      format = "MP4";
      const result = validateMp4(bytes, findings);
      if (result) {
        dimensions = { width: result.width, height: result.height };
        metrics = { ...result.metrics };
      }
      break;
    }
    case "TEXTURE": {
      format = "KTX2";
      const info = validateKtx2Texture(bytes, findings);
      if (info) {
        dimensions = { width: info.width, height: info.height };
        metrics = { encoding: info.encoding, supercompression: info.supercompression, levels: info.levels, faces: info.faces };
      }
      break;
    }
  }

  if (budget) checkByteBudget(findings, "Entry", bytes.length, budget);

  // Posters: a sidecar always wins; panoramas can be generated; models/splats need a sidecar for now.
  let poster: PosterCandidate | null = null;
  if (spec.kind !== "TEXTURE") {
    if (sidecarPath) {
      poster = await sidecarPoster(sidecarPath.path, sidecarPath.filename, findings);
    } else if (spec.kind === "PANORAMA" && options.posterGenerator && !findings.failed) {
      poster = await generatedPoster(bytes, options.posterGenerator, findings);
    } else if (spec.kind === "PANORAMA" && !options.posterGenerator) {
      findings.warn("poster.missing", "No poster: generation is unavailable or disabled; add a <name>.poster.webp sidecar");
    } else if (spec.kind !== "PANORAMA") {
      findings.warn("poster.missing", `No poster: add ${basename(filename, ext)}.poster.webp (headless rendering of ${spec.kind.toLowerCase()}s is a future adapter)`);
    }
  }

  if (findings.failed) return failed(sha256);

  const keyHash = deriveKeyHash(sha256, poster?.descriptor ?? "none");
  const prefix = mediaVersionPrefix(mediaId, keyHash);
  const entryKey = `${prefix}/${spec.entryFile}`;
  const entryMeta = publishedObjectMetadata(entryKey);
  if (!entryMeta) throw new Error(`Internal error: generated key ${entryKey} violates the media contract`);

  const objects: ManifestObject[] = [
    { role: "entry", key: entryKey, contentType: entryMeta.contentType, cacheControl: entryMeta.cacheControl, sizeBytes: bytes.length, sha256 },
  ];
  const staged: StagedObject[] = [{ key: entryKey, sha256, sourcePath: path, bytes: null }];
  let manifestPoster: ManifestPoster | null = null;
  if (poster) {
    const posterKey = `${prefix}/${poster.fileName}`;
    const posterMeta = publishedObjectMetadata(posterKey);
    if (!posterMeta || posterMeta.contentType !== poster.poster.mimeType) {
      throw new Error(`Internal error: poster key ${posterKey} violates the media contract`);
    }
    manifestPoster = { key: posterKey, ...poster.poster };
    objects.push({ role: "poster", key: posterKey, contentType: posterMeta.contentType, cacheControl: posterMeta.cacheControl, sizeBytes: poster.poster.sizeBytes, sha256: poster.poster.sha256 });
    staged.push({ key: posterKey, ...poster.staged });
  }
  findings.pass("key.immutable", `Version directory ${prefix} (content-addressed)`);

  return {
    item: {
      mediaId,
      kind: spec.kind,
      format,
      status: findings.status,
      storageKey: prefix,
      entryFile: spec.entryFile,
      contentHash: sha256,
      hashAlgorithm: "sha256",
      mimeType: entryMeta.contentType,
      sizeBytes: bytes.length,
      dimensions,
      metrics,
      poster: manifestPoster,
      objects,
      source: { filename, sizeBytes: bytes.length, sha256 },
      validation: findings.list,
      warnings: findings.list.filter((f) => f.level === "warn").map((f) => `${f.rule}: ${f.message}`),
      errors: [],
      processingVersion: `${PIPELINE_VERSION}/${PROCESSING_PROFILE}`,
    },
    staged,
  };
}

// ── Set processing ───────────────────────────────────────────────────────────

/** Per-listing budgets. Warnings only: they need a human decision, not a hard stop. */
export function checkSetBudgets(findings: Findings, publishedBytes: number, initialViewBytes: number): { reviewRequired: boolean } {
  if (initialViewBytes > SET_BUDGETS.initialViewTarget) {
    findings.warn(
      "set.initial-view-target",
      `Initial view (all posters + largest entry) is ${formatBytes(initialViewBytes)}; target ${formatBytes(SET_BUDGETS.initialViewTarget)}`,
    );
  } else {
    findings.pass("set.initial-view-target", `Initial view is ${formatBytes(initialViewBytes)}; within ${formatBytes(SET_BUDGETS.initialViewTarget)}`);
  }
  const reviewRequired = publishedBytes > SET_BUDGETS.publishedTotalReview;
  if (reviewRequired) {
    findings.warn(
      "set.published-total-review",
      `Published total ${formatBytes(publishedBytes)} exceeds ${formatBytes(SET_BUDGETS.publishedTotalReview)}; explicit review required before publishing`,
    );
  } else {
    findings.pass("set.published-total-review", `Published total ${formatBytes(publishedBytes)} is below the review threshold`);
  }
  return { reviewRequired };
}

/** Validates every asset under `inputPath` and builds the set manifest. Reads only; writes nothing. */
export async function processAssets(inputPath: string, options: ProcessOptions): Promise<ProcessResult> {
  let rootStat;
  try {
    rootStat = await lstat(inputPath);
  } catch {
    throw new UsageError(`Input not found: ${inputPath}`);
  }
  if (rootStat.isSymbolicLink()) throw new UsageError("The input path is a symbolic link; pass the real path");

  const setFindings = new Findings();
  let directory: string;
  let names: string[];
  if (rootStat.isDirectory()) {
    directory = inputPath;
    names = (await readdir(inputPath)).sort();
  } else if (rootStat.isFile()) {
    directory = dirname(inputPath);
    names = [basename(inputPath)];
  } else {
    throw new UsageError("Input must be a file or a directory");
  }
  const setId = normaliseSetId(options.setId ?? basename(rootStat.isDirectory() ? inputPath : directory));

  // Sidecar posters attach to their entry; hidden files and subdirectories are skipped.
  const sidecars = new Map<string, string>();
  const entries: string[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const stat = await lstat(join(directory, name));
    if (stat.isDirectory()) {
      setFindings.warn("input.subdirectory", `Subdirectory ${name}/ was not processed (sets are flat)`);
      continue;
    }
    const sidecar = POSTER_SIDECAR.exec(name);
    if (sidecar) sidecars.set(sidecar[1].toLowerCase(), name);
    else entries.push(name);
  }
  if (rootStat.isFile()) {
    const stem = basename(names[0], extname(names[0])).toLowerCase();
    const siblings = (await readdir(directory)).filter((n) => POSTER_SIDECAR.exec(n)?.[1].toLowerCase() === stem);
    if (siblings.length > 0) sidecars.set(stem, siblings.sort()[0]);
  }
  if (entries.length === 0) throw new UsageError("No media files found");
  if (options.mediaId !== undefined) {
    if (entries.length !== 1) throw new UsageError("--media-id can only be used with a single media file");
    if (!MEDIA_ID_PATTERN.test(options.mediaId)) throw new UsageError("--media-id must be 8–40 lowercase letters or digits");
  }

  const items: ItemManifest[] = [];
  const staged: StagedObject[] = [];
  const usedSidecars = new Set<string>();
  for (const name of entries) {
    const stem = basename(name, extname(name)).toLowerCase();
    const sidecarName = sidecars.get(stem);
    if (sidecarName) usedSidecars.add(sidecarName);
    const result = await processItem(
      join(directory, name),
      name,
      options.mediaId ?? deriveMediaId(setId, name),
      sidecarName ? { path: join(directory, sidecarName), filename: sidecarName } : null,
      options,
    );
    items.push(result.item);
    staged.push(...result.staged);
  }
  for (const sidecar of sidecars.values()) {
    if (!usedSidecars.has(sidecar)) setFindings.warn("poster.orphan", `${sidecar} has no matching media file`);
  }

  // ── Per-listing budgets ────────────────────────────────────────────────────
  const published = items.filter((i) => i.status !== "fail");
  const publishedBytes = published.reduce((sum, i) => sum + i.objects.reduce((s, o) => s + o.sizeBytes, 0), 0);
  const posterBytes = published.reduce((sum, i) => sum + (i.poster?.sizeBytes ?? 0), 0);
  /* A film is not part of the initial view: it streams on demand and nothing
     downloads until the visitor presses play. Counting it here would warn about
     a cost no visitor pays just by opening the page. */
  const largestEntry = published.filter((i) => i.kind !== "VIDEO").reduce((max, i) => Math.max(max, i.sizeBytes), 0);
  const initialViewBytes = posterBytes + largestEntry;
  const { reviewRequired } = checkSetBudgets(setFindings, publishedBytes, initialViewBytes);

  const count = (level: Level) => items.filter((i) => i.status === level).length;
  const manifest: SetManifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    pipeline: {
      name: PIPELINE_NAME,
      version: PIPELINE_VERSION,
      profile: PROCESSING_PROFILE,
      viewerEngine: `playcanvas@${PLAYCANVAS_VERSION}`,
      posterGenerator: options.posterGenerator?.id ?? null,
    },
    setId,
    status: worst([setFindings.status, ...items.map((i) => i.status)]),
    reviewRequired,
    totals: { items: items.length, pass: count("pass"), warn: count("warn"), fail: count("fail"), publishedBytes, initialViewBytes },
    validation: setFindings.list,
    items,
  };
  return { manifest, staged };
}
