import type { PanoramaView, SplatView, ViewerSource } from "./types";

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
const SPLAT_EXTENSIONS = [".sog"] as const;

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

/** A bundled SOG (`.sog`) Gaussian splat URL the viewer may load, or null. */
export function resolveSplatUrl(url: string, origin: string, cdnOrigins: readonly string[]): string | null {
  return resolveMediaUrl(url, origin, cdnOrigins, SPLAT_EXTENSIONS);
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

export const SPLAT_VIEW_LIMITS = {
  minPitchDeg: -30,
  maxPitchDeg: 80,
  /** Closest and farthest camera, as multiples of the scene's bounding radius. */
  minDistanceFactor: 0.15,
  maxDistanceFactor: 6,
  defaultView: { yawDeg: 35, pitchDeg: 20, distanceFactor: 2.2 },
} as const;

export function isValidSplatView(view: unknown): view is SplatView {
  const v = view as Partial<SplatView> | null;
  return !!v && finite(v.yawDeg) && finite(v.pitchDeg) && finite(v.distanceFactor);
}

/** Normalises yaw to (−180, 180] and clamps pitch and distance to what the splat controls allow. */
export function normalizeSplatView(view: SplatView): SplatView {
  const yaw = ((((view.yawDeg + 180) % 360) + 360) % 360) - 180;
  const L = SPLAT_VIEW_LIMITS;
  return {
    yawDeg: yaw === -180 ? 180 : yaw,
    pitchDeg: Math.min(L.maxPitchDeg, Math.max(L.minPitchDeg, view.pitchDeg)),
    distanceFactor: Math.min(L.maxDistanceFactor, Math.max(L.minDistanceFactor, view.distanceFactor)),
  };
}

const nonNegativeInt = (v: unknown): number | null => (typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null);

/**
 * Rebuilds a splat descriptor from untrusted input (a parsed source key or
 * server data), keeping only known fields. The URL is checked later, against
 * the page's origin and CDN, by `resolveSplatUrl`.
 */
export function sanitizeSplatSource(input: unknown): Extract<ViewerSource, { kind: "splat" }> | undefined {
  const v = input as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || v.kind !== "splat" || typeof v.url !== "string" || v.url.length === 0) return undefined;
  if (v.upAxis !== undefined && v.upAxis !== "y-up" && v.upAxis !== "y-down") return undefined;
  return {
    kind: "splat",
    url: v.url,
    initialView: normalizeSplatView(isValidSplatView(v.initialView) ? v.initialView : SPLAT_VIEW_LIMITS.defaultView),
    upAxis: v.upAxis === "y-down" ? "y-down" : "y-up",
    sizeBytes: nonNegativeInt(v.sizeBytes),
    gaussians: nonNegativeInt(v.gaussians),
  };
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
    case "splat": {
      // Fixed field order, so equal descriptors always give equal keys.
      const { url, initialView, upAxis, sizeBytes, gaussians } = source;
      return `splat:${JSON.stringify({ url, initialView: { yawDeg: initialView.yawDeg, pitchDeg: initialView.pitchDeg, distanceFactor: initialView.distanceFactor }, upAxis, sizeBytes, gaussians })}`;
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
  if (key.startsWith("splat:")) {
    try {
      return sanitizeSplatSource({ ...JSON.parse(key.slice("splat:".length)), kind: "splat" });
    } catch {
      return undefined;
    }
  }
  return undefined;
}
