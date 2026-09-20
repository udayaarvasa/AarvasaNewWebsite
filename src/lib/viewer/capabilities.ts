import { classifyDevice, type DeviceClass } from "./splat-budget";

/**
 * Browser capability checks for the 3D viewer. Every function is safe to call
 * during server rendering, where it reports "not supported" / defaults.
 */

export function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export type WebGLSupport = {
  /** Required: PlayCanvas engine v2 only creates WebGL 2 contexts. */
  webgl2: boolean;
  /** Informational only, so the fallback can explain why 3D is unavailable. */
  webgl1: boolean;
};

function probe(type: "webgl2" | "webgl"): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = type === "webgl2" ? canvas.getContext("webgl2") : canvas.getContext("webgl");
    if (!gl) return false;
    // Hand the probe context straight back so it never counts against the
    // browser's live-context limit.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Probes for WebGL by creating and immediately releasing a throwaway context.
 * Not cached: it is cheap, and a cache would hide a GPU that becomes
 * unavailable mid-session.
 */
export function detectWebGL(): WebGLSupport {
  if (!isBrowser()) return { webgl2: false, webgl1: false };
  const webgl2 = probe("webgl2");
  return { webgl2, webgl1: webgl2 || probe("webgl") };
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return isBrowser() && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function subscribeReducedMotion(onChange: () => void): () => void {
  if (!isBrowser()) return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function isDocumentVisible(): boolean {
  return !isBrowser() || document.visibilityState === "visible";
}

export function subscribeDocumentVisibility(onChange: () => void): () => void {
  if (!isBrowser()) return () => {};
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

export function isFullscreenSupported(): boolean {
  return isBrowser() && document.fullscreenEnabled === true;
}

export function subscribeFullscreen(onChange: () => void): () => void {
  if (!isBrowser()) return () => {};
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
}

/** Device class for splat budgets; see classifyDevice. "standard" during server rendering. */
export function detectDeviceClass(): DeviceClass {
  if (!isBrowser()) return "standard";
  return classifyDevice({
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    deviceMemoryGb: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
  });
}
