import { Entity, StandardMaterial, Vec3 } from "playcanvas";
import { mix } from "../theme";
import type { RGB, ViewerTheme } from "../types";
import { OrbitControls } from "./orbit-controls";
import type { SceneContent } from "./scene-content";

function createMaterial(gloss: number, metalness: number): StandardMaterial {
  const material = new StandardMaterial();
  material.useMetalness = true;
  material.metalness = metalness;
  material.gloss = gloss;
  return material;
}

function setDiffuse(material: StandardMaterial, [r, g, b]: RGB): void {
  material.diffuse.set(r, g, b);
  material.update();
}

/**
 * A few primitives that exercise camera, lighting, materials and theming. It
 * exists to prove the engine lifecycle, not to depict a property.
 */
export function createProceduralScene(): SceneContent {
  const root = new Entity("procedural-scene");

  const ground = createMaterial(0.2, 0);
  const primary = createMaterial(0.55, 0);
  const accent = createMaterial(0.7, 0.6);
  const neutral = createMaterial(0.4, 0);
  const materials = [ground, primary, accent, neutral];

  const add = (
    name: string,
    type: "box" | "sphere" | "cylinder",
    material: StandardMaterial,
    position: [number, number, number],
    scale: [number, number, number],
  ) => {
    const entity = new Entity(name);
    entity.addComponent("render", { type, material });
    entity.setLocalPosition(...position);
    entity.setLocalScale(...scale);
    root.addChild(entity);
  };

  add("ground", "cylinder", ground, [0, -0.025, 0], [5, 0.05, 5]);
  add("block", "box", primary, [-0.8, 0.4, 0.3], [1.2, 0.8, 1.2]);
  add("tower", "box", accent, [0.7, 0.9, -0.4], [0.6, 1.8, 0.6]);
  add("sphere", "sphere", neutral, [0.8, 0.35, 1.0], [0.7, 0.7, 0.7]);

  return {
    kind: "object",
    root,
    bounds: () => ({ center: new Vec3(0, 0.6, 0), radius: 1.9 }),
    createControls(camera, element, onChange) {
      const controls = new OrbitControls(camera, element, onChange);
      controls.frame(new Vec3(0, 0.6, 0), 1.9);
      return controls;
    },
    applyTheme(theme: ViewerTheme) {
      setDiffuse(ground, mix(theme.background, theme.foreground, 0.08));
      setDiffuse(primary, theme.foreground);
      setDiffuse(accent, theme.accent);
      setDiffuse(neutral, mix(theme.background, theme.foreground, 0.3));
    },
    destroy() {
      root.destroy();
      for (const material of materials) material.destroy();
    },
  };
}
