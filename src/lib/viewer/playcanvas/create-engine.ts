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
  Vec3,
  WebglGraphicsDevice,
} from "playcanvas";
import { detectDeviceClass } from "../capabilities";
import { LoadGate } from "../load-gate";
import { RenderDemand } from "../render-demand";
import { MEDIA_CDN_ORIGIN } from "../media-origin";
import { resolveModelUrl, resolvePanoramaUrl, resolveSplatUrl } from "../source";
import type { RGB, ViewerEngine, ViewerEngineOptions, ViewerSource, ViewerTheme, ViewerXrStart } from "../types";
import { directionFor } from "./look-controls";
import { loadModel } from "./model-loader";
import { loadPanorama } from "./panorama";
import { createProceduralScene } from "./procedural-scene";
import type { SceneContent, ViewerControls } from "./scene-content";
import type { XrRuntime } from "./xr";

/** Field of view for models; panoramas set their own. */
const OBJECT_FOV = 40;
const NEAR_CLIP = 0.05;
const FAR_CLIP = 200;
/** Hotspot projection distance; anything inside the panorama sphere projects the same. */
const PROJECT_DISTANCE = 10;

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
    // xrCompatible: false — the viewer never starts an XR session, so it never asks for an XR-capable context.
    device = new WebglGraphicsDevice(canvas, { antialias: true, alpha: false, powerPreference: "default", xrCompatible: false });
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
    fov: OBJECT_FOV,
    nearClip: NEAR_CLIP,
    farClip: FAR_CLIP,
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
  // Decides when the loop may stop (pending frames, camera motion, content settle window).
  const demand = new RenderDemand();

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
    demand.request();
    startLoop();
  };

  // Created by the content being shown: orbit for models, look-around for panoramas.
  let controls: ViewerControls | null = null;
  let motion = { autoRotate: false, reducedMotion: false };
  const viewListeners = new Set<() => void>();

  // An XR session drives its own frames and its own camera pose.
  let xr: XrRuntime | null = null;
  let xrActive = false;

  app.on("update", (dt: number) => {
    // Start of a frame: requests made from here on (the splat renderer asks during render) are for the next one.
    demand.frameStarted();
    if (!xrActive) controls?.update(dt);
  });
  app.on("frameend", () => {
    for (const listener of viewListeners) listener();
    // While a session is running the headset asks for every frame: never stand down.
    if (xrActive) return;
    if (!demand.frameEnded({ active, moving: controls?.isMoving ?? false }, performance.now())) stopLoop();
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
  // A newer source makes any in-flight load obsolete: its download is aborted and its result discarded.
  const loads = new LoadGate();

  // Only one piece of content (and so one panorama texture) is resident at a time.
  const show = (next: SceneContent) => {
    content?.destroy();
    controls?.destroy();
    content = next;
    app.root.addChild(next.root);
    next.applyTheme(theme);
    if (camera.camera) {
      // Content may set its own (splats scale clip planes to the scene); start from the defaults.
      camera.camera.fov = OBJECT_FOV;
      camera.camera.nearClip = NEAR_CLIP;
      camera.camera.farClip = FAR_CLIP;
    }
    demand.contentShown(next.settleMs ?? 0, performance.now());
    controls = next.createControls(camera, canvas, requestFrame);
    controls.setMotion(motion.autoRotate, motion.reducedMotion);
    requestFrame();
  };

  const projected = new Vec3();
  const direction = new Vec3();

  // start() runs system initialisation and schedules the first tick.
  setLoopState("running");
  app.start();

  return {
    async setSource(source: ViewerSource | undefined) {
      if (destroyed) return;
      const ticket = loads.begin();
      const cdnOrigins = MEDIA_CDN_ORIGIN ? [MEDIA_CDN_ORIGIN] : [];

      let next: SceneContent;
      if (!source) {
        next = createProceduralScene();
      } else {
        switch (source.kind) {
          case "model": {
            const url = resolveModelUrl(source.url, window.location.origin, cdnOrigins);
            if (!url) throw new Error("Model URL is not allowed: use a same-origin .glb path or the media CDN");
            next = await loadModel(app, url, source.initialView, source.mobileInitialView);
            break;
          }
          case "panorama": {
            const url = resolvePanoramaUrl(source.url, window.location.origin, cdnOrigins);
            if (!url) throw new Error("Panorama URL is not allowed: use a same-origin image or a published panorama on the media CDN");
            next = await loadPanorama(app, url, source.initialView, ticket.signal);
            break;
          }
          case "splat": {
            const url = resolveSplatUrl(source.url, window.location.origin, cdnOrigins);
            if (!url) throw new Error("3D scan URL is not allowed: use a same-origin .sog or a published scan on the media CDN");
            // Separate chunk: the engine's Gaussian splat support is only downloaded for splats.
            const { loadSplat } = await import("./splat");
            if (!ticket.isCurrent()) throw new DOMException("Splat load was superseded", "AbortError");
            next = await loadSplat(app, url, source, ticket.signal, { device: detectDeviceClass(), requestFrame });
            break;
          }
        }
      }

      // Superseded by a newer source, or the viewer went away while loading.
      // After destroy() the app has already released every asset it loaded.
      if (destroyed) return;
      if (!ticket.isCurrent()) {
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
      if (active) {
        demand.activated(performance.now());
        startLoop();
      } else {
        stopLoop();
      }
    },

    setMotion({ autoRotate, reducedMotion }) {
      if (destroyed) return;
      motion = { autoRotate, reducedMotion };
      controls?.setMotion(autoRotate, reducedMotion);
    },

    resetView() {
      if (destroyed) return;
      controls?.reset();
    },

    zoomBy(factor: number) {
      if (destroyed || !Number.isFinite(factor) || factor <= 0) return;
      controls?.zoomBy(factor);
    },

    projectDirection(yawDeg: number, pitchDeg: number) {
      if (destroyed || content?.kind !== "panorama" || !camera.camera) return null;
      directionFor(yawDeg, pitchDeg, direction);
      // Behind the camera, a projection would mirror onto the screen.
      if (direction.dot(camera.forward) <= 0.05) return null;
      direction.mulScalar(PROJECT_DISTANCE);
      camera.camera.worldToScreen(direction, projected);
      return { x: projected.x, y: projected.y };
    },

    async prepareXr() {
      // Builds the XR runtime ahead of the visitor's first tap: PlayCanvas checks
      // device availability asynchronously and refuses to start until it answers.
      if (destroyed || xr || content?.kind !== "object") return;
      try {
        const { XrRuntime } = await import("./xr");
        if (destroyed || xr) return;
        xr = new XrRuntime(app, camera, () => content?.root ?? null, requestFrame);
      } catch {
        // Leave it null: startXr reports the failure to the visitor.
      }
    },

    async startXr(options: ViewerXrStart) {
      if (destroyed) return;
      // Only a model can go into XR; the page never offers it for anything else.
      if (content?.kind !== "object") {
        options.onEvent({ type: "failed", kind: "unsupported" });
        return;
      }
      try {
        if (!xr) {
          // Separate chunk: PlayCanvas's XR code is only downloaded when XR is offered or requested.
          const { XrRuntime } = await import("./xr");
          if (destroyed) return;
          xr = new XrRuntime(app, camera, () => content?.root ?? null, requestFrame);
        }
      } catch {
        options.onEvent({ type: "failed", kind: "failed" });
        return;
      }
      xr.start({
        ...options,
        onEvent: (event) => {
          if (event.type === "started") {
            xrActive = true;
            startLoop();
          } else if (event.type === "ended" || event.type === "failed") {
            xrActive = false;
            requestFrame();
          }
          options.onEvent(event);
        },
      });
    },

    endXr() {
      xr?.end();
    },

    xrPlace() {
      xr?.place();
    },

    xrResetPlacement() {
      xr?.resetPlacement();
    },

    xrSetTransform(rotationDeg: number, scale: number) {
      xr?.setTransform(rotationDeg, scale);
    },

    onViewChange(listener: () => void) {
      if (destroyed) return () => {};
      viewListeners.add(listener);
      requestFrame();
      return () => {
        viewListeners.delete(listener);
      };
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;

      loads.close();
      xr?.destroy();
      xr = null;
      xrActive = false;
      viewListeners.clear();
      resizeObserver.disconnect();
      controls?.destroy();
      content?.destroy();
      content = null;
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
