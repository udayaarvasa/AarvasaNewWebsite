import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Vec3 } from "playcanvas";
import { OrbitControls } from "../src/lib/viewer/playcanvas/orbit-controls.ts";

/** A camera that records where it was put, and an element that accepts listeners. */
function rig() {
  const pos = { x: 0, y: 0, z: 0 };
  const camera = {
    setPosition(x: number, y: number, z: number) { Object.assign(pos, { x, y, z }); },
    lookAt() {},
  };
  const element = { addEventListener() {}, removeEventListener() {}, setPointerCapture() {} };
  const controls = new OrbitControls(camera as never, element as never, () => {});
  controls.frame(new Vec3(0, 0, 0), 1, { yawDeg: 26, pitchDeg: 16, distanceFactor: 2 });
  /** Yaw (deg, 0 = camera on +Z) and pitch of the camera around the origin. */
  const pose = () => {
    const flat = Math.hypot(pos.x, pos.z);
    return {
      yaw: (Math.atan2(pos.x, pos.z) * 180) / Math.PI,
      pitch: (Math.atan2(pos.y, flat) * 180) / Math.PI,
      distance: Math.hypot(flat, pos.y),
    };
  };
  const settle = () => { for (let i = 0; i < 400; i++) controls.update(1 / 60); };
  return { controls, pose, settle };
}

const near = (a: number, b: number, eps = 0.5) => Math.abs(a - b) < eps;

describe("orbit controls: named views and the 360° orbit", () => {
  it("opens on the asset's framing", () => {
    const { pose } = rig();
    const p = pose();
    assert.ok(near(p.yaw, 26) && near(p.pitch, 16) && near(p.distance, 2, 0.01), JSON.stringify(p));
  });

  it("turns to Front, Side, Rear and Above and returns to the opening distance", () => {
    const { controls, pose, settle } = rig();
    controls.zoomBy(0.5);
    settle();
    for (const [yaw, pitch] of [[0, 10], [90, 10], [180, 10], [35, 60]] as const) {
      controls.setView(yaw, pitch);
      settle();
      const p = pose();
      const dy = ((p.yaw - yaw) % 360 + 540) % 360 - 180;
      assert.ok(near(dy, 0) && near(p.pitch, pitch) && near(p.distance, 2, 0.01), `${yaw}/${pitch}: ${JSON.stringify(p)}`);
    }
  });

  it("clamps a view's pitch to the orbit limits", () => {
    const { controls, pose, settle } = rig();
    controls.setView(0, 89);
    settle();
    assert.ok(pose().pitch <= 80.5, String(pose().pitch));
  });

  it("orbits continuously when the 360° orbit is on, and not under reduced motion", () => {
    const a = rig();
    a.controls.setMotion(true, false);
    const before = a.pose().yaw;
    for (let i = 0; i < 60; i++) a.controls.update(1 / 60);
    assert.ok(!near(a.pose().yaw, before, 2), "turns with motion allowed");
    assert.equal(a.controls.isMoving, true);

    const b = rig();
    b.controls.setMotion(true, true);
    const still = b.pose().yaw;
    for (let i = 0; i < 60; i++) b.controls.update(1 / 60);
    assert.ok(near(b.pose().yaw, still, 0.01), "reduced motion: no auto-rotation");
  });

  it("under reduced motion, a named view is reached in one step rather than eased", () => {
    const { controls, pose } = rig();
    controls.setMotion(false, true);
    controls.setView(180, 10);
    controls.update(1 / 60);
    const p = pose();
    assert.ok(near(Math.abs(p.yaw), 180) && near(p.pitch, 10), JSON.stringify(p));
  });

  it("resets to the opening pose after a view change", () => {
    const { controls, pose, settle } = rig();
    controls.setView(180, 40);
    settle();
    controls.reset();
    settle();
    const p = pose();
    assert.ok(near(p.yaw, 26) && near(p.pitch, 16), JSON.stringify(p));
  });
});
