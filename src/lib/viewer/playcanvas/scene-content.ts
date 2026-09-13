import type { Entity, Vec3 } from "playcanvas";
import type { ViewerTheme } from "../types";

/** Whatever a source resolves to once it is ready to be added to the scene. */
export type SceneContent = {
  root: Entity;
  /** World-space bounds; only valid once `root` is in the scene graph. */
  bounds(): { center: Vec3; radius: number };
  applyTheme(theme: ViewerTheme): void;
  /** Releases everything this content created (entities, materials, assets). */
  destroy(): void;
};
