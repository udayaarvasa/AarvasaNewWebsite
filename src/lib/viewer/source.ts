import type { PanoramaView, ViewerSource } from "./types";

/**
 * Published media keys, m/{mediaId}/{hash}/{file}: the same expression as
 * MEDIA_KEY_PATTERN in shared/media-contract.ts (a test keeps them equal). It is
 * copied rather than imported so browser bundles do not carry the contract's
 * private-prefix patterns (review/, originals/, uploads/) at all.
 */
export const VIEWER_MEDIA_KEY_PATTERN =
  /^m\/[a-z0-9]{8,40}\/[a-f0-9]{16,64}\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

const MODEL_EXTENSIONS = [".glb"] as const;
const PANORAMA_EXTENSIONS = [".jpg", ".jpeg", ".webp"] as const;

/**
 * The only URLs the viewer will fetch: same-origin, root-relative paths, or
 * absolute HTTPS URLs on an explicitly allowed media CDN origin whose path is a
 * published, content-addressed key (m/{mediaId}/{hash}/{file}). Private prefixes
 * (review/, originals/, uploads/) never match, even on the CDN host.
 *
 * This is deliberately not a general URL loader: nothing a user types can make
 * the viewer fetch from a host outside `cdnOrigins`.
 *
 * Returns the normalised path or URL, or null if the URL is not allowed.
 */
function resolveMediaUrl(url: string, origin: string, cdnOrigins: readonly string[], extensions: readonly string[]): string | null {
  // Backslashes are normalised to slashes by URL parsing, so they could change the host.
  if (typeof url !== "string" || url.includes("\\")) return null;
  const hasExtension = (path: string) => extensions.some((ext) => path.toLowerCase().endsWith(ext));

  if (url.startsWith("/")) {
    // "//host/x.glb" is protocol-relative and would escape the origin.
    if (url.startsWith("//")) return null;
    let parsed: URL;
    try {
      parsed = new URL(url, origin);
    } catch {
      return null;
    }
    if (parsed.origin !== origin) return null;
    if (!hasExtension(parsed.pathname)) return null;
    return parsed.pathname;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // Media keys are content-addressed paths: no credentials, query or fragment is ever needed.
  if (parsed.protocol !== "https:" || !cdnOrigins.includes(parsed.origin)) return null;
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if (!VIEWER_MEDIA_KEY_PATTERN.test(decodeURIComponent(parsed.pathname.slice(1)))) return null;
  if (!hasExtension(parsed.pathname)) return null;
  return parsed.href;
}

/** A `.glb` model URL the viewer may load, or null. */
export function resolveModelUrl(url: string, origin: string, cdnOrigins: readonly string[]): string | null {
  return resolveMediaUrl(url, origin, cdnOrigins, MODEL_EXTENSIONS);
}

/** An equirectangular `.jpg`/`.webp` panorama URL the viewer may load, or null. */
export function resolvePanoramaUrl(url: string, origin: string, cdnOrigins: readonly string[]): string | null {
  return resolveMediaUrl(url, origin, cdnOrigins, PANORAMA_EXTENSIONS);
}

export const PANORAMA_LIMITS = {
  minPitchDeg: -85,
  maxPitchDeg: 85,
  minFovDeg: 30,
  maxFovDeg: 100,
  defaultFovDeg: 75,
} as const;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Normalises yaw to (-180, 180] and clamps pitch and field of view to what the viewer supports. */
export function normalizeView(view: PanoramaView): PanoramaView {
  const yaw = ((((view.yawDeg + 180) % 360) + 360) % 360) - 180;
  return {
    yawDeg: yaw === -180 ? 180 : yaw,
    pitchDeg: Math.min(PANORAMA_LIMITS.maxPitchDeg, Math.max(PANORAMA_LIMITS.minPitchDeg, view.pitchDeg)),
    fovDeg: Math.min(PANORAMA_LIMITS.maxFovDeg, Math.max(PANORAMA_LIMITS.minFovDeg, view.fovDeg)),
  };
}

export function isValidView(view: unknown): view is PanoramaView {
  const v = view as Partial<PanoramaView> | null;
  return !!v && finite(v.yawDeg) && finite(v.pitchDeg) && finite(v.fovDeg);
}

const PROCEDURAL_KEY = "procedural";

/**
 * Stable string identity for a source. Callers usually pass a fresh object on
 * every render, so effects key on this instead of object identity.
 */
export function sourceKey(source: ViewerSource | undefined): string {
  if (!source) return PROCEDURAL_KEY;
  switch (source.kind) {
    case "model":
      return `model:${source.url}`;
    case "panorama": {
      const { yawDeg, pitchDeg, fovDeg } = source.initialView;
      return `panorama:${yawDeg}|${pitchDeg}|${fovDeg}|${source.url}`;
    }
  }
}

export function sourceFromKey(key: string): ViewerSource | undefined {
  if (key.startsWith("model:")) return { kind: "model", url: key.slice("model:".length) };
  if (key.startsWith("panorama:")) {
    const [yaw, pitch, fov, ...rest] = key.slice("panorama:".length).split("|");
    const initialView = { yawDeg: Number(yaw), pitchDeg: Number(pitch), fovDeg: Number(fov) };
    if (!isValidView(initialView) || rest.length === 0) return undefined;
    return { kind: "panorama", url: rest.join("|"), initialView };
  }
  return undefined;
}
