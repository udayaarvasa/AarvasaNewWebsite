import type { ViewerSource } from "./types";

const MODEL_EXTENSION = ".glb";

/**
 * Restricts model URLs to same-origin, root-relative `.glb` paths.
 *
 * This is deliberately not a general URL loader: nothing a user types can make
 * the viewer fetch from another host. Phase 2 extends this with an explicit CDN
 * allow-list rather than loosening it.
 *
 * Returns the normalised path, or null if the URL is not allowed.
 */
export function resolveModelUrl(url: string, origin: string): string | null {
  // "//host/x.glb" is protocol-relative, and backslashes are normalised to
  // slashes by URL parsing, so both could escape the origin.
  if (!url.startsWith("/") || url.startsWith("//") || url.includes("\\")) return null;

  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return null;
  }

  if (parsed.origin !== origin) return null;
  if (!parsed.pathname.toLowerCase().endsWith(MODEL_EXTENSION)) return null;
  return parsed.pathname;
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
  }
}

export function sourceFromKey(key: string): ViewerSource | undefined {
  if (key.startsWith("model:")) return { kind: "model", url: key.slice("model:".length) };
  return undefined;
}
