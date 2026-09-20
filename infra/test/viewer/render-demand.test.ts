import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RenderDemand } from "../../../src/lib/viewer/render-demand";

const FRAME = 16;
const SPLAT_SETTLE_MS = 500; // src/lib/viewer/playcanvas/splat.ts

/**
 * Runs the loop the way the engine does: one frame per 16 ms while the policy
 * says so. `onFrame` may request more frames (the splat renderer's
 * frame:request / frame:ready). Returns the times of rendered frames and when
 * the loop stopped.
 */
function runLoop(demand: RenderDemand, start: number, opts: { active?: () => boolean; moving?: (t: number) => boolean; onFrame?: (t: number) => void; limitMs?: number } = {}) {
  const frames: number[] = [];
  let t = start;
  const limit = start + (opts.limitMs ?? 60_000);
  for (;;) {
    frames.push(t);
    demand.frameStarted();
    // Requests made while rendering (the splat renderer's events) happen after the frame started.
    opts.onFrame?.(t);
    const keepGoing = demand.frameEnded({ active: opts.active?.() ?? true, moving: opts.moving?.(t) ?? false }, t);
    if (!keepGoing) return { frames, stoppedAt: t };
    t += FRAME;
    if (t > limit) return { frames, stoppedAt: Number.POSITIVE_INFINITY };
  }
}

describe("render on demand: splat late-sort regression", () => {
  it("draws a splat whose sort finished while off-screen once the viewer becomes visible, without interaction", () => {
    const demand = new RenderDemand();
    // Loaded and shown while off-screen: the engine is inactive, so its one frame ends the loop.
    demand.contentShown(SPLAT_SETTLE_MS, 0);
    assert.equal(demand.frameEnded({ active: false, moving: false }, 0), false);
    // The worker's sort completes at t = 2000 while off-screen: nothing can render yet.
    const sortedAt = 2000;
    // Scrolled into view (or the page un-hidden) at t = 3000, with no camera interaction.
    demand.activated(3000);
    const { frames, stoppedAt } = runLoop(demand, 3000);
    assert.ok(frames.some((f) => f > sortedAt), "a frame after the sort completed is drawn");
    assert.ok(frames.length >= SPLAT_SETTLE_MS / FRAME, `settle window keeps drawing (${frames.length} frames)`);
    assert.ok(stoppedAt >= 3000 + SPLAT_SETTLE_MS && stoppedAt < 3000 + SPLAT_SETTLE_MS + FRAME * 2, `stops after the settle window (${stoppedAt})`);
  });

  it("keeps drawing while the splat renderer reports it is not ready, then stops", () => {
    const demand = new RenderDemand();
    demand.contentShown(SPLAT_SETTLE_MS, 0);
    // A slow device: the sorted state catches up only at t = 1500 (frame:ready false until then).
    const readyAt = 1500;
    const { frames, stoppedAt } = runLoop(demand, 0, { onFrame: (t) => (t < readyAt ? demand.request() : undefined) });
    assert.ok(frames.at(-1)! >= readyAt, "draws the frame in which the sorted state is ready");
    assert.ok(stoppedAt < readyAt + FRAME * 2, `stops right after ready once the settle window has passed (${stoppedAt})`);
  });

  it("a request made during a frame produces the next frame (not used up by the current one)", () => {
    const demand = new RenderDemand();
    demand.contentShown(0, 0);
    let asks = 3;
    const { frames } = runLoop(demand, 0, { onFrame: () => (asks-- > 0 ? demand.request() : undefined) });
    assert.equal(frames.length, 4, "three in-frame requests → three further frames");
  });

  it("never runs forever: with nothing changing, the loop stops within the settle window", () => {
    const demand = new RenderDemand();
    demand.contentShown(SPLAT_SETTLE_MS, 0);
    const { stoppedAt, frames } = runLoop(demand, 0, { limitMs: 10_000 });
    assert.ok(Number.isFinite(stoppedAt), "loop stopped");
    assert.ok(frames.length <= SPLAT_SETTLE_MS / FRAME + 2, `bounded frame count (${frames.length})`);
  });

  it("reopens the window after camera motion, then stops", () => {
    const demand = new RenderDemand();
    demand.contentShown(SPLAT_SETTLE_MS, 0);
    const motionEnds = 2000;
    const { stoppedAt } = runLoop(demand, 0, { moving: (t) => t < motionEnds });
    assert.ok(stoppedAt >= motionEnds + SPLAT_SETTLE_MS - FRAME && stoppedAt < motionEnds + SPLAT_SETTLE_MS + FRAME * 2, `stopped at ${stoppedAt}`);
  });

  it("does not render while inactive, whatever is requested", () => {
    const demand = new RenderDemand();
    demand.contentShown(SPLAT_SETTLE_MS, 0);
    demand.request();
    assert.equal(demand.frameEnded({ active: false, moving: true }, 10), false);
  });

  it("models and panoramas (no settle window) still draw exactly one frame on demand", () => {
    const demand = new RenderDemand();
    demand.contentShown(0, 0);
    assert.equal(runLoop(demand, 0).frames.length, 1);
    demand.activated(5000);
    assert.equal(runLoop(demand, 5000).frames.length, 1);
  });

  it("switching from a splat to other content drops the splat's settle window", () => {
    const demand = new RenderDemand();
    demand.contentShown(SPLAT_SETTLE_MS, 0);
    demand.contentShown(0, 16);
    assert.equal(runLoop(demand, 16).frames.length, 1);
  });
});
