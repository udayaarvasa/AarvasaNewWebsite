/**
 * "Explore Area": a property in its real surroundings, on Google's
 * photorealistic 3D map.
 *
 * Two things are kept strictly apart, and this module is where the line is
 * drawn. Google supplies the *context* — the streets, the terrain and the
 * neighbouring buildings. It is never the property's own model: its mesh of a
 * plot is whatever was flown over at the time, which for off-plan inventory is a
 * construction site or bare sand, and presenting that as the building would be a
 * fabrication. The property's own model stays in the PlayCanvas viewer.
 *
 * WHY THIS IS USUALLY UNAVAILABLE, AND WHY THAT IS CORRECT
 *
 * It needs three separate things, and refuses unless it has all of them:
 *
 *   1. A browser API key for this deployment. Without one there is no map, only
 *      a dead viewport.
 *   2. Coordinates that someone verified. Every REEF record currently carries
 *      `coordinates: null`, and a plausible latitude for "Dubai Islands" is a
 *      made-up fact about where someone's home is. A wrong pin is worse than no
 *      pin, so none is shown.
 *   3. Photorealistic 3D coverage at that point. Google's 3D mesh is city-scale
 *      and far from universal; much of the world is 2D only. Coverage is not
 *      something a static table can know, so the component asks for the tiles
 *      and falls back when they do not arrive.
 *
 * Pure: no DOM, no network, no Google SDK. The loader and the element live in
 * the client component, so these rules are asserted directly by tests.
 */

/** Where a property is, once someone has checked. */
export type VerifiedCoordinates = {
  readonly lat: number;
  readonly lng: number;
};

/** How the camera opens over the subject. Degrees and metres. */
export const EXPLORE_AREA_CAMERA = {
  /** Metres from the ground point to the camera. Close enough to read a street. */
  range: 900,
  /** 0° looks straight down; 65° is an oblique view that shows building height. */
  tilt: 65,
  /** Compass heading the camera opens on. North, so the view is not implicitly a claim. */
  heading: 0,
  /** Metres above sea level for the focal point; 0 lets Google use the terrain. */
  altitude: 0,
} as const;

export type ExploreAreaMode =
  /** Everything is present; attempt the photorealistic 3D map. */
  | { readonly kind: "3d"; readonly center: VerifiedCoordinates; readonly apiKey: string }
  /** Coordinates are known but 3D is unavailable here; show the flat map instead. */
  | { readonly kind: "2d"; readonly center: VerifiedCoordinates; readonly apiKey: string }
  /** Nothing can be shown. `reason` is for developers, `message` for visitors. */
  | { readonly kind: "unavailable"; readonly reason: ExploreAreaBlocker; readonly message: string };

export type ExploreAreaBlocker = "NO_API_KEY" | "NO_VERIFIED_COORDINATES" | "COORDINATES_OUT_OF_RANGE";

export const EXPLORE_AREA_MESSAGES: Readonly<Record<ExploreAreaBlocker, string>> = {
  NO_API_KEY: "Maps are not configured in this environment.",
  NO_VERIFIED_COORDINATES:
    "This project's exact location has not been confirmed yet, so it is not shown on a map. The address is listed above.",
  COORDINATES_OUT_OF_RANGE:
    "This project's recorded location could not be read, so it is not shown on a map.",
};

/**
 * Are these usable coordinates?
 *
 * Null Island (0, 0) is rejected along with out-of-range values: it is what an
 * uninitialised record looks like, and it is in the Gulf of Guinea.
 */
export function isUsableCoordinate(value: unknown): value is VerifiedCoordinates {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return !(lat === 0 && lng === 0);
}

/**
 * Decide what, if anything, Explore Area can show.
 *
 * `photorealisticCoverage` is what the browser found out by asking for tiles,
 * not a guess from a list of cities. Before it has answered, pass undefined and
 * the optimistic "3d" mode is returned so the attempt can be made; a failure
 * then re-resolves to "2d".
 */
export function exploreAreaMode(input: {
  readonly coordinates: unknown;
  readonly apiKey: string | null | undefined;
  readonly photorealisticCoverage?: boolean;
}): ExploreAreaMode {
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  if (!apiKey) {
    return { kind: "unavailable", reason: "NO_API_KEY", message: EXPLORE_AREA_MESSAGES.NO_API_KEY };
  }
  if (input.coordinates === null || input.coordinates === undefined) {
    return {
      kind: "unavailable",
      reason: "NO_VERIFIED_COORDINATES",
      message: EXPLORE_AREA_MESSAGES.NO_VERIFIED_COORDINATES,
    };
  }
  if (!isUsableCoordinate(input.coordinates)) {
    return {
      kind: "unavailable",
      reason: "COORDINATES_OUT_OF_RANGE",
      message: EXPLORE_AREA_MESSAGES.COORDINATES_OUT_OF_RANGE,
    };
  }
  const center = { lat: input.coordinates.lat, lng: input.coordinates.lng };
  return { kind: input.photorealisticCoverage === false ? "2d" : "3d", center, apiKey };
}

/**
 * The Maps JavaScript API script URL.
 *
 * `v=alpha` because the 3D map element is not in the stable channel yet, and
 * `libraries=maps3d` because loading the whole API to show one element is the
 * difference between a few hundred kilobytes and a few megabytes on a phone.
 *
 * The key travels in the URL because a Maps browser key is designed to: it is
 * public by construction and is protected by an HTTP-referrer restriction in the
 * Google Cloud console, not by secrecy. A server-side key must never be used
 * here — see docs/google-maps.md.
 */
export function mapsScriptUrl(apiKey: string, library: "maps3d" | "maps" = "maps3d"): string {
  const params = new URLSearchParams({ key: apiKey, v: "alpha", libraries: library });
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

/** Shown under every map. Google's terms require the imagery to be credited. */
export const GOOGLE_ATTRIBUTION = "Map data and imagery ©Google";

/**
 * What the section says about what the visitor is looking at.
 *
 * Deliberately explicit that the buildings are Google's capture of the area as
 * it was flown, which for off-plan inventory does not include the tower being
 * sold.
 */
export const EXPLORE_AREA_NOTE =
  "Surroundings are Google's photorealistic imagery of the area as it was last captured. Buildings under construction may not appear, and this is not a model of the property itself.";
