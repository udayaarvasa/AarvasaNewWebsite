/**
 * WebXR capability detection, separate from media types.
 *
 * WebGL 2, WebXR, immersive-ar and immersive-vr are four different questions:
 * a browser can expose `navigator.xr` and support neither mode, or support VR
 * (a headset browser) and not AR, or the reverse (most Android phones). This
 * module answers each one, so the page only ever offers a mode the device
 * actually reports.
 *
 * Detection uses `navigator.xr.isSessionSupported`, which needs no PlayCanvas,
 * so probing never downloads the engine. It reports what the *browser* claims;
 * a session can still fail later (permission refused, no headset connected),
 * which is handled by the session state machine (xr-session.ts).
 */

export const XR_MODES = ["ar", "vr"] as const;
export type XrMode = (typeof XR_MODES)[number];

/** WebXR session type for each mode. */
export const XR_SESSION_TYPE: Readonly<Record<XrMode, "immersive-ar" | "immersive-vr">> = {
  ar: "immersive-ar",
  vr: "immersive-vr",
};

export type XrSupport = {
  /** The viewer's baseline: without it nothing 3D runs, XR included. */
  webgl2: boolean;
  /** navigator.xr exists (the API, not any particular mode). */
  webxr: boolean;
  ar: boolean;
  vr: boolean;
  /** Why XR is unavailable, for the message shown to the visitor. */
  reason: "ok" | "no-webgl2" | "no-webxr" | "no-modes" | "insecure-context" | "detection-failed";
};

export const XR_SUPPORT_UNKNOWN: XrSupport = { webgl2: false, webxr: false, ar: false, vr: false, reason: "detection-failed" };

type XrLike = { isSessionSupported?: (type: string) => Promise<boolean> };

/**
 * Turns raw probe results into a support record. Pure, so every combination is
 * unit-tested: no WebXR, AR only, VR only, both, and failure.
 */
export function summarizeXrSupport(input: {
  webgl2: boolean;
  hasNavigatorXr: boolean;
  secureContext: boolean;
  ar: boolean | "failed";
  vr: boolean | "failed";
}): XrSupport {
  const ar = input.ar === true;
  const vr = input.vr === true;
  const failed = input.ar === "failed" || input.vr === "failed";
  let reason: XrSupport["reason"] = "ok";
  if (!input.webgl2) reason = "no-webgl2";
  else if (!input.secureContext) reason = "insecure-context";
  else if (!input.hasNavigatorXr) reason = "no-webxr";
  else if (failed && !ar && !vr) reason = "detection-failed";
  else if (!ar && !vr) reason = "no-modes";
  return { webgl2: input.webgl2, webxr: input.hasNavigatorXr, ar: input.webgl2 && ar, vr: input.webgl2 && vr, reason };
}

/**
 * Asks the browser which immersive modes it supports. Never throws: a refusal
 * or an exception is reported as "not supported", never as a crash.
 * WebXR also requires a secure context, so http:// pages report no support.
 */
export async function detectXrSupport(options: { webgl2: boolean }): Promise<XrSupport> {
  // Read through globalThis so this module compiles without DOM typings (it is unit-tested in Node).
  const host = globalThis as { navigator?: { xr?: XrLike }; isSecureContext?: boolean; document?: unknown };
  if (!host.navigator || !host.document) return XR_SUPPORT_UNKNOWN;
  const xr = host.navigator.xr;
  const secureContext = host.isSecureContext !== false;
  const isSessionSupported = xr?.isSessionSupported;
  if (!options.webgl2 || !secureContext || !xr || typeof isSessionSupported !== "function") {
    return summarizeXrSupport({ webgl2: options.webgl2, hasNavigatorXr: Boolean(xr), secureContext, ar: false, vr: false });
  }
  const probe = async (mode: XrMode): Promise<boolean | "failed"> => {
    try {
      return (await isSessionSupported.call(xr, XR_SESSION_TYPE[mode])) === true;
    } catch {
      // Chrome throws a SecurityError when the xr-spatial-tracking permission policy forbids XR.
      return "failed";
    }
  };
  const [ar, vr] = await Promise.all([probe("ar"), probe("vr")]);
  return summarizeXrSupport({ webgl2: options.webgl2, hasNavigatorXr: true, secureContext, ar, vr });
}

/** What the visitor is told when a mode cannot run here. One sentence, no WebXR jargon. */
export function xrUnavailableMessage(mode: XrMode, support: XrSupport): string {
  const name = mode === "ar" ? "AR" : "VR";
  switch (support.reason) {
    case "no-webgl2":
      return `${name} needs 3D graphics support this browser does not have.`;
    case "insecure-context":
      return `${name} is only available on secure (https) pages.`;
    case "no-webxr":
    case "no-modes":
    case "detection-failed":
      return mode === "ar"
        ? "AR isn't available on this device. You can still explore the interactive 3D model."
        : "VR isn't available on this device. You can still explore the interactive 3D model.";
    case "ok":
      return support[mode] ? "" : `${name} isn't available on this device.`;
  }
}
