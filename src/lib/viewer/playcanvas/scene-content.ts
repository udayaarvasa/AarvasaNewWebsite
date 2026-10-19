import type { Entity, Vec3 } from "playcanvas";
import type { ViewerTheme } from "../types";

/** Camera controls for one kind of content (orbit around a model, look around a panorama). */
export interface ViewerControls {
  /** True while the camera still has somewhere to go, so frames are needed. */
  readonly isMoving: boolean;
  update(dt: number): void;
  setMotion(autoRotate: boolean, reducedMotion: boolean): void;
  reset(): void;
  zoomBy(factor: number): void;
  /**
   * Turn to a named view: yaw is absolute around the content (0 looks at its +Z
   * face), pitch is clamped to the controls' limits, and the zoom returns to the
   * opening distance. Optional: look-around controls have no use for it.
   */
  setView?(yawDeg: number, pitchDeg: number): void;
  destroy(): void;
}

/** Whatever a source resolves to once it is ready to be added to the scene. */
export type SceneContent = {
  /** "panorama" content supports direction projection (hotspots). */
  kind: "object" | "panorama";
  root: Entity;
  /** World-space bounds; only valid once `root` is in the scene graph. */
  bounds(): { center: Vec3; radius: number };
  applyTheme(theme: ViewerTheme): void;
  /**
   * Keep rendering this long after the content appears, the camera stops or the
   * viewer becomes visible again. Splats need it: their sort finishes in a worker,
   * after the frame that started it.
   */
  settleMs?: number;
  /** Creates the controls that suit this content; called once it is in the scene graph. */
  createControls(camera: Entity, element: HTMLElement, onChange: () => void): ViewerControls;
  /** Releases everything this content created (entities, materials, textures, assets). */
  destroy(): void;
};
