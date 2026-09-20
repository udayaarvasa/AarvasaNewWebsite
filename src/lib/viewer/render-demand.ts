/**
 * When the viewer's render loop may stop. Pure (the clock is passed in), so the
 * render-on-demand policy is unit-tested without WebGL; the engine
 * (playcanvas/create-engine.ts) owns the actual loop and asks this after every frame.
 *
 * The loop keeps running while any of these hold, and only while the viewer is
 * active (on screen, page visible):
 * - a frame was requested (`request`) since the current frame started, e.g. by
 *   input, a resize, or the splat renderer (`frame:request`, or `frame:ready`
 *   that is not yet ready). The renderer asks *during* a frame, so a request
 *   made after `frameStarted` is for the next frame, never used up by this one;
 * - the camera is still moving;
 * - the content's settle window is open. Content that finishes asynchronously
 *   (Gaussian splat sorting in a worker) declares `settleMs`; the window
 *   reopens when the content is shown, when the camera stops, and when the
 *   viewer becomes active again, so a sort that completes while the viewer is
 *   off-screen or hidden is still drawn when it comes back.
 */
export class RenderDemand {
  /** A frame was requested that the current (or next) frame has not yet served. */
  private requested = false;
  private settleMs = 0;
  private settleUntil = 0;

  /** At least one more frame. */
  request(): void {
    this.requested = true;
  }

  /** A frame is starting (before update and render): it serves every request made so far. */
  frameStarted(): void {
    this.requested = false;
  }

  /** New content is on screen; `settleMs` is its settle window (0 for none). */
  contentShown(settleMs: number, now: number): void {
    this.settleMs = Math.max(0, settleMs);
    this.settleUntil = 0;
    this.settle(now);
    this.request();
  }

  /** The viewer became active (on screen and visible) again. */
  activated(now: number): void {
    this.settle(now);
    this.request();
  }

  /** Called after each rendered frame. Returns whether the loop should keep running. */
  frameEnded(state: { active: boolean; moving: boolean }, now: number): boolean {
    if (state.moving) this.settle(now);
    if (!state.active) return false;
    return this.requested || state.moving || now < this.settleUntil;
  }

  private settle(now: number): void {
    if (this.settleMs > 0) this.settleUntil = Math.max(this.settleUntil, now + this.settleMs);
  }
}
