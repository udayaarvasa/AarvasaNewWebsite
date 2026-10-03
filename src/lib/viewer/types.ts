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

/** Where a splat scene opens: an orbit around the scene's centre, in degrees. Positive pitch looks down on the scene. */
export type SplatView = {
  yawDeg: number;
  pitchDeg: number;
  /** Camera distance as a multiple of the scene's bounding radius. */
  distanceFactor: number;
};

/**
 * Where a model opens: an orbit around its centre, in degrees.
 *
 * The default framing suits a standalone object seen whole. A building is not
 * that: at 2.8x its bounding radius a tower is small enough that facade
 * articulation — the thing that distinguishes one from another — is below the
 * threshold of the display, and the visitor has to zoom before the model says
 * anything. An asset that is tall and detailed can state its own opening
 * distance instead.
 */
export type ModelView = {
  yawDeg: number;
  pitchDeg: number;
  /** Camera distance as a multiple of the model's bounding radius. */
  distanceFactor: number;
};

/** A sphere around the scene, in scene units. */
export type SplatBounds = { center: readonly [number, number, number]; radius: number };

/**
 * What the viewer displays. A discriminated union so new asset kinds can be
 * added without changing the public component's props. `model` is a glTF
 * binary (Phase 1); `panorama` is one equirectangular 360° image (Phase 6);
 * `splat` is a Gaussian splat scene in the bundled SOG format (Phase 7).
 */
export type ViewerSource =
  | {
      kind: "model";
      /** Same-origin, root-relative `.glb` path, or a `.glb` URL on the media CDN. See `resolveModelUrl`. */
      url: string;
      /** Opening camera for this model. Absent uses the generic object framing. */
      initialView?: ModelView;
      /**
       * Opening camera when the viewer itself is narrow. A framing that reads
       * on a wide panel can leave a tall subject unreadably small on a phone,
       * where the same camera has a fraction of the pixels to work with.
       * Absent falls back to `initialView`.
       */
      mobileInitialView?: ModelView;
    }
  | {
      kind: "panorama";
      /** Same-origin `.jpg`/`.webp` path, or a published `m/…` panorama on the media CDN. See `resolvePanoramaUrl`. */
      url: string;
      initialView: PanoramaView;
    }
  | {
      kind: "splat";
      /** Same-origin `.sog` path, or a published `m/…/*.sog` on the media CDN. See `resolveSplatUrl`. */
      url: string;
      initialView: SplatView;
      /**
       * "y-down" rotates the scene 180° about X, for captures still in the
       * original 3DGS/COLMAP frame. Default "y-up" (PlayCanvas / SuperSplat convention).
       */
      upAxis: "y-up" | "y-down";
      /** Published metadata, checked before anything is downloaded. Absent values are checked after download. */
      sizeBytes: number | null;
      gaussians: number | null;
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

/**
 * XR (Phase 8). Kept structural so this file still imports nothing: the
 * capability, contract and lifecycle modules define the same shapes.
 */
export type ViewerXrEvent =
  | { type: "started" }
  | { type: "ended" }
  | { type: "failed"; kind: "unsupported" | "denied" | "failed" | "lost" }
  /** AR only: whether a real-world surface is currently detected. */
  | { type: "surface"; found: boolean };

export type ViewerXrStart = {
  mode: "ar" | "vr";
  /** Deterministic model scale: metres per model unit × the project's preview factor. */
  scale: { metersPerUnit: number; previewScale: number };
  /**
   * Element to show over the camera feed in AR, where the browser supports it.
   * Typed loosely (an Element at runtime) so this file stays DOM-free.
   */
  domOverlayRoot?: unknown;
  onEvent: (event: ViewerXrEvent) => void;
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
  /**
   * Downloads and builds the XR runtime before it is needed, so the visitor's
   * first AR/VR tap is not spent waiting for the device availability check.
   * Safe to call repeatedly; does nothing when XR cannot apply.
   */
  prepareXr(): Promise<void>;
  /**
   * Starts an XR session for the model currently shown. Downloads the XR code
   * on first use. Never called without an explicit user gesture; failures are
   * reported through `onEvent`, never thrown.
   */
  startXr(options: ViewerXrStart): Promise<void>;
  /** Ends the session the viewer started ("ended" follows through `onEvent`). */
  endXr(): void;
  /** AR: place the model where the reticle is, or start looking for a surface again. */
  xrPlace(): void;
  xrResetPlacement(): void;
  /** Applies the turn and scale the state machine has already clamped. */
  xrSetTransform(rotationDeg: number, scale: number): void;
  destroy(): void;
}
