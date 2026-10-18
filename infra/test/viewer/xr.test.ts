import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Project } from "../../../src/lib/project-types";
import { getProject } from "../../../src/lib/projects";
import { sanitizeViewerEvent, VIEWER_EVENTS } from "../../../src/lib/viewer/analytics";
import { immersiveModes } from "../../../src/lib/viewer/immersive-modes";
import { projectViewerConfig } from "../../../src/lib/viewer/project-media";
import { detectXrSupport, summarizeXrSupport, XR_SESSION_TYPE, xrUnavailableMessage, type XrSupport } from "../../../src/lib/viewer/xr-capabilities";
import { DEFAULT_XR_SCALE, normalizeXrScale, XR_SCALE_LIMITS, xrExperienceFor } from "../../../src/lib/viewer/xr-contract";
import {
  arInstruction,
  classifyXrError,
  canRequestXr,
  canTransform,
  xrAnnouncement,
  xrErrorMessage,
  xrOwnsDisplay,
  XR_INITIAL_STATE,
  xrReduce,
  type XrEvent,
  type XrState,
} from "../../../src/lib/viewer/xr-session";

const CDN = "https://cdn.media.test";
const ID = "cm1abcd2ef3gh4";
const MODEL_URL = `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/scene.glb`;
const model = { kind: "model" as const, url: MODEL_URL };
const run = (events: XrEvent[], from: XrState = XR_INITIAL_STATE) => events.reduce(xrReduce, from);
const active = (mode: "ar" | "vr") => run([{ type: "request", mode }, { type: "started" }]);
const placed = () => run([{ type: "surface", found: true }, { type: "place" }], active("ar"));

// ── Capability detection ─────────────────────────────────────────────────────

describe("XR capability detection", () => {
  const base = { webgl2: true, hasNavigatorXr: true, secureContext: true } as const;

  it("uses the WebXR session names", () => {
    assert.deepEqual(XR_SESSION_TYPE, { ar: "immersive-ar", vr: "immersive-vr" });
  });

  const cases: [string, Parameters<typeof summarizeXrSupport>[0], Partial<XrSupport>][] = [
    ["both modes", { ...base, ar: true, vr: true }, { ar: true, vr: true, reason: "ok" }],
    ["AR only (a phone)", { ...base, ar: true, vr: false }, { ar: true, vr: false, reason: "ok" }],
    ["VR only (a headset browser)", { ...base, ar: false, vr: true }, { ar: false, vr: true, reason: "ok" }],
    ["WebXR present but no modes", { ...base, ar: false, vr: false }, { webxr: true, ar: false, vr: false, reason: "no-modes" }],
    ["no WebXR at all", { ...base, hasNavigatorXr: false, ar: false, vr: false }, { webxr: false, ar: false, vr: false, reason: "no-webxr" }],
    ["no WebGL 2", { ...base, webgl2: false, ar: true, vr: true }, { webgl2: false, ar: false, vr: false, reason: "no-webgl2" }],
    ["insecure page", { ...base, secureContext: false, ar: true, vr: true }, { reason: "insecure-context" }],
    ["detection threw", { ...base, ar: "failed", vr: "failed" }, { ar: false, vr: false, reason: "detection-failed" }],
    ["AR threw, VR works", { ...base, ar: "failed", vr: true }, { ar: false, vr: true, reason: "ok" }],
  ];
  for (const [name, input, expected] of cases) {
    it(`reports ${name}`, () => {
      const support = summarizeXrSupport(input);
      for (const [key, value] of Object.entries(expected)) assert.equal(support[key as keyof XrSupport], value, key);
    });
  }

  it("never throws, and reports nothing supported, when there is no browser", async () => {
    assert.deepEqual(await detectXrSupport({ webgl2: true }), { webgl2: false, webxr: false, ar: false, vr: false, reason: "detection-failed" });
  });

  it("explains each unavailable case without WebXR jargon", () => {
    const messages = [
      xrUnavailableMessage("ar", summarizeXrSupport({ ...base, ar: false, vr: false })),
      xrUnavailableMessage("vr", summarizeXrSupport({ ...base, hasNavigatorXr: false, ar: false, vr: false })),
      xrUnavailableMessage("ar", summarizeXrSupport({ ...base, webgl2: false, ar: false, vr: false })),
      xrUnavailableMessage("vr", summarizeXrSupport({ ...base, secureContext: false, ar: false, vr: false })),
    ];
    for (const message of messages) {
      assert.ok(message.length > 0);
      assert.ok(!/webxr|immersive-(ar|vr)|session/i.test(message), message);
    }
  });
});

// ── Source / capability contract ─────────────────────────────────────────────

describe("XR source contract", () => {
  it("offers XR only for a published model the project opted in to", () => {
    const experience = xrExperienceFor({ source: model, modes: ["ar", "vr"], cdnOrigins: [CDN] });
    assert.deepEqual(experience?.modes, ["ar", "vr"]);
    assert.deepEqual(experience?.source, model);
    assert.deepEqual(experience?.scale, DEFAULT_XR_SCALE);
    assert.ok(!JSON.stringify(experience).match(/uploads\/|review\/|originals\/|sourceKey|X-Amz/));
  });

  it("never turns a media kind into an XR capability on its own", () => {
    assert.equal(xrExperienceFor({ source: model, modes: [], cdnOrigins: [CDN] }), null);
    assert.equal(xrExperienceFor({ source: { kind: "panorama", url: `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/p.jpg`, initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 } }, modes: ["vr"], cdnOrigins: [CDN] }), null);
    assert.equal(
      xrExperienceFor({ source: { kind: "splat", url: `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/s.sog`, initialView: { yawDeg: 0, pitchDeg: 0, distanceFactor: 2 }, upAxis: "y-up", sizeBytes: null, gaussians: null }, modes: ["ar"], cdnOrigins: [CDN] }),
      null,
    );
    assert.equal(xrExperienceFor({ source: null, modes: ["ar"], cdnOrigins: [CDN] }), null);
  });

  const refused: [string, string][] = [
    ["a review copy", `${CDN}/review/${ID}/3f9a1c2b7d4e8f60/scene.glb`],
    ["an upload", `${CDN}/uploads/${ID}/u-1/source.glb`],
    ["a private original", `${CDN}/originals/${ID}/3f9a1c2b7d4e8f60/source.glb`],
    ["another host", "https://models.example.com/scene.glb"],
    ["a presigned URL", `${MODEL_URL}?X-Amz-Signature=abc`],
    ["credentials in the URL", `https://u:p@cdn.media.test/m/${ID}/3f9a1c2b7d4e8f60/scene.glb`],
    ["path traversal", `${CDN}/m/${ID}/3f9a1c2b7d4e8f60/../../../review/x/y/scene.glb`],
    ["a javascript: URL", "javascript:alert(1)//.glb"],
    ["a malformed URL", "https://[::1"],
  ];
  for (const [name, url] of refused) {
    it(`refuses ${name}`, () => assert.equal(xrExperienceFor({ source: { kind: "model", url }, modes: ["ar"], cdnOrigins: [CDN] }), null));
  }

  it("refuses CDN media when this build has no media origin (production today)", () => {
    assert.equal(xrExperienceFor({ source: model, modes: ["ar"], cdnOrigins: [] }), null);
  });

  it("keeps scale deterministic: a stated scale, or the documented default", () => {
    assert.deepEqual(normalizeXrScale({ metersPerUnit: 0.02, previewScale: 1 }), { metersPerUnit: 0.02, previewScale: 1 });
    for (const bad of [null, undefined, {}, { metersPerUnit: 0, previewScale: 1 }, { metersPerUnit: 1, previewScale: -2 }, { metersPerUnit: Number.NaN, previewScale: 1 }]) {
      assert.deepEqual(normalizeXrScale(bad), DEFAULT_XR_SCALE);
    }
  });
});

// ── Session lifecycle ────────────────────────────────────────────────────────

describe("XR session lifecycle", () => {
  const support = { ar: true, vr: true };

  it("starts only from idle or after an error, and only for a supported mode", () => {
    assert.equal(canRequestXr(XR_INITIAL_STATE, "ar", support), true);
    assert.equal(canRequestXr(XR_INITIAL_STATE, "ar", { ar: false, vr: true }), false);
    assert.equal(canRequestXr(active("ar"), "vr", support), false);
    assert.equal(canRequestXr(run([{ type: "failed", kind: "failed" }]), "ar", support), true);
  });

  it("refuses a second session while one is starting, running or ending", () => {
    const requesting = run([{ type: "request", mode: "ar" }]);
    assert.deepEqual(xrReduce(requesting, { type: "request", mode: "vr" }), requesting);
    const running = active("ar");
    assert.deepEqual(xrReduce(running, { type: "request", mode: "vr" }), running);
    const ending = xrReduce(running, { type: "request-exit" });
    assert.deepEqual(xrReduce(ending, { type: "request", mode: "ar" }), ending);
  });

  it("runs the AR placement order: searching → surface found → placed", () => {
    const started = active("ar");
    assert.equal(started.placement, "searching");
    assert.equal(xrReduce(started, { type: "place" }).placement, "searching", "cannot place before a surface is found");
    const ready = xrReduce(started, { type: "surface", found: true });
    assert.equal(ready.placement, "ready");
    assert.equal(xrReduce(ready, { type: "surface", found: false }).placement, "searching", "the surface can be lost again");
    const done = xrReduce(ready, { type: "place" });
    assert.equal(done.placement, "placed");
    assert.equal(xrReduce(done, { type: "surface", found: false }).placement, "placed", "a placed model stays put");
  });

  it("only transforms a placed AR model, and a VR model from the start", () => {
    assert.equal(canTransform(active("ar")), false);
    assert.equal(canTransform(placed()), true);
    assert.equal(canTransform(active("vr")), true);
    assert.equal(canTransform(XR_INITIAL_STATE), false);
    const turned = xrReduce(placed(), { type: "rotate", deltaDeg: -30 });
    assert.equal(turned.rotationDeg, 330, "rotation wraps");
    assert.equal(xrReduce(active("ar"), { type: "rotate", deltaDeg: 30 }).rotationDeg, 0, "ignored before placement");
  });

  it("clamps scale to the documented limits and ignores nonsense factors", () => {
    let state = placed();
    for (let i = 0; i < 40; i++) state = xrReduce(state, { type: "scale-by", factor: XR_SCALE_LIMITS.step });
    assert.equal(state.scale, XR_SCALE_LIMITS.max);
    for (let i = 0; i < 80; i++) state = xrReduce(state, { type: "scale-by", factor: 1 / XR_SCALE_LIMITS.step });
    assert.equal(state.scale, XR_SCALE_LIMITS.min);
    for (const factor of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(xrReduce(state, { type: "scale-by", factor }).scale, state.scale);
    }
  });

  it("resets placement back to searching, with the model at its stated scale", () => {
    const reset = xrReduce(xrReduce(placed(), { type: "rotate", deltaDeg: 90 }), { type: "reset-placement" });
    assert.deepEqual([reset.placement, reset.rotationDeg, reset.scale], ["searching", 0, 1]);
    assert.equal(xrReduce(active("vr"), { type: "reset-placement" }).phase, "active", "VR has no placement to reset");
  });

  it("returns to the standard viewer on exit, on an unexpected end, and after a failure", () => {
    assert.deepEqual(xrReduce(xrReduce(active("ar"), { type: "request-exit" }), { type: "ended" }), XR_INITIAL_STATE);
    assert.deepEqual(xrReduce(placed(), { type: "ended" }), XR_INITIAL_STATE, "an end we did not ask for still cleans up");
    const denied = xrReduce(run([{ type: "request", mode: "ar" }]), { type: "failed", kind: "denied" });
    assert.deepEqual([denied.phase, denied.error, denied.mode], ["error", "denied", null]);
    assert.deepEqual(xrReduce(denied, { type: "dismiss-error" }), XR_INITIAL_STATE);
    // Failure during a running session also returns to the viewer.
    assert.equal(xrReduce(placed(), { type: "failed", kind: "lost" }).phase, "error");
  });

  it("survives rapid enter/exit without leaving a half-open state", () => {
    let state: XrState = XR_INITIAL_STATE;
    for (let i = 0; i < 10; i++) {
      state = run([{ type: "request", mode: i % 2 ? "vr" : "ar" }, { type: "started" }, { type: "request-exit" }, { type: "ended" }], state);
    }
    assert.deepEqual(state, XR_INITIAL_STATE);
  });

  it("tells the page when the session owns the display", () => {
    assert.equal(xrOwnsDisplay(XR_INITIAL_STATE), false);
    assert.equal(xrOwnsDisplay(active("vr")), true);
    assert.equal(xrOwnsDisplay(xrReduce(active("vr"), { type: "request-exit" })), true);
    assert.equal(xrOwnsDisplay(run([{ type: "failed", kind: "failed" }])), false);
  });

  it("classifies failures, including PlayCanvas's own refusals", () => {
    const dom = (name: string, message = "") => Object.assign(new Error(message), { name });
    assert.equal(classifyXrError(dom("NotAllowedError", "Permission denied")), "denied");
    assert.equal(classifyXrError(dom("SecurityError", "The requested session requires user activation.")), "denied");
    assert.equal(classifyXrError(dom("NotSupportedError", "session configuration not supported")), "unsupported");
    // PlayCanvas refuses before calling the browser when its device check has not answered yet.
    assert.equal(classifyXrError(new Error("XR is not available")), "unsupported");
    assert.equal(classifyXrError(new Error("XR session is already started")), "failed");
    assert.equal(classifyXrError(new Error("boom")), "failed");
    assert.equal(classifyXrError(null), "failed");
  });

  it("gives plain-language instructions, messages and announcements", () => {
    assert.match(arInstruction(active("ar")), /find a floor|surface/i);
    assert.match(arInstruction(xrReduce(active("ar"), { type: "surface", found: true })), /tap place/i);
    assert.equal(arInstruction(active("vr")), "");
    for (const kind of ["unsupported", "denied", "failed", "lost"] as const) {
      const message = xrErrorMessage("ar", kind);
      assert.ok(message.length > 0 && !/webxr|immersive-ar/i.test(message), message);
    }
    assert.match(xrErrorMessage("ar", "denied"), /nothing was recorded/i);
    assert.equal(xrAnnouncement(run([{ type: "request", mode: "ar" }]), active("ar")), "AR preview started.");
    assert.equal(xrAnnouncement(run([{ type: "request", mode: "vr" }]), active("vr")), "VR walkthrough started.");
    assert.equal(xrAnnouncement(active("ar"), XR_INITIAL_STATE), "Returned to the standard 3D viewer.");
    assert.equal(xrAnnouncement(xrReduce(active("ar"), { type: "surface", found: true }), placed()), "Model placed.");
  });
});

// ── Project page ─────────────────────────────────────────────────────────────

describe("project page: XR entry points", () => {
  /* No project carries immersive media any more — the pilots moved to /labs —
     so XR is asserted against a project record holding a model, which is what a
     reviewer publishing a real one produces. */
  const reef = getProject("reef-996-dubai-production-city") as Project;
  const withModel: Project = {
    ...reef,
    immersive: {
      mediaId: "8ba87bf969112016e7905b6f",
      kind: "MODEL",
      format: "GLB",
      storageKey: "m/8ba87bf969112016e7905b6f/de1d54d4e9da0d02",
      entryFile: "scene.glb",
      contentHash: "370418ddb037b189a64f4c1f761398b8fcf9974ca9028b9ab188bb3a37ba7ef2",
      sizeBytes: 1840,
      poster: null,
      processingVersion: "1.0.0/passthrough-v1",
      altText: "Massing model of the tower.",
      review: "approved",
      xr: { modes: ["ar", "vr"], scale: { metersPerUnit: 1, previewScale: 1 } },
    },
  };

  it("a model that opted in offers AR and VR, with a stated scale", () => {
    const config = projectViewerConfig(withModel, "development");
    assert.deepEqual(config?.xr?.modes, ["ar", "vr"]);
    assert.deepEqual(config?.xr?.scale, { metersPerUnit: 1, previewScale: 1 });
    // Reviewed media is not a placeholder, so XR does not mark it as one.
    assert.equal(config?.xr?.placeholder, false);
    assert.equal(config?.xr?.source.url, config?.source.url, "XR uses the same published model as the 3D viewer");
  });

  it("offers no XR in production, because there is no media origin there", () => {
    assert.equal(projectViewerConfig(withModel, "production"), null);
  });

  it("offers no XR for a project that did not opt in", () => {
    const optedOut: Project = { ...withModel, immersive: { ...withModel.immersive!, xr: undefined } };
    assert.equal(projectViewerConfig(optedOut, "development")?.xr, null);
  });

  it("offers no XR for a project with no model at all, nor for a site-hosted one", () => {
    assert.equal(projectViewerConfig(getProject("reef-997-dubai-islands") as Project, "development"), null);
    assert.equal(projectViewerConfig(reef, "development")?.xr ?? null, null);
  });

  it("does not add a mode to the page's experiences: XR belongs to the 3D model", () => {
    assert.deepEqual(immersiveModes({ model: {}, tour: null, splat: null }), ["model"]);
    assert.deepEqual(immersiveModes({ model: null, tour: {}, splat: {} }), ["panorama", "splat"]);
    assert.deepEqual(immersiveModes({ model: {}, tour: {}, splat: {} }), ["model", "panorama", "splat"]);
    assert.deepEqual(immersiveModes({ model: null, tour: null, splat: null }), []);
  });
});

// ── Analytics ────────────────────────────────────────────────────────────────

describe("XR analytics", () => {
  it("allows the XR events", () => {
    for (const name of ["ar_opened", "ar_started", "ar_placement", "ar_placement_reset", "ar_error", "vr_opened", "vr_started", "vr_error", "xr_exit"]) {
      assert.ok((VIEWER_EVENTS as readonly string[]).includes(name), name);
      assert.ok(sanitizeViewerEvent(name, {}));
    }
  });

  it("keeps only allow-listed values, and never anything from the session", () => {
    const event = sanitizeViewerEvent("ar_started", {
      project: "reef-996-dubai-production-city",
      xrMode: "ar",
      errorKind: "denied",
      exitReason: "user",
      modelUrl: MODEL_URL,
      cameraFrame: "data:image/png;base64,AAA",
      deviceId: "abc-123-device",
      sourceKey: "uploads/x/y/source.glb",
      hitPose: { x: 1, y: 2, z: 3 },
    });
    assert.deepEqual(event, { name: "ar_started", props: { project: "reef-996-dubai-production-city", xrMode: "ar", errorKind: "denied", exitReason: "user" } });
  });

  it("drops unknown modes and reasons", () => {
    assert.deepEqual(sanitizeViewerEvent("vr_error", { xrMode: "xr", exitReason: "crashed", errorKind: "camera" })?.props, {});
  });
});
