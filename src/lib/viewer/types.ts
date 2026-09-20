/**
 * Shared types for the Aarvasa 3D viewer.
 *
 * This file must never import `playcanvas`: it is used by the public React
 * component, which renders on the server, and by the engine, which only ever
 * runs in the browser.
 */

/** Where a panorama opens, in degrees. Yaw 0 faces the centre of the equirectangular image; positive yaw turns right, positive pitch looks up. */
export type PanoramaView = {
  yawDeg: number;
  pitchDeg: number;
  /** Vertical field of view. */
  fovDeg: number;
};

/**
 * What the viewer displays. A discriminated union so new asset kinds can be
 * added without changing the public component's props. `model` is a glTF
 * binary (Phase 1); `panorama` is one equirectangular 360° image (Phase 6).
 * Splats are not supported.
 */
export type ViewerSource =
  | {
      kind: "model";
      /** Same-origin, root-relative `.glb` path, or a `.glb` URL on the media CDN. See `resolveModelUrl`. */
      url: string;
    }
  | {
      kind: "panorama";
      /** Same-origin `.jpg`/`.webp` path, or a published `m/…` panorama on the media CDN. See `resolvePanoramaUrl`. */
      url: string;
      initialView: PanoramaView;
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
  /** Multiplies the zoom (orbit distance or panorama field of view); < 1 zooms in. */
  zoomBy(factor: number): void;
  /**
   * Where a direction on the panorama sphere appears on the canvas, in CSS
   * pixels from its top-left corner, or null when it is behind the camera or no
   * panorama is shown.
   */
  projectDirection(yawDeg: number, pitchDeg: number): { x: number; y: number } | null;
  /** Called after every rendered frame in which the view changed. Returns an unsubscribe function. */
  onViewChange(listener: () => void): () => void;
  destroy(): void;
}
