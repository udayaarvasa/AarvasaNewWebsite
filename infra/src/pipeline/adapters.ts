import { createRequire } from "node:module";
import { join } from "node:path";
import { PANORAMA_DIMENSIONS } from "../media-budgets";

/**
 * Seams for processing that cannot run safely offline today. Only the poster
 * generator has an implementation, and only when the `sharp` package the Next.js
 * app already installs is available. Nothing is downloaded.
 */

export interface GeneratedPoster {
  readonly bytes: Uint8Array;
  readonly mimeType: "image/webp";
  readonly width: number;
  readonly height: number;
}

export interface PosterGenerator {
  /** Stable identity (tool versions + settings). Part of the version hash, so it must change when output could. */
  readonly id: string;
  fromEquirectangular(bytes: Uint8Array): Promise<GeneratedPoster>;
}

/**
 * FUTURE (not implemented): geometry/texture optimisation, e.g. gltf-transform
 * Draco + KTX2 encoding. Must be deterministic and record its version in the
 * processing profile, because it would change published bytes.
 */
export interface ModelOptimizer {
  readonly id: string;
  optimize(glb: Uint8Array): Promise<Uint8Array>;
}

/** FUTURE (not implemented): PLY → SOG / streamed SOG conversion (PlayCanvas splat-transform). */
export interface SplatConverter {
  readonly id: string;
  toSog(ply: Uint8Array): Promise<Uint8Array>;
}

/** FUTURE (not implemented): headless renders of models and splats for posters. */
export interface PosterRenderer {
  readonly id: string;
  render(entry: Uint8Array, kind: "MODEL" | "SPLAT"): Promise<GeneratedPoster>;
}

/**
 * FUTURE (not implemented in this repository yet): writes a staged object to the
 * published bucket. Implementations must send If-None-Match: * (the bucket
 * rejects anything else), Content-Type and Cache-Control from the manifest, and
 * treat HTTP 412 as "already published".
 */
export interface ObjectPublisher {
  publish(object: { key: string; bytes: Uint8Array; contentType: string; cacheControl: string; sha256: string }): Promise<"created" | "exists">;
}

// ── sharp-backed poster generator ────────────────────────────────────────────

export const POSTER_WIDTH = 1280;
export const POSTER_HEIGHT = 640;
const POSTER_QUALITY = 80;

/** The subset of sharp's API used here (sharp ships no types to this package). */
interface SharpPipeline {
  resize(width: number, height: number, options: { fit: "cover" }): SharpPipeline;
  webp(options: { quality: number; effort: number }): SharpPipeline;
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>;
}
interface SharpModule {
  (input: Uint8Array, options: { failOn: "error"; limitInputPixels: number }): SharpPipeline;
  readonly versions: Readonly<Record<string, string | undefined>>;
}

/** infra/dist/infra/src/pipeline → repository root, where the Next.js app's dependencies live. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

/**
 * Loads sharp from the repository's existing dependencies. Returns null when it is
 * absent (it is an optional dependency of Next.js) or disabled with
 * AARVASA_MEDIA_POSTERS=off, in which case posters are reported as missing.
 */
export function loadSharpPosterGenerator(env: NodeJS.ProcessEnv = process.env): PosterGenerator | null {
  if (env.AARVASA_MEDIA_POSTERS === "off") return null;
  let loaded: unknown;
  try {
    loaded = createRequire(join(REPO_ROOT, "package.json"))("sharp");
  } catch {
    return null;
  }
  if (typeof loaded !== "function") return null;
  // Runtime module with no bundled types: narrowed to the interface above after the typeof check.
  const sharp = loaded as SharpModule;
  const versions = `sharp-${sharp.versions.sharp ?? "unknown"}+vips-${sharp.versions.vips ?? "unknown"}`;

  return {
    id: `${versions}/webp-q${POSTER_QUALITY}-${POSTER_WIDTH}x${POSTER_HEIGHT}-cover`,
    async fromEquirectangular(bytes) {
      // Output metadata (EXIF/GPS) is dropped by default; the input pixel cap matches the panorama limit.
      const { data, info } = await sharp(bytes, {
        failOn: "error",
        limitInputPixels: PANORAMA_DIMENSIONS.maxWidth * (PANORAMA_DIMENSIONS.maxWidth / 2),
      })
        .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: "cover" })
        .webp({ quality: POSTER_QUALITY, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      return { bytes: new Uint8Array(data), mimeType: "image/webp", width: info.width, height: info.height };
    },
  };
}
