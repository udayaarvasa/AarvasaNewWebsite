import { Vec3, type Entity } from "playcanvas";
import type { ViewerControls } from "./scene-content";

const DEG = Math.PI / 180;
const MIN_PITCH = 5 * DEG;
const MAX_PITCH = 80 * DEG;
const KEY_ROTATE = 8 * DEG;
const KEY_ZOOM = 1.15;
const AUTO_ROTATE_SPEED = 10 * DEG; // radians per second
const DAMPING = 14; // higher settles faster
const SETTLED = 1e-4;

type Pose = { yaw: number; pitch: number; distance: number };


const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Minimal orbit camera driven by pointer events (mouse, pen, touch and pinch),
 * the wheel, and the keyboard. It only reports changes; the engine decides when
 * to render, so an idle viewer costs nothing.
 */
export class OrbitControls implements ViewerControls {
  private readonly target = new Vec3();
  private readonly current: Pose = { yaw: 35 * DEG, pitch: 25 * DEG, distance: 6 };
  private readonly goal: Pose = { ...this.current };
  private home: Pose = { ...this.current };
  private minDistance = 0.5;
  private maxDistance = 50;

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private autoRotate = false;
  private reducedMotion = false;

  constructor(
    private readonly camera: Entity,
    private readonly element: HTMLElement,
    private readonly onChange: () => void,
  ) {
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    // Non-passive so the page does not scroll while zooming the model.
    element.addEventListener("wheel", this.onWheel, { passive: false });
    element.addEventListener("keydown", this.onKeyDown);
    this.apply();
  }

  /** True while the camera still has somewhere to go, so frames are needed. */
  get isMoving(): boolean {
    if (this.autoRotateActive) return true;
    return (
      Math.abs(this.goal.yaw - this.current.yaw) > SETTLED ||
      Math.abs(this.goal.pitch - this.current.pitch) > SETTLED ||
      Math.abs(this.goal.distance - this.current.distance) > SETTLED
    );
  }

  private get autoRotateActive(): boolean {
    return this.autoRotate && !this.reducedMotion && this.pointers.size === 0;
  }

  setMotion(autoRotate: boolean, reducedMotion: boolean): void {
    this.autoRotate = autoRotate;
    this.reducedMotion = reducedMotion;
    this.onChange();
  }

  /** Centres the orbit on content and makes that framing the reset pose. */
  frame(center: Vec3, radius: number): void {
    this.target.copy(center);
    this.minDistance = radius * 0.6;
    this.maxDistance = radius * 8;
    this.home = { yaw: 35 * DEG, pitch: 25 * DEG, distance: radius * 2.8 };
    Object.assign(this.goal, this.home);
    Object.assign(this.current, this.home);
    this.apply();
    this.onChange();
  }

  reset(): void {
    // Keep yaw continuous so damping takes the short way round.
    const turns = Math.round((this.current.yaw - this.home.yaw) / (2 * Math.PI));
    Object.assign(this.goal, this.home, { yaw: this.home.yaw + turns * 2 * Math.PI });
    this.onChange();
  }

  update(dt: number): void {
    if (this.autoRotateActive) this.goal.yaw += AUTO_ROTATE_SPEED * dt;

    // Reduced motion: jump straight to the goal instead of easing.
    const t = this.reducedMotion ? 1 : 1 - Math.exp(-DAMPING * dt);
    this.current.yaw += (this.goal.yaw - this.current.yaw) * t;
    this.current.pitch += (this.goal.pitch - this.current.pitch) * t;
    this.current.distance += (this.goal.distance - this.current.distance) * t;
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
    const { yaw, pitch, distance } = this.current;
    const flat = Math.cos(pitch) * distance;
    this.camera.setPosition(
      this.target.x + flat * Math.sin(yaw),
      this.target.y + Math.sin(pitch) * distance,
      this.target.z + flat * Math.cos(yaw),
    );
    this.camera.lookAt(this.target);
  }

  private rotate(dYaw: number, dPitch: number): void {
    this.goal.yaw += dYaw;
    this.goal.pitch = clamp(this.goal.pitch + dPitch, MIN_PITCH, MAX_PITCH);
    this.onChange();
  }

  zoomBy(factor: number): void {
    this.zoom(factor);
  }

  private zoom(factor: number): void {
    this.goal.distance = clamp(this.goal.distance * factor, this.minDistance, this.maxDistance);
    this.onChange();
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    this.element.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.pinchDistance = 0;
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 1) {
      // A drag across the full canvas height turns the view half a revolution.
      const scale = Math.PI / Math.max(this.element.clientHeight, 1);
      this.rotate(-(e.clientX - previous.x) * scale, (e.clientY - previous.y) * scale);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const spread = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDistance > 0 && spread > 0) this.zoom(this.pinchDistance / spread);
      this.pinchDistance = spread;
    }
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.pinchDistance = 0;
    // Resumes auto-rotate, if enabled, once the last finger lifts.
    this.onChange();
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const pixels = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 16 : e.deltaY;
    this.zoom(Math.exp(pixels * 0.0015));
  };

  private readonly onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowLeft":
        this.rotate(KEY_ROTATE, 0);
        break;
      case "ArrowRight":
        this.rotate(-KEY_ROTATE, 0);
        break;
      case "ArrowUp":
        this.rotate(0, KEY_ROTATE);
        break;
      case "ArrowDown":
        this.rotate(0, -KEY_ROTATE);
        break;
      case "+":
      case "=":
        this.zoom(1 / KEY_ZOOM);
        break;
      case "-":
      case "_":
        this.zoom(KEY_ZOOM);
        break;
      default:
        return;
    }
    e.preventDefault();
  };
}
