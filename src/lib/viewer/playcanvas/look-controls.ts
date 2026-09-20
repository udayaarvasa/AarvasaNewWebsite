import { Vec3, type Entity } from "playcanvas";
import { directionVector } from "../panorama-math";
import { PANORAMA_LIMITS, normalizeView } from "../source";
import type { PanoramaView } from "../types";
import type { ViewerControls } from "./scene-content";

const KEY_TURN = 10; // degrees per arrow press
const KEY_ZOOM = 1.15;
const DAMPING = 14; // higher settles faster
const SETTLED = 1e-3; // degrees

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * `directionVector` as a PlayCanvas Vec3. The panorama mesh, the camera and the
 * hotspot projection all use it, so hotspot placement and the image always agree.
 */
export function directionFor(yawDeg: number, pitchDeg: number, out = new Vec3()): Vec3 {
  const [x, y, z] = directionVector(yawDeg, pitchDeg);
  return out.set(x, y, z);
}

/**
 * First-person look controls for a 360° panorama: drag (mouse, pen, touch) to
 * look around, wheel / pinch / plus-minus to zoom by changing the field of view,
 * arrow keys to turn. Like OrbitControls, it only reports changes; the engine
 * renders on demand, so a still panorama costs nothing.
 */
export class LookControls implements ViewerControls {
  private readonly current: PanoramaView;
  private readonly goal: PanoramaView;
  private readonly home: PanoramaView;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private reducedMotion = false;
  private readonly target = new Vec3();

  constructor(
    private readonly camera: Entity,
    private readonly element: HTMLElement,
    private readonly onChange: () => void,
    initialView: PanoramaView,
  ) {
    this.home = normalizeView(initialView);
    this.current = { ...this.home };
    this.goal = { ...this.home };
    camera.setPosition(0, 0, 0);
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("wheel", this.onWheel, { passive: false });
    element.addEventListener("keydown", this.onKeyDown);
    this.apply();
  }

  get isMoving(): boolean {
    return (
      Math.abs(this.goal.yawDeg - this.current.yawDeg) > SETTLED ||
      Math.abs(this.goal.pitchDeg - this.current.pitchDeg) > SETTLED ||
      Math.abs(this.goal.fovDeg - this.current.fovDeg) > SETTLED
    );
  }

  /** The view being shown right now. */
  get view(): PanoramaView {
    return { ...this.current };
  }

  // Panoramas never auto-rotate: a room tour should hold still unless the visitor moves.
  setMotion(_autoRotate: boolean, reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion;
    this.onChange();
  }

  reset(): void {
    // Keep yaw continuous so damping takes the short way round.
    const turns = Math.round((this.current.yawDeg - this.home.yawDeg) / 360);
    Object.assign(this.goal, this.home, { yawDeg: this.home.yawDeg + turns * 360 });
    this.onChange();
  }

  zoomBy(factor: number): void {
    this.goal.fovDeg = clamp(this.goal.fovDeg * factor, PANORAMA_LIMITS.minFovDeg, PANORAMA_LIMITS.maxFovDeg);
    this.onChange();
  }

  update(dt: number): void {
    const t = this.reducedMotion ? 1 : 1 - Math.exp(-DAMPING * dt);
    this.current.yawDeg += (this.goal.yawDeg - this.current.yawDeg) * t;
    this.current.pitchDeg += (this.goal.pitchDeg - this.current.pitchDeg) * t;
    this.current.fovDeg += (this.goal.fovDeg - this.current.fovDeg) * t;
    if (!this.isMoving) Object.assign(this.current, this.goal);
    this.apply();
  }

  destroy(): void {
    const el = this.element;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("wheel", this.onWheel);
    el.removeEventListener("keydown", this.onKeyDown);
    this.pointers.clear();
  }

  private apply(): void {
    this.camera.lookAt(directionFor(this.current.yawDeg, this.current.pitchDeg, this.target));
    if (this.camera.camera) this.camera.camera.fov = this.current.fovDeg;
  }

  private turn(dYaw: number, dPitch: number): void {
    this.goal.yawDeg += dYaw;
    this.goal.pitchDeg = clamp(this.goal.pitchDeg + dPitch, PANORAMA_LIMITS.minPitchDeg, PANORAMA_LIMITS.maxPitchDeg);
    this.onChange();
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.element.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.pinchDistance = 0;
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      // "Grab the image": dragging right pulls the scene right, so the view turns left.
      // One canvas height of drag moves the view by the current vertical field of view.
      const degPerPixel = this.current.fovDeg / Math.max(this.element.clientHeight, 1);
      this.turn(-(e.clientX - previous.x) * degPerPixel, (e.clientY - previous.y) * degPerPixel);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDistance > 0 && spread > 0) this.zoomBy(this.pinchDistance / spread);
      this.pinchDistance = spread;
    }
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.pinchDistance = 0;
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const pixels = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    this.zoomBy(Math.exp(pixels * 0.0015));
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        this.turn(-KEY_TURN, 0);
        break;
      case "ArrowRight":
        this.turn(KEY_TURN, 0);
        break;
      case "ArrowUp":
        this.turn(0, KEY_TURN);
        break;
      case "ArrowDown":
        this.turn(0, -KEY_TURN);
        break;
      case "+":
      case "=":
        this.zoomBy(1 / KEY_ZOOM);
        break;
      case "-":
      case "_":
        this.zoomBy(KEY_ZOOM);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
}
