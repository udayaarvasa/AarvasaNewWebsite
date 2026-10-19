import { BoundingBox, type AppBase, type Asset, type ContainerResource, type RenderComponent } from "playcanvas";
import { OrbitControls } from "./orbit-controls";
import type { SceneContent } from "./scene-content";
import type { LoadProgress, ModelView } from "../types";

/**
 * Below this viewer width, in CSS pixels, a model opens on its mobile view.
 *
 * Chosen so a phone takes it and a tablet does not: at 375 px the viewer is
 * about 343 px wide, and at the 768 px breakpoint it is about 720 px. The
 * threshold sits between them with room on both sides.
 */
const NARROW_VIEWER_PX = 560;

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
 *
 * `view` is the asset's own opening camera, for models the generic object
 * framing does not suit, and `mobileView` the one to use when the viewer itself
 * is narrow. Only the pose and distance are taken from either; the orbit limits,
 * clipping and every control stay exactly as they are, so an asset can choose
 * where the camera starts but not how the viewer behaves.
 */
/**
 * Download a GLB with byte progress and return a blob URL for it.
 *
 * Only used when someone is listening for progress. Same request the asset
 * loader would make (anonymous CORS), so the CDN's policy applies unchanged;
 * a failed fetch rejects exactly as a failed asset load does.
 */
async function fetchWithProgress(url: string, onProgress: (p: LoadProgress) => void, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { mode: "cors", credentials: "omit", signal });
  if (!res.ok || !res.body) throw new Error(`Model failed to load: ${url} (${res.status})`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  onProgress({ fraction: total ? 0 : null, bytes: 0 });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    onProgress({ fraction: total ? Math.min(1, received / total) : null, bytes: received });
  }
  onProgress({ fraction: 1, bytes: received });
  return URL.createObjectURL(new Blob(chunks as BlobPart[], { type: "model/gltf-binary" }));
}

export async function loadModel(
  app: AppBase,
  url: string,
  view?: ModelView,
  mobileView?: ModelView,
  load: { onProgress?: (progress: LoadProgress) => void; signal?: AbortSignal } = {},
): Promise<SceneContent> {
  const blobUrl = load.onProgress ? await fetchWithProgress(url, load.onProgress, load.signal) : null;
  try {
    return await instantiate(app, url, blobUrl, view, mobileView);
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}

function instantiate(
  app: AppBase,
  url: string,
  blobUrl: string | null,
  view?: ModelView,
  mobileView?: ModelView,
): Promise<SceneContent> {
  return new Promise((resolve, reject) => {
    const done = (err: string | null, asset?: Asset) => {
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
          /* Measured on the viewer element, not the window: a narrow viewer in
             a wide page has the same problem a phone does, and the pixels the
             camera has to work with are the panel's, not the viewport's. */
          const narrow = element.clientWidth > 0 && element.clientWidth < NARROW_VIEWER_PX;
          const chosen = (narrow && mobileView) || view;
          controls.frame(center, radius, chosen
            ? { yawDeg: chosen.yawDeg, pitchDeg: chosen.pitchDeg, distanceFactor: chosen.distanceFactor }
            : {});
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
    };
    const cb = (err: string | null, asset?: Asset) => done(err, asset);
    // A blob URL carries no extension, so name the file for the glTF parser.
    if (blobUrl) app.assets.loadFromUrlAndFilename(blobUrl, "scene.glb", "container", cb);
    else app.assets.loadFromUrl(url, "container", cb);
  });
}
