import { BoundingBox, type AppBase, type ContainerResource, type RenderComponent } from "playcanvas";
import { OrbitControls } from "./orbit-controls";
import type { SceneContent } from "./scene-content";

// Asset.resource is typed as `object`, and the GLB parser's resource class does
// not extend ContainerResource, so check the shape rather than use instanceof.
function isContainerResource(value: object | null): value is ContainerResource {
  return typeof (value as Partial<ContainerResource> | null)?.instantiateRenderEntity === "function";
}

/**
 * Loads a glTF binary as a container asset and instantiates it.
 *
 * `url` must already have passed `resolveModelUrl`; this function does no URL
 * policy of its own.
 */
export function loadModel(app: AppBase, url: string): Promise<SceneContent> {
  return new Promise((resolve, reject) => {
    app.assets.loadFromUrl(url, "container", (err, asset) => {
      if (err || !asset) {
        // PlayCanvas keeps a failed asset registered under its URL and hands it back,
        // without the error, on the next loadFromUrl. Drop it so a retry refetches.
        if (asset) {
          app.assets.remove(asset);
          asset.unload();
        }
        reject(new Error(err ?? `Model failed to load: ${url}`));
        return;
      }

      const resource = asset.resource;
      if (!isContainerResource(resource)) {
        app.assets.remove(asset);
        asset.unload();
        reject(new Error(`Not a glTF container: ${url}`));
        return;
      }
      const root = resource.instantiateRenderEntity();

      const content: SceneContent = {
        kind: "object",
        root,
        createControls(camera, element, onChange) {
          const controls = new OrbitControls(camera, element, onChange);
          const { center, radius } = content.bounds();
          controls.frame(center, radius);
          return controls;
        },
        bounds() {
          const box = new BoundingBox();
          let empty = true;
          for (const component of root.findComponents("render") as RenderComponent[]) {
            for (const instance of component.meshInstances) {
              if (empty) box.copy(instance.aabb);
              else box.add(instance.aabb);
              empty = false;
            }
          }
          return { center: box.center.clone(), radius: Math.max(box.halfExtents.length(), 0.01) };
        },
        // Model materials come from the file; the theme only affects the backdrop.
        applyTheme() {},
        destroy() {
          root.destroy();
          app.assets.remove(asset);
          asset.unload();
        },
      };
      resolve(content);
    });
  });
}
