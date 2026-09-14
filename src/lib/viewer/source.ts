import type { ViewerSource } from "./types";

const MODEL_EXTENSION = ".glb";

/**
 * Restricts model URLs to same-origin, root-relative `.glb` paths, or to
 * absolute HTTPS `.glb` URLs on an explicitly allowed media CDN origin.
 *
 * This is deliberately not a general URL loader: nothing a user types can make
 * the viewer fetch from a host outside `cdnOrigins`.
 *
 * Returns the normalised path or URL, or null if the URL is not allowed.
 */
export function resolveModelUrl(url: string, origin: string, cdnOrigins: readonly string[]): string | null {
  // Backslashes are normalised to slashes by URL parsing, so they could change the host.
  if (url.includes("\\")) return null;

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
    if (!parsed.pathname.toLowerCase().endsWith(MODEL_EXTENSION)) return null;
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
  if (!parsed.pathname.toLowerCase().endsWith(MODEL_EXTENSION)) return null;
  return parsed.href;
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
