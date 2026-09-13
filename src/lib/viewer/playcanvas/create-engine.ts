import {
  AppBase,
  AppOptions,
  CameraComponentSystem,
  Color,
  ContainerHandler,
  Entity,
  LightComponentSystem,
  RenderComponentSystem,
  RESOLUTION_AUTO,
  TextureHandler,
  WebglGraphicsDevice,
} from "playcanvas";
import { resolveModelUrl } from "../source";
import type { RGB, ViewerEngine, ViewerEngineOptions, ViewerSource, ViewerTheme } from "../types";
import { loadModel } from "./model-loader";
import { OrbitControls } from "./orbit-controls";
import { createProceduralScene } from "./procedural-scene";
import type { SceneContent } from "./scene-content";

// Only used to give each canvas a unique id. PlayCanvas keeps a static
// application registry keyed by canvas id, so two viewers sharing an id (or the
// empty id) would overwrite each other's entry.
let canvasSerial = 0;

const toColor = ([r, g, b]: RGB) => new Color(r, g, b);

/**
 * Creates one self-contained PlayCanvas viewer inside `host`.
 *
 * Browser-only. The public React component reaches this module solely through a
 * dynamic `import()` inside an effect, so it is never evaluated on the server
 * and never part of a route's initial JavaScript.
 *
 * Throws if a WebGL 2 context cannot be created.
 */
export function createViewerEngine(host: HTMLElement, options: ViewerEngineOptions): ViewerEngine {
  if (typeof window === "undefined") {
    throw new Error("createViewerEngine must only run in the browser");
  }

  const canvas = document.createElement("canvas");
  canvas.id = `aarvasa-viewer-${++canvasSerial}`;
  canvas.className = "block h-full w-full touch-none select-none outline-none";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", options.canvasLabel);
  host.appendChild(canvas);

  let device: WebglGraphicsDevice;
  try {
    device = new WebglGraphicsDevice(canvas, { antialias: true, alpha: false, powerPreference: "default" });
  } catch (error) {
    canvas.remove();
    throw error;
  }
  // The engine takes min(devicePixelRatio, maxPixelRatio) on every resize.
  device.maxPixelRatio = options.maxPixelRatio;

  // AppBase with only the systems we use, rather than `Application`, which
  // registers every component system, audio, XR and the lightmapper.
  const appOptions = new AppOptions();
  appOptions.graphicsDevice = device;
  appOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
  appOptions.resourceHandlers = [TextureHandler, ContainerHandler];

  const app = new AppBase(canvas);
  app.init(appOptions);
  app.setCanvasResolution(RESOLUTION_AUTO);

  const camera = new Entity("camera");
  camera.addComponent("camera", {
    fov: 40,
    nearClip: 0.05,
    farClip: 200,
    clearColor: toColor(options.theme.background),
  });
  app.root.addChild(camera);

  const light = new Entity("key-light");
  light.addComponent("light", { type: "directional", intensity: 1.2 });
  light.setEulerAngles(50, 30, 0);
  app.root.addChild(light);
  app.scene.ambientLight = new Color(0.45, 0.45, 0.45);

  // ── Render loop ──────────────────────────────────────────────────────────
  // PlayCanvas re-schedules requestAnimationFrame every tick for as long as the
  // app lives, even with autoRender off. Instead the loop is stopped whenever
  // nothing is changing, and restarted on demand.
  let destroyed = false;
  let active = false;
  let running = false;
  let pendingFrames = 0;

  const setLoopState = (state: "running" | "paused") => {
    running = state === "running";
    canvas.dataset.renderLoop = state; // diagnostics only
  };

  const startLoop = () => {
    if (destroyed || running || !active || device.contextLost) return;
    setLoopState("running");
    app.requestAnimationFrame();
  };

  const stopLoop = () => {
    AppBase.cancelTick(app);
    setLoopState("paused");
  };

  const requestFrame = () => {
    pendingFrames = Math.max(pendingFrames, 1);
    startLoop();
  };

  const controls = new OrbitControls(camera, canvas, requestFrame);

  app.on("update", (dt: number) => controls.update(dt));
  app.on("frameend", () => {
    if (pendingFrames > 0) pendingFrames--;
    if (!active || (pendingFrames === 0 && !controls.isMoving)) stopLoop();
  });

  device.on("devicelost", () => {
    stopLoop();
    options.onContextLost();
  });
  device.on("devicerestored", () => {
    options.onContextRestored();
    requestFrame();
  });

  const resizeObserver = new ResizeObserver(() => {
    app.updateCanvasSize();
    requestFrame();
  });
  resizeObserver.observe(host);

  // ── Content ──────────────────────────────────────────────────────────────
  let theme: ViewerTheme = options.theme;
  let content: SceneContent | null = null;
  let sourceRequest = 0;

  const show = (next: SceneContent) => {
    content?.destroy();
    content = next;
    app.root.addChild(next.root);
    next.applyTheme(theme);
    const { center, radius } = next.bounds();
    controls.frame(center, radius);
  };

  // start() runs system initialisation and schedules the first tick.
  setLoopState("running");
  app.start();

  return {
    async setSource(source: ViewerSource | undefined) {
      if (destroyed) return;
      const request = ++sourceRequest;

      let next: SceneContent;
      if (!source) {
        next = createProceduralScene();
      } else {
        switch (source.kind) {
          case "model": {
            const url = resolveModelUrl(source.url, window.location.origin);
            if (!url) throw new Error("Model URL is not allowed: use a same-origin .glb path");
            next = await loadModel(app, url);
            break;
          }
        }
      }

      // Superseded by a newer source, or the viewer went away while loading.
      // After destroy() the app has already released every asset it loaded.
      if (destroyed) return;
      if (request !== sourceRequest) {
        next.destroy();
        return;
      }
      show(next);
    },

    setTheme(next: ViewerTheme) {
      if (destroyed) return;
      theme = next;
      if (camera.camera) camera.camera.clearColor = toColor(next.background);
      content?.applyTheme(next);
      requestFrame();
    },

    setActive(next: boolean) {
      if (destroyed || active === next) return;
      active = next;
      if (active) requestFrame();
      else stopLoop();
    },

    setMotion({ autoRotate, reducedMotion }) {
      if (destroyed) return;
      controls.setMotion(autoRotate, reducedMotion);
    },

    resetView() {
      if (destroyed) return;
      controls.reset();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;

      resizeObserver.disconnect();
      controls.destroy();
      stopLoop();

      // Called from React effect cleanup, never from inside a tick, so this is
      // synchronous. It destroys entities, materials, loaded assets and the
      // device, and cancels the pending animation frame.
      const gl = device.gl;
      app.destroy();

      // app.destroy() frees GPU resources but leaves the context alive until
      // garbage collection. Release it now so repeated mounts and client-side
      // navigation cannot run into the browser's live-context limit.
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
}
