/**
 * Shared types for the Aarvasa 3D viewer.
 *
 * This file must never import `playcanvas`: it is used by the public React
 * component, which renders on the server, and by the engine, which only ever
 * runs in the browser.
 */

/**
 * What the viewer displays. A discriminated union so new asset kinds
 * (panoramas, splats) can be added without changing the public component's
 * props. Phase 1 implements `model` (glTF binary) only.
 */
export type ViewerSource = {
  kind: "model";
  /** Same-origin, root-relative `.glb` path, or a `.glb` URL on the media CDN. See `resolveModelUrl`. */
  url: string;
};

export type ViewerSourceKind = ViewerSource["kind"];

/** Lifecycle of one viewer instance, as shown to the user. */
export type ViewerStatus =
  | "idle" // waiting to be scrolled into view or for the user to opt in
  | "unsupported" // WebGL 2 unavailable; the engine is never downloaded
  | "loading" // engine chunk and/or asset in flight
  | "ready"
  | "error"
  | "context-lost"; // the browser dropped the GPU context; waiting for restore

/** sRGB colour, each channel 0–1. */
export type RGB = readonly [number, number, number];

/** Colours the scene takes from the site's existing CSS theme variables. */
export type ViewerTheme = {
  background: RGB;
  foreground: RGB;
  accent: RGB;
};

export type ViewerEngineOptions = {
  /** Upper bound on rendering resolution relative to CSS pixels. */
  maxPixelRatio: number;
  /** Accessible name for the interactive canvas. */
  canvasLabel: string;
  /** Applied before the first frame, so the canvas never flashes the engine's default grey. */
  theme: ViewerTheme;
  onContextLost: () => void;
  onContextRestored: () => void;
};

/**
 * One engine instance, owning its own canvas, GPU context and listeners.
 * Every method is a no-op once `destroy()` has run.
 */
export interface ViewerEngine {
  /** Resolves once the source is on screen; rejects if it cannot be shown. */
  setSource(source: ViewerSource | undefined): Promise<void>;
  setTheme(theme: ViewerTheme): void;
  /** False pauses the render loop entirely (off-screen or hidden tab). */
  setActive(active: boolean): void;
  setMotion(motion: { autoRotate: boolean; reducedMotion: boolean }): void;
  resetView(): void;
  destroy(): void;
}
