import { resolveModelUrl } from "./source";
import type { ViewerSource } from "./types";
import type { XrMode } from "./xr-capabilities";

/**
 * What a project offers in XR, decided on the server and sent to the browser as
 * plain data.
 *
 * XR capability is deliberately *not* implied by a media kind: a published
 * model is shown in 3D whether or not it may be used in AR or VR. A project
 * must opt in per mode, and only a published, immutable model URL can ever be
 * used — the browser never decides that a URL is XR-safe.
 *
 * Panoramas and Gaussian splats have no XR mode in Phase 8 (see the runbook).
 */

/** Scale of the published model, so AR can place it at a deterministic size. */
export type XrScale = {
  /** Metres per model unit, as authored. 1 = the GLB is in metres (glTF's own convention). */
  metersPerUnit: number;
  /**
   * Extra factor applied when placing in AR, e.g. 0.02 for a 1:50 tabletop
   * model of a tower. 1 = life size. Never inferred from the geometry.
   */
  previewScale: number;
};

export const DEFAULT_XR_SCALE: XrScale = { metersPerUnit: 1, previewScale: 1 };

/** AR/VR scale limits the visitor can reach with the on-screen controls. */
export const XR_SCALE_LIMITS = { min: 0.1, max: 4, step: 1.25 } as const;

export type XrExperience = {
  /** Modes this project offers, subject to what the device supports. */
  modes: readonly XrMode[];
  /** The published model shown in XR: the same source the 3D viewer loads. */
  source: Extract<ViewerSource, { kind: "model" }>;
  scale: XrScale;
  /** Shown under the AR/VR buttons; plain language, no WebXR terms. */
  arHelp: string;
  vrHelp: string;
  /** True when the model does not depict the project; the page must say so. */
  placeholder: boolean;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/** Keeps a scale only if both factors are positive and finite; otherwise the deterministic default. */
export function normalizeXrScale(scale: unknown): XrScale {
  const s = scale as Partial<XrScale> | null;
  if (!s || !finite(s.metersPerUnit) || !finite(s.previewScale)) return DEFAULT_XR_SCALE;
  return { metersPerUnit: s.metersPerUnit, previewScale: s.previewScale };
}

/**
 * Builds the XR experience for a project, or null when there is none.
 *
 * `source` must be the model the 3D viewer already validated, and its URL is
 * re-checked here against the published-media policy (`resolveModelUrl`), so a
 * review copy, an upload, an original, an external host or a malformed URL can
 * never reach an XR session even if project data asked for it.
 */
export function xrExperienceFor(input: {
  source: ViewerSource | null;
  modes: readonly XrMode[];
  scale?: unknown;
  placeholder?: boolean;
  /** The media CDN of this build; [] when there is none (production today). */
  cdnOrigins: readonly string[];
  /** Any origin: only the path matters for same-origin models. */
  policyOrigin?: string;
}): XrExperience | null {
  const { source, cdnOrigins, policyOrigin = "https://site.invalid" } = input;
  if (!source || source.kind !== "model") return null;
  const modes = XR_MODE_ORDER.filter((mode) => input.modes.includes(mode));
  if (modes.length === 0) return null;
  if (!resolveModelUrl(source.url, policyOrigin, cdnOrigins)) return null;
  return {
    modes,
    source: { kind: "model", url: source.url },
    scale: normalizeXrScale(input.scale),
    arHelp: "Place this space in your room.",
    vrHelp: "Explore this property in VR.",
    placeholder: input.placeholder === true,
  };
}

const XR_MODE_ORDER: readonly XrMode[] = ["ar", "vr"];
