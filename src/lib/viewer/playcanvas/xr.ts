import {
  Color,
  Entity,
  StandardMaterial,
  Vec3,
  XRSPACE_LOCALFLOOR,
  XRSPACE_VIEWER,
  XRTRACKABLE_PLANE,
  XRTRACKABLE_POINT,
  XRTYPE_AR,
  XRTYPE_VR,
  XrManager,
  type AppBase,
  type XrHitTestSource,
  type XrInputSource,
} from "playcanvas";
import type { XrMode } from "../xr-capabilities";
import type { XrScale } from "../xr-contract";
import { classifyXrError, type XrErrorKind } from "../xr-session";

/**
 * The PlayCanvas side of Phase 8: it starts and ends WebXR sessions and reports
 * what happened. All policy (what may start, placement order, transform limits)
 * lives in the pure state machine (src/lib/viewer/xr-session.ts); this module
 * only carries it out and feeds real session events back.
 *
 * Loaded from a separate chunk, and PlayCanvas's XrManager is attached to the
 * app on first use, so viewers that never enter XR neither download nor
 * construct it.
 */

export type XrRuntimeEvent =
  | { type: "started" }
  | { type: "ended" }
  | { type: "failed"; kind: XrErrorKind }
  | { type: "surface"; found: boolean };

export type XrStartOptions = {
  mode: XrMode;
  scale: XrScale;
  /** Element shown over the camera feed in AR, where the browser supports it. */
  domOverlayRoot?: unknown;
  onEvent: (event: XrRuntimeEvent) => void;
};

/** How far in front of the visitor a VR walkthrough places the model, in metres. */
const VR_MODEL_DISTANCE = 2.5;
/** Teleport stops around the model: bounded, point-to-point movement (no continuous locomotion). */
const VR_STOP_ANGLES = [0, 60, 120, 180, 240, 300];
const VR_STOP_RADIUS = 2.5;
const RETICLE_RADIUS = 0.12;
/** No hit results for this long means the surface was lost. */
const SURFACE_TIMEOUT_MS = 500;

const DEG = Math.PI / 180;

type Pose = { position: Vec3; rotation: Vec3; scale: Vec3 };

const capturePose = (entity: Entity): Pose => ({
  position: entity.getLocalPosition().clone(),
  rotation: entity.getLocalEulerAngles().clone(),
  scale: entity.getLocalScale().clone(),
});

const restorePose = (entity: Entity, pose: Pose) => {
  entity.setLocalPosition(pose.position);
  entity.setLocalEulerAngles(pose.rotation);
  entity.setLocalScale(pose.scale);
};

function flatMaterial(color: Color, opacity = 1): StandardMaterial {
  const material = new StandardMaterial();
  material.useLighting = false;
  material.useSkybox = false;
  material.useFog = false;
  material.emissive = color;
  material.diffuse = new Color(0, 0, 0);
  material.opacity = opacity;
  material.blendType = opacity < 1 ? 2 /* BLEND_NORMAL */ : 0;
  material.depthWrite = opacity >= 1;
  material.update();
  return material;
}

/**
 * Owns at most one XR session for one viewer engine.
 *
 * AR: the published model is parented to a placement entity that follows a
 * hit-test reticle until the visitor places it, then stays put while they turn
 * and resize it. VR: the model is put a fixed distance in front of the
 * visitor, with teleport stops around it.
 */
export class XrRuntime {
  private readonly manager: XrManager;
  private placement: Entity | null = null;
  private reticle: Entity | null = null;
  private rig: Entity | null = null;
  private stops: Entity[] = [];
  private pointers = new Map<XrInputSource, Entity>();
  private hitTestSource: XrHitTestSource | null = null;
  private lastHitAt = 0;
  private surfaceFound = false;
  private placed = false;
  private options: XrStartOptions | null = null;
  private contentPose: Pose | null = null;
  private cameraPose: Pose | null = null;
  private cameraClear: Color | null = null;
  private readonly cleanups: (() => void)[] = [];
  private destroyed = false;

  constructor(
    private readonly app: AppBase,
    private readonly camera: Entity,
    /** The model currently on screen, or null when the viewer shows something else. */
    private readonly contentRoot: () => Entity | null,
    private readonly requestFrame: () => void,
  ) {
    // PlayCanvas only creates its XR manager when the app is built with one; the
    // viewer's app is not, so it is attached here, the first time XR is used.
    const existing = (app as AppBase & { xr: XrManager | null }).xr;
    this.manager = existing ?? new XrManager(app);
    (app as AppBase & { xr: XrManager | null }).xr = this.manager;
  }

  get active(): boolean {
    return this.manager.active;
  }

  /** True when the browser reports this mode is available right now. */
  available(mode: XrMode): boolean {
    return this.manager.isAvailable(mode === "ar" ? XRTYPE_AR : XRTYPE_VR);
  }

  /**
   * PlayCanvas refuses to start a session until its own availability check has
   * come back ("XR is not available"), and that check is asynchronous. The
   * runtime is therefore built as soon as XR is offered (see prepareXr), and a
   * session that still arrives too early waits briefly for the answer rather
   * than failing on the visitor's first tap.
   */
  private async waitUntilAvailable(type: string, timeoutMs = 1200): Promise<boolean> {
    if (this.manager.isAvailable(type)) return true;
    return new Promise<boolean>((resolve) => {
      const done = (value: boolean) => {
        clearTimeout(timer);
        this.manager.off(`available:${type}`, onAvailable);
        resolve(value);
      };
      const onAvailable = (available: boolean) => {
        if (available) done(true);
      };
      const timer = setTimeout(() => done(this.manager.isAvailable(type)), timeoutMs);
      this.manager.on(`available:${type}`, onAvailable);
    });
  }

  start(options: XrStartOptions): void {
    void this.startSession(options);
  }

  private async startSession(options: XrStartOptions): Promise<void> {
    if (this.destroyed) return;
    const content = this.contentRoot();
    const cameraComponent = this.camera.camera;
    if (!content || !cameraComponent) {
      options.onEvent({ type: "failed", kind: "failed" });
      return;
    }
    if (this.manager.active || this.options) {
      // One session at a time; the state machine also refuses this.
      return;
    }
    this.options = options;
    const ar = options.mode === "ar";
    const type = ar ? XRTYPE_AR : XRTYPE_VR;

    if (!(await this.waitUntilAvailable(type))) {
      this.options = null;
      options.onEvent({ type: "failed", kind: "unsupported" });
      return;
    }
    if (this.destroyed) {
      this.options = null;
      return;
    }

    if (ar && options.domOverlayRoot instanceof Element && this.manager.domOverlay.supported) {
      this.manager.domOverlay.root = options.domOverlayRoot;
    }

    const onStart = () => {
      this.onSessionStart(content, ar);
      options.onEvent({ type: "started" });
      this.requestFrame();
    };
    const onEnd = () => this.finish();
    const onError = (error: unknown) => this.fail(error);
    this.manager.on("start", onStart);
    this.manager.on("end", onEnd);
    this.manager.on("error", onError);
    this.cleanups.push(() => {
      this.manager.off("start", onStart);
      this.manager.off("end", onEnd);
      this.manager.off("error", onError);
    });

    this.manager.start(cameraComponent, type, XRSPACE_LOCALFLOOR, {
      // Only optional: a device without them still gets a session, with reduced features.
      optionalFeatures: ar ? ["hit-test", "local-floor"] : ["local-floor", "bounded-floor"],
      callback: (error: Error | null) => {
        if (error) this.fail(error);
      },
    });
  }

  private onSessionStart(content: Entity, ar: boolean): void {
    this.contentPose = capturePose(content);
    this.cameraPose = capturePose(this.camera);
    const cameraComponent = this.camera.camera;

    // The model hangs off a placement entity, so turning and resizing never touch the content itself.
    const placement = new Entity("xr-placement");
    this.app.root.addChild(placement);
    placement.addChild(content);
    content.setLocalPosition(0, 0, 0);
    content.setLocalEulerAngles(0, 0, 0);
    this.placement = placement;

    if (ar) {
      // Transparent clear so the camera feed shows through the scene.
      if (cameraComponent) {
        this.cameraClear = cameraComponent.clearColor.clone();
        cameraComponent.clearColor = new Color(0, 0, 0, 0);
      }
      placement.enabled = false;
      this.startHitTest();
    } else {
      this.startVr(placement);
    }
    this.applyBaseScale();
  }

  /** Applies the project's deterministic scale (metres per unit × preview factor). */
  private applyBaseScale(rotationDeg = 0, userScale = 1): void {
    const placement = this.placement;
    const options = this.options;
    if (!placement || !options) return;
    const base = options.scale.metersPerUnit * options.scale.previewScale;
    placement.setLocalScale(base * userScale, base * userScale, base * userScale);
    placement.setLocalEulerAngles(0, rotationDeg, 0);
  }

  // ── AR ────────────────────────────────────────────────────────────────────

  private startHitTest(): void {
    if (!this.manager.hitTest.supported) {
      // Without hit test there is no surface detection: place in front of the visitor instead.
      this.placeInFront();
      this.options?.onEvent({ type: "surface", found: true });
      return;
    }
    this.reticle = this.createReticle();
    this.manager.hitTest.start({
      spaceType: XRSPACE_VIEWER,
      entityTypes: [XRTRACKABLE_PLANE, XRTRACKABLE_POINT],
      callback: (error: Error | null, source: XrHitTestSource | null) => {
        if (error || !source) {
          this.placeInFront();
          this.options?.onEvent({ type: "surface", found: true });
          return;
        }
        this.hitTestSource = source;
        source.on("result", (position: Vec3, rotation: unknown) => {
          void rotation;
          this.onHit(position);
        });
      },
    });

    const onUpdate = () => {
      if (this.placed || !this.surfaceFound) return;
      if (Date.now() - this.lastHitAt > SURFACE_TIMEOUT_MS) {
        this.surfaceFound = false;
        if (this.reticle) this.reticle.enabled = false;
        this.options?.onEvent({ type: "surface", found: false });
      }
    };
    this.app.on("update", onUpdate);
    this.cleanups.push(() => this.app.off("update", onUpdate));
  }

  private createReticle(): Entity {
    // One entity for the whole session: never created per frame.
    const reticle = new Entity("xr-reticle");
    reticle.addComponent("render", { type: "cylinder", castShadows: false });
    reticle.setLocalScale(RETICLE_RADIUS * 2, 0.004, RETICLE_RADIUS * 2);
    const material = flatMaterial(new Color(1, 0.72, 0.25), 0.85);
    if (reticle.render) reticle.render.material = material;
    reticle.enabled = false;
    this.app.root.addChild(reticle);
    this.cleanups.push(() => material.destroy());
    return reticle;
  }

  private onHit(position: Vec3): void {
    if (this.placed) return;
    this.lastHitAt = Date.now();
    if (this.reticle) {
      this.reticle.setPosition(position);
      this.reticle.enabled = true;
    }
    if (!this.surfaceFound) {
      this.surfaceFound = true;
      this.options?.onEvent({ type: "surface", found: true });
    }
    this.requestFrame();
  }

  /** Fallback when the device has no hit test: a fixed spot in front of the visitor. */
  private placeInFront(): void {
    const forward = this.camera.forward.clone().mulScalar(VR_MODEL_DISTANCE);
    const target = this.camera.getPosition().clone().add(forward);
    target.y = 0;
    this.placement?.setPosition(target);
    this.surfaceFound = true;
  }

  /** Puts the model where the reticle is (or where it already stands). */
  place(): void {
    if (!this.placement || this.placed) return;
    if (this.reticle?.enabled) this.placement.setPosition(this.reticle.getPosition());
    this.placement.enabled = true;
    this.placed = true;
    if (this.reticle) this.reticle.enabled = false;
    this.requestFrame();
  }

  resetPlacement(): void {
    if (!this.placement) return;
    this.placed = false;
    this.placement.enabled = false;
    this.surfaceFound = false;
    this.lastHitAt = 0;
    this.applyBaseScale();
    this.options?.onEvent({ type: "surface", found: false });
    this.requestFrame();
  }

  /** Turn and resize, in the limits the state machine has already applied. */
  setTransform(rotationDeg: number, scale: number): void {
    this.applyBaseScale(rotationDeg, scale);
    this.requestFrame();
  }

  // ── VR ────────────────────────────────────────────────────────────────────

  private startVr(placement: Entity): void {
    // The camera hangs off a rig: XR drives the camera's own transform from the
    // headset pose, so the visitor is moved by moving the rig instead.
    const rig = new Entity("xr-rig");
    this.app.root.addChild(rig);
    const cameraParent = this.camera.parent;
    rig.addChild(this.camera);
    this.camera.setLocalPosition(0, 0, 0);
    this.camera.setLocalEulerAngles(0, 0, 0);
    this.rig = rig;
    this.cleanups.push(() => {
      (cameraParent ?? this.app.root).addChild(this.camera);
    });

    placement.setPosition(0, 0, -VR_MODEL_DISTANCE);
    placement.enabled = true;
    this.placed = true;

    const stopMaterial = flatMaterial(new Color(1, 0.72, 0.25), 0.7);
    this.cleanups.push(() => stopMaterial.destroy());
    for (const angle of VR_STOP_ANGLES) {
      const stop = new Entity(`xr-stop-${angle}`);
      stop.addComponent("render", { type: "cylinder", castShadows: false });
      stop.setLocalScale(0.6, 0.01, 0.6);
      stop.setPosition(Math.sin(angle * DEG) * VR_STOP_RADIUS, 0.005, -VR_MODEL_DISTANCE + Math.cos(angle * DEG) * VR_STOP_RADIUS);
      if (stop.render) stop.render.material = stopMaterial;
      this.app.root.addChild(stop);
      this.stops.push(stop);
    }

    const onAdd = (inputSource: XrInputSource) => this.addPointer(inputSource);
    const onRemove = (inputSource: XrInputSource) => this.removePointer(inputSource);
    this.manager.input.on("add", onAdd);
    this.manager.input.on("remove", onRemove);
    for (const inputSource of this.manager.input.inputSources) this.addPointer(inputSource);
    this.cleanups.push(() => {
      this.manager.input.off("add", onAdd);
      this.manager.input.off("remove", onRemove);
      for (const inputSource of [...this.pointers.keys()]) this.removePointer(inputSource);
    });

    const onUpdate = () => this.updatePointers();
    this.app.on("update", onUpdate);
    this.cleanups.push(() => this.app.off("update", onUpdate));
  }

  private addPointer(inputSource: XrInputSource): void {
    if (this.pointers.has(inputSource)) return;
    const pointer = new Entity("xr-pointer");
    pointer.addComponent("render", { type: "box", castShadows: false });
    pointer.setLocalScale(0.012, 0.012, 1);
    const material = flatMaterial(new Color(1, 1, 1), 0.6);
    if (pointer.render) pointer.render.material = material;
    this.app.root.addChild(pointer);
    this.pointers.set(inputSource, pointer);

    const onSelect = () => this.teleport(inputSource);
    // Squeeze (grip) leaves the walkthrough without reaching for the headset menu.
    const onSqueeze = () => this.end();
    inputSource.on("select", onSelect);
    inputSource.on("squeeze", onSqueeze);
    this.cleanups.push(() => {
      inputSource.off("select", onSelect);
      inputSource.off("squeeze", onSqueeze);
      material.destroy();
    });
  }

  private removePointer(inputSource: XrInputSource): void {
    const pointer = this.pointers.get(inputSource);
    if (!pointer) return;
    pointer.destroy();
    this.pointers.delete(inputSource);
  }

  private updatePointers(): void {
    for (const [inputSource, pointer] of this.pointers) {
      const origin = inputSource.getOrigin();
      const direction = inputSource.getDirection();
      pointer.setPosition(origin.x + direction.x * 0.5, origin.y + direction.y * 0.5, origin.z + direction.z * 0.5);
      pointer.lookAt(origin.x + direction.x, origin.y + direction.y, origin.z + direction.z);
    }
  }

  /** Bounded point-to-point movement: jump to the stop the controller points at. */
  private teleport(inputSource: XrInputSource): void {
    if (!this.rig || this.stops.length === 0) return;
    const origin = inputSource.getOrigin();
    const direction = inputSource.getDirection();
    let best: { stop: Entity; distance: number } | null = null;
    for (const stop of this.stops) {
      const toStop = stop.getPosition().clone().sub(origin);
      const along = toStop.dot(direction);
      if (along <= 0) continue;
      const offset = toStop.sub(direction.clone().mulScalar(along)).length();
      if (offset < 0.6 && (!best || along < best.distance)) best = { stop, distance: along };
    }
    if (!best) return;
    const target = best.stop.getPosition();
    // Move the rig so the visitor's head ends up over the stop; height stays with the floor space.
    const head = this.camera.getLocalPosition();
    this.rig.setPosition(target.x - head.x, 0, target.z - head.z);
    this.requestFrame();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Asks the session to end; "ended" follows from the session itself. */
  end(): void {
    if (this.manager.active) this.manager.end();
    else this.finish();
  }

  private fail(error: unknown): void {
    const kind = classifyXrError(error);
    const options = this.options;
    this.teardown();
    options?.onEvent({ type: "failed", kind });
  }

  private finish(): void {
    const options = this.options;
    this.teardown();
    options?.onEvent({ type: "ended" });
  }

  /** Releases everything the session created and restores the standard viewer. */
  private teardown(): void {
    for (const cleanup of this.cleanups.splice(0)) {
      try {
        cleanup();
      } catch {
        // A cleanup must never stop the rest from running.
      }
    }
    this.hitTestSource?.remove();
    this.hitTestSource = null;
    const content = this.contentRoot();
    if (content && this.contentPose) {
      this.app.root.addChild(content);
      restorePose(content, this.contentPose);
    }
    this.contentPose = null;
    for (const stop of this.stops.splice(0)) stop.destroy();
    for (const pointer of this.pointers.values()) pointer.destroy();
    this.pointers.clear();
    this.reticle?.destroy();
    this.reticle = null;
    this.placement?.destroy();
    this.placement = null;
    this.rig?.destroy();
    this.rig = null;
    if (this.camera.camera && this.cameraClear) this.camera.camera.clearColor = this.cameraClear;
    this.cameraClear = null;
    if (this.cameraPose) restorePose(this.camera, this.cameraPose);
    this.cameraPose = null;
    if (this.manager.domOverlay.root) this.manager.domOverlay.root = null;
    this.placed = false;
    this.surfaceFound = false;
    this.options = null;
    this.requestFrame();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.manager.active) this.manager.end();
    this.teardown();
  }
}

