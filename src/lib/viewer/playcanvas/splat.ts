import { Asset, Entity, GSplatComponentSystem, GSplatHandler, Vec3, type AppBase } from "playcanvas";
import { inspectSogBundle, SogBundleError, type Inflate } from "../sog-bundle";
import { downloadSog, SplatLoadError } from "../splat-download";
import { SPLAT_VIEW_LIMITS } from "../source";
import { assessSplat, SPLAT_LIMITS, splatBudgetFor, type DeviceClass } from "../splat-budget";
import type { ViewerSource } from "../types";
import { OrbitControls } from "./orbit-controls";
import type { SceneContent } from "./scene-content";

type SplatSource = Extract<ViewerSource, { kind: "splat" }>;

const abortError = () => new DOMException("Splat load was superseded", "AbortError");

/** DecompressionStream-based inflate for meta.json (the engine itself uses the same API). */
const inflate: Inflate = async (compressed) => {
  const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const prepared = new WeakSet<AppBase>();

/**
 * Registers the engine's Gaussian splat support on first use, so model and
 * panorama viewers never construct it. `requestFrame` is called whenever the
 * splat renderer needs another frame (a sort result or streaming step is
 * pending, or the drawn state is not yet the sorted one), which keeps
 * render-on-demand from stopping on an unsorted or empty image.
 */
function prepareApp(app: AppBase, device: DeviceClass, requestFrame: () => void): void {
  if (prepared.has(app)) return;
  prepared.add(app);
  const system = new GSplatComponentSystem(app);
  app.systems.add(system);
  app.loader.addHandler("gsplat", new GSplatHandler(app));
  system.on(GSplatComponentSystem.EVENT_FRAMEREQUEST, requestFrame);
  // Sorting runs in a worker, so the frame that starts a sort is not the one that shows
  // it. Keep drawing until the renderer reports the sorted state has caught up.
  system.on(GSplatComponentSystem.EVENT_FRAMEREADY, (_camera: unknown, _layer: unknown, ready: boolean, loadingCount: number) => {
    if (!ready || loadingCount > 0) requestFrame();
  });
  app.scene.on("gsplat:sorted", requestFrame);
  // Only meaningful for streamed (LOD) scenes; for a single SOG it sizes the allocator.
  app.scene.gsplat.splatBudget = splatBudgetFor(device);
}

/**
 * Loads one published SOG bundle and returns it as scene content: an entity
 * with a `gsplat` component, framed by orbit controls around the scene's bounds.
 *
 * `url` must already have passed `resolveSplatUrl`. `signal` cancels an
 * obsolete load at any stage (download, parse, GPU upload); nothing is kept and
 * the promise rejects with an AbortError.
 */
export async function loadSplat(
  app: AppBase,
  url: string,
  source: SplatSource,
  signal: AbortSignal,
  context: { device: DeviceClass; requestFrame: () => void },
): Promise<SceneContent> {
  const maxBytes = context.device === "constrained" ? SPLAT_LIMITS.bytes.desktopTarget : SPLAT_LIMITS.bytes.hardLimit;
  const bytes = await downloadSog(url, signal, maxBytes);
  if (signal.aborted) throw abortError();

  let summary;
  try {
    summary = await inspectSogBundle(bytes, inflate);
  } catch (error) {
    if (error instanceof SogBundleError) {
      throw new SplatLoadError("format", error.code === "unsupported-version" ? "This 3D scan uses an unsupported SOG version." : "The 3D scan file is damaged or not a supported SOG bundle.");
    }
    throw error;
  }
  const verdict = assessSplat({ sizeBytes: bytes.byteLength, gaussians: summary.gaussians }, context.device);
  if (verdict.verdict === "too-large") throw new SplatLoadError("too-large", verdict.reason);
  if (signal.aborted) throw abortError();

  prepareApp(app, context.device, context.requestFrame);

  const asset = new Asset("splat", "gsplat", { url, filename: "scene.sog", contents: bytes.buffer as ArrayBuffer });
  const release = () => {
    app.assets.remove(asset);
    asset.unload();
  };
  app.assets.add(asset);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      // Removing the asset makes the parser discard its work and free its textures.
      release();
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    asset.once("load", () => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    });
    // The engine's message can include file names; the visitor gets a fixed one.
    asset.once("error", () => {
      signal.removeEventListener("abort", onAbort);
      release();
      reject(new SplatLoadError("format", "The 3D scan could not be decoded."));
    });
    app.assets.load(asset);
  });
  // The parser has uploaded everything; drop the CPU copy of the download.
  const file = asset.file as { contents?: unknown } | null;
  if (file) file.contents = null;

  const root = new Entity("splat");
  if (source.upAxis === "y-down") root.setLocalEulerAngles(180, 0, 0);
  root.addComponent("gsplat", { asset });

  const [cx, cy, cz] = summary.bounds.center;
  const center = source.upAxis === "y-down" ? new Vec3(cx, -cy, -cz) : new Vec3(cx, cy, cz);
  const radius = summary.bounds.radius;
  const view = source.initialView;
  const L = SPLAT_VIEW_LIMITS;

  return {
    kind: "object",
    root,
    bounds: () => ({ center: center.clone(), radius }),
    // Belt and braces with frame:ready: a bounded window of frames after changes.
    settleMs: 500,
    applyTheme() {},
    createControls(camera, element, onChange) {
      const cam = camera.camera;
      if (cam) {
        // Clip planes follow the scene's size, with the orbit kept well inside them.
        cam.nearClip = Math.max(radius * 0.005, 1e-3);
        cam.farClip = radius * (L.maxDistanceFactor + 4);
      }
      const controls = new OrbitControls(camera, element, onChange);
      controls.frame(center, radius, {
        yawDeg: view.yawDeg,
        pitchDeg: view.pitchDeg,
        distanceFactor: view.distanceFactor,
        minPitchDeg: L.minPitchDeg,
        maxPitchDeg: L.maxPitchDeg,
        minDistanceFactor: L.minDistanceFactor,
        maxDistanceFactor: L.maxDistanceFactor,
      });
      return controls;
    },
    destroy() {
      root.destroy();
      release();
    },
  };
}
