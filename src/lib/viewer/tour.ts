import { PANORAMA_LIMITS, isValidView, normalizeView, resolvePanoramaUrl } from "./source";
import type { PanoramaView, ViewerSource } from "./types";

/**
 * 360° panoramic tours: a set of rooms (scenes), each one equirectangular
 * panorama, linked by hotspots.
 *
 * Pure and dependency-free (no React, no PlayCanvas, no database), so the
 * server-side project mapping, the client tour component and the tests all use
 * the same rules. A tour only reaches the browser after `sanitizeTour` has
 * rebuilt it field by field, so nothing beyond these public fields can leak
 * through from project data or database rows.
 */

/** Hotspot and scene ids: short, lowercase, URL- and DOM-safe. */
export const TOUR_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

export const TOUR_LIMITS = {
  maxScenes: 40,
  maxHotspotsPerScene: 24,
  maxLabelLength: 80,
  maxDescriptionLength: 280,
} as const;

export const DEFAULT_PANORAMA_VIEW: PanoramaView = { yawDeg: 0, pitchDeg: 0, fovDeg: PANORAMA_LIMITS.defaultFovDeg };

export type TourHotspotType = "navigation" | "info";

/**
 * A point of interest on a panorama, placed by direction (yaw/pitch, in the
 * same convention as `PanoramaView`). "navigation" hotspots move to another
 * scene; "info" hotspots show their description.
 */
export type TourHotspot = {
  id: string;
  label: string;
  yawDeg: number;
  pitchDeg: number;
  type: TourHotspotType;
  /** Required for, and only used by, navigation hotspots. */
  targetSceneId?: string;
  description?: string;
};

export type TourScene = {
  id: string;
  /** Room name, shown in the viewer and announced to screen readers. */
  title: string;
  /** Optional grouping for the room selector, e.g. "Ground floor". */
  floor?: string;
  /** Equirectangular image: a published CDN key URL or a same-origin path. */
  imageUrl: string;
  /** What the panorama shows, for screen readers. */
  alt: string;
  initialView: PanoramaView;
  hotspots: TourHotspot[];
};

export type PanoramaTour = {
  label: string;
  startSceneId: string;
  scenes: TourScene[];
  /** True when the images do not depict the project; the page must say so. */
  placeholder: boolean;
};

// Only the path matters to the URL policy for root-relative images; any origin will do.
const POLICY_ORIGIN = "https://site.invalid";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Trimmed, single-line text within `max` characters, or null. */
function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length > 0 && t.length <= max ? t : null;
}

export type SanitizedTour = { tour: PanoramaTour | null; problems: string[] };

/**
 * Rebuilds a tour from untrusted input, keeping only what is valid:
 *
 * - scenes need a unique id, a title, alt text and an allowed image URL
 *   (`resolvePanoramaUrl`: same-origin, or a published `m/…` key on one of
 *   `cdnOrigins`; never review/, uploads/ or another host);
 * - hotspots need a unique id within their scene, a label and finite angles;
 *   navigation hotspots must target another scene that survived;
 * - the start scene falls back to the first valid scene.
 *
 * Invalid parts are dropped rather than failing the whole tour, and each drop
 * is reported in `problems`. Returns a null tour when no scene survives.
 */
export function sanitizeTour(input: unknown, cdnOrigins: readonly string[]): SanitizedTour {
  const problems: string[] = [];
  if (!isRecord(input) || !Array.isArray(input.scenes)) return { tour: null, problems: ["tour must be an object with a scenes array"] };

  const label = text(input.label, TOUR_LIMITS.maxLabelLength);
  if (!label) problems.push("tour label is missing or too long");

  const scenes: TourScene[] = [];
  const pendingHotspots = new Map<string, unknown[]>();
  for (const [index, raw] of input.scenes.slice(0, TOUR_LIMITS.maxScenes).entries()) {
    const where = `scene ${index}`;
    if (!isRecord(raw)) {
      problems.push(`${where}: not an object`);
      continue;
    }
    const id = typeof raw.id === "string" && TOUR_ID_PATTERN.test(raw.id) ? raw.id : null;
    if (!id) {
      problems.push(`${where}: invalid id`);
      continue;
    }
    if (scenes.some((s) => s.id === id)) {
      problems.push(`${where}: duplicate id "${id}"`);
      continue;
    }
    const title = text(raw.title, TOUR_LIMITS.maxLabelLength);
    const alt = text(raw.alt, TOUR_LIMITS.maxDescriptionLength);
    const imageUrl = typeof raw.imageUrl === "string" ? resolvePanoramaUrl(raw.imageUrl, POLICY_ORIGIN, cdnOrigins) : null;
    if (!title || !alt) {
      problems.push(`scene "${id}": missing title or alt text`);
      continue;
    }
    if (!imageUrl) {
      problems.push(`scene "${id}": image URL is not allowed`);
      continue;
    }
    const floor = raw.floor === undefined ? undefined : text(raw.floor, TOUR_LIMITS.maxLabelLength) ?? undefined;
    const initialView = isValidView(raw.initialView) ? normalizeView(raw.initialView) : { ...DEFAULT_PANORAMA_VIEW };
    scenes.push({ id, title, ...(floor ? { floor } : {}), imageUrl, alt, initialView, hotspots: [] });
    pendingHotspots.set(id, Array.isArray(raw.hotspots) ? raw.hotspots : []);
  }
  if (input.scenes.length > TOUR_LIMITS.maxScenes) problems.push(`only the first ${TOUR_LIMITS.maxScenes} scenes are kept`);

  // Hotspots are checked once every scene is known, so targets can be verified.
  const sceneIds = new Set(scenes.map((s) => s.id));
  for (const scene of scenes) {
    const raws = pendingHotspots.get(scene.id) ?? [];
    for (const [index, raw] of raws.slice(0, TOUR_LIMITS.maxHotspotsPerScene).entries()) {
      const hotspot = sanitizeHotspot(raw, scene.id, sceneIds);
      if (typeof hotspot === "string") {
        problems.push(`scene "${scene.id}" hotspot ${index}: ${hotspot}`);
      } else if (scene.hotspots.some((h) => h.id === hotspot.id)) {
        problems.push(`scene "${scene.id}" hotspot ${index}: duplicate id "${hotspot.id}"`);
      } else {
        scene.hotspots.push(hotspot);
      }
    }
    if (raws.length > TOUR_LIMITS.maxHotspotsPerScene) problems.push(`scene "${scene.id}": only the first ${TOUR_LIMITS.maxHotspotsPerScene} hotspots are kept`);
  }

  if (scenes.length === 0) return { tour: null, problems: [...problems, "no valid scenes"] };
  let startSceneId = typeof input.startSceneId === "string" && sceneIds.has(input.startSceneId) ? input.startSceneId : null;
  if (!startSceneId) {
    problems.push("start scene is missing; using the first scene");
    startSceneId = scenes[0].id;
  }
  return {
    tour: { label: label ?? "360° tour", startSceneId, scenes, placeholder: input.placeholder === true },
    problems,
  };
}

/** A valid hotspot, or the reason it was dropped. */
function sanitizeHotspot(raw: unknown, sceneId: string, sceneIds: ReadonlySet<string>): TourHotspot | string {
  if (!isRecord(raw)) return "not an object";
  const id = typeof raw.id === "string" && TOUR_ID_PATTERN.test(raw.id) ? raw.id : null;
  if (!id) return "invalid id";
  const label = text(raw.label, TOUR_LIMITS.maxLabelLength);
  if (!label) return "missing label";
  if (!finite(raw.yawDeg) || !finite(raw.pitchDeg) || raw.pitchDeg < -90 || raw.pitchDeg > 90) return "yaw/pitch out of range";
  const type: TourHotspotType = raw.type === "info" ? "info" : "navigation";
  if (raw.type !== undefined && raw.type !== "info" && raw.type !== "navigation") return "unknown type";
  const description = raw.description === undefined ? undefined : text(raw.description, TOUR_LIMITS.maxDescriptionLength);
  if (description === null) return "description is empty or too long";

  const { yawDeg } = normalizeView({ yawDeg: raw.yawDeg, pitchDeg: 0, fovDeg: PANORAMA_LIMITS.defaultFovDeg });
  const hotspot: TourHotspot = { id, label, yawDeg, pitchDeg: raw.pitchDeg, type, ...(description ? { description } : {}) };
  if (type === "navigation") {
    const target = raw.targetSceneId;
    if (typeof target !== "string" || !sceneIds.has(target)) return "navigation target does not exist";
    if (target === sceneId) return "navigation target is its own scene";
    hotspot.targetSceneId = target;
  } else if (!description) {
    return "info hotspot needs a description";
  }
  return hotspot;
}

export function sceneById(tour: PanoramaTour, id: string): TourScene | undefined {
  return tour.scenes.find((s) => s.id === id);
}

/** The viewer source for a scene. */
export function sceneSource(scene: TourScene): ViewerSource {
  return { kind: "panorama", url: scene.imageUrl, initialView: scene.initialView };
}

/** Floors in first-appearance order, or [] when no scene has one. Scenes without a floor are grouped under "Other". */
export function tourFloors(tour: PanoramaTour): string[] {
  if (!tour.scenes.some((s) => s.floor)) return [];
  const floors: string[] = [];
  for (const s of tour.scenes) {
    const floor = s.floor ?? "Other";
    if (!floors.includes(floor)) floors.push(floor);
  }
  return floors;
}

export type NavigationResult =
  | { ok: true; scene: TourScene }
  | { ok: false; reason: "missing-target" | "same-scene" };

/** Where following a request to `targetId` from `currentId` leads. Never throws. */
export function navigate(tour: PanoramaTour, currentId: string, targetId: string | undefined): NavigationResult {
  if (targetId === currentId) return { ok: false, reason: "same-scene" };
  const scene = targetId ? sceneById(tour, targetId) : undefined;
  return scene ? { ok: true, scene } : { ok: false, reason: "missing-target" };
}
