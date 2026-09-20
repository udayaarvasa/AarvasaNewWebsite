import { XR_SCALE_LIMITS } from "./xr-contract";
import type { XrMode, XrSupport } from "./xr-capabilities";

/**
 * The XR session lifecycle, as a pure reducer. The engine module
 * (playcanvas/xr.ts) turns these states into PlayCanvas calls and feeds real
 * session events back in, so every rule below — one session at a time,
 * placement order, transform limits, what a failure leaves behind — is
 * deterministic and unit-tested without a headset.
 */

export type XrPhase =
  | "idle" // the standard 3D viewer is in charge
  | "requesting" // a session was asked for; the browser may be prompting
  | "active" // the session is running
  | "ending" // we asked the session to end
  | "error"; // the last attempt failed; the 3D viewer still works

/** AR only: where placement has got to. VR sessions stay "none". */
export type XrPlacement = "none" | "searching" | "ready" | "placed";

export type XrErrorKind = "unsupported" | "denied" | "failed" | "lost";

export type XrState = {
  phase: XrPhase;
  mode: XrMode | null;
  placement: XrPlacement;
  error: XrErrorKind | null;
  /** Model turn in degrees (AR and VR), and scale as a multiple of the placed size. */
  rotationDeg: number;
  scale: number;
};

export const XR_INITIAL_STATE: XrState = { phase: "idle", mode: null, placement: "none", error: null, rotationDeg: 0, scale: 1 };

export type XrEvent =
  | { type: "request"; mode: XrMode }
  | { type: "started" }
  | { type: "failed"; kind: XrErrorKind }
  | { type: "surface"; found: boolean }
  | { type: "place" }
  | { type: "reset-placement" }
  | { type: "rotate"; deltaDeg: number }
  | { type: "scale-by"; factor: number }
  | { type: "request-exit" }
  | { type: "ended" }
  | { type: "dismiss-error" };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const wrap = (deg: number) => ((deg % 360) + 360) % 360;

/** True when a new session may be requested: never while one is starting, running or ending. */
export function canRequestXr(state: XrState, mode: XrMode, support: Pick<XrSupport, "ar" | "vr">): boolean {
  return (state.phase === "idle" || state.phase === "error") && support[mode];
}

export function xrReduce(state: XrState, event: XrEvent): XrState {
  switch (event.type) {
    case "request":
      // One session at a time: a second request while starting/running/ending is ignored.
      if (state.phase !== "idle" && state.phase !== "error") return state;
      return { ...XR_INITIAL_STATE, phase: "requesting", mode: event.mode };
    case "started":
      if (state.phase !== "requesting") return state;
      return { ...state, phase: "active", error: null, placement: state.mode === "ar" ? "searching" : "none" };
    case "failed":
      // A failure at any point returns to the standard viewer with a reason.
      return { ...XR_INITIAL_STATE, phase: "error", error: event.kind };
    case "surface":
      if (state.phase !== "active" || state.mode !== "ar" || state.placement === "placed") return state;
      return { ...state, placement: event.found ? "ready" : "searching" };
    case "place":
      if (state.phase !== "active" || state.placement !== "ready") return state;
      return { ...state, placement: "placed" };
    case "reset-placement":
      if (state.phase !== "active" || state.mode !== "ar") return state;
      return { ...state, placement: "searching", rotationDeg: 0, scale: 1 };
    case "rotate":
      if (!canTransform(state)) return state;
      return { ...state, rotationDeg: wrap(state.rotationDeg + event.deltaDeg) };
    case "scale-by":
      if (!canTransform(state) || !(event.factor > 0) || !Number.isFinite(event.factor)) return state;
      return { ...state, scale: clamp(state.scale * event.factor, XR_SCALE_LIMITS.min, XR_SCALE_LIMITS.max) };
    case "request-exit":
      if (state.phase !== "active" && state.phase !== "requesting") return state;
      return { ...state, phase: "ending" };
    case "ended":
      // Always returns to the standard viewer, including an end we did not ask for.
      return { ...XR_INITIAL_STATE };
    case "dismiss-error":
      return state.phase === "error" ? { ...XR_INITIAL_STATE } : state;
  }
}

/** The model may be turned or resized once it is placed (AR) or as soon as VR is running. */
export function canTransform(state: XrState): boolean {
  return state.phase === "active" && (state.mode === "vr" || state.placement === "placed");
}

/** True while the session owns the display: the page's own render loop must stand down. */
export function xrOwnsDisplay(state: XrState): boolean {
  return state.phase === "active" || state.phase === "ending";
}

/** The instruction shown in the AR overlay, or "" when none applies. */
export function arInstruction(state: XrState): string {
  if (state.phase === "requesting") return "Starting AR…";
  if (state.phase !== "active" || state.mode !== "ar") return "";
  switch (state.placement) {
    case "searching":
      return "Move your device slowly to find a floor or table.";
    case "ready":
      return "Tap Place to put the model here.";
    case "placed":
      return "Drag to turn, or use the buttons to turn and resize.";
    default:
      return "";
  }
}

/** What a failed or refused session tells the visitor. */
export function xrErrorMessage(mode: XrMode | null, kind: XrErrorKind): string {
  const name = mode === "vr" ? "VR" : "AR";
  switch (kind) {
    case "unsupported":
      return `${name} isn't available on this device. You can still explore the interactive 3D model.`;
    case "denied":
      return `${name} needs permission to use your device's sensors${mode === "ar" ? " and camera" : ""}. Nothing was recorded. You can still explore the interactive 3D model.`;
    case "lost":
      return `The ${name} session ended unexpectedly. You're back in the interactive 3D model.`;
    case "failed":
      return `${name} couldn't start on this device. You can still explore the interactive 3D model.`;
  }
}

/**
 * Classifies a session failure. Covers the browser's own DOMExceptions and
 * PlayCanvas's refusals ("XR is not available" when the device check has not
 * come back, "XR session is already started" for a duplicate request).
 */
export function classifyXrError(error: unknown): XrErrorKind {
  const name = (error as { name?: string } | null)?.name ?? "";
  const message = String((error as { message?: string } | null)?.message ?? error ?? "");
  if (name === "NotAllowedError" || name === "SecurityError" || /permission|denied|not allowed|user activation/i.test(message)) return "denied";
  if (name === "NotSupportedError" || /not supported|unsupported|not available/i.test(message)) return "unsupported";
  return "failed";
}

/** Screen-reader announcement for a state change, or "" when nothing should be said. */
export function xrAnnouncement(previous: XrState, next: XrState): string {
  if (previous.phase !== "active" && next.phase === "active") {
    return next.mode === "ar" ? "AR preview started." : "VR walkthrough started.";
  }
  if (previous.phase === "active" && next.phase !== "active" && next.phase !== "ending") {
    return "Returned to the standard 3D viewer.";
  }
  if (previous.placement !== "placed" && next.placement === "placed") return "Model placed.";
  if (previous.phase !== "error" && next.phase === "error" && next.error) return xrErrorMessage(previous.mode, next.error);
  return "";
}
