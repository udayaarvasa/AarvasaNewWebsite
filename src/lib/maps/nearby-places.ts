/**
 * What "nearby" is allowed to mean on a property page.
 *
 * Proximity is a selling point, which is exactly why it has to be disciplined.
 * Every place shown here comes from Google Places and is labelled as such; none
 * is written into the repository, because a hand-kept list of amenities near a
 * building is a list that goes stale silently and reads as a promise.
 *
 * The limits below are deliberate. A map carpeted in pins tells a buyer nothing
 * and makes an ordinary neighbourhood look remarkable, so each category returns
 * a handful of the closest results and the page says plainly that the list is
 * not exhaustive.
 *
 * Pure: no network, no Google SDK, no DOM. The request shapes and the result
 * filtering are asserted directly by tests; the SDK call lives in the client
 * component.
 */

import type { VerifiedCoordinates } from "./google-3d";

export type NearbyCategory = {
  /** Stable key, used for the selector and for analytics. */
  readonly id: string;
  /** What a visitor reads. */
  readonly label: string;
  /**
   * Google Places types to search. Several per category because Places splits
   * what a buyer thinks of as one thing: "transit" is stations of several kinds.
   */
  readonly includedTypes: readonly string[];
};

/**
 * The categories a buyer actually asks about when looking at a home, in the
 * order they tend to ask. Deliberately short: every extra category is another
 * reason to cover the map in pins.
 */
export const NEARBY_CATEGORIES: readonly NearbyCategory[] = [
  { id: "transit", label: "Metro & transit", includedTypes: ["subway_station", "train_station", "transit_station", "bus_station"] },
  { id: "schools", label: "Schools", includedTypes: ["school", "primary_school", "secondary_school"] },
  { id: "health", label: "Hospitals", includedTypes: ["hospital", "doctor"] },
  { id: "shopping", label: "Shopping", includedTypes: ["shopping_mall", "supermarket"] },
  { id: "dining", label: "Restaurants", includedTypes: ["restaurant", "cafe"] },
  { id: "parks", label: "Parks & recreation", includedTypes: ["park", "gym"] },
];

export const NEARBY_LIMITS = {
  /**
   * Metres around the property. Far enough to catch the station a buyer would
   * actually walk to, near enough that nothing twenty minutes away is presented
   * as "nearby".
   */
  radiusMetres: 2000,
  /** Results per category. Enough to be useful, few enough to read. */
  perCategory: 5,
  /** Total pins on the map at once, however many categories are selected. */
  maxMarkers: 15,
} as const;

/** Google's required credit for Places results. Shown wherever they are. */
export const PLACES_ATTRIBUTION = "Nearby places from Google";

/**
 * The qualifier shown beside any list of nearby places.
 *
 * Not boilerplate: Places returns what Google knows about, ranked by its own
 * measure, and presenting that as the complete picture of a neighbourhood would
 * be a claim nobody has checked.
 */
export const NEARBY_DISCLAIMER =
  "A sample of what Google lists near this location, not a complete survey. Distances are straight-line.";

export const findCategory = (id: string): NearbyCategory | undefined =>
  NEARBY_CATEGORIES.find((c) => c.id === id);

/**
 * The request for one category, in the shape the Places `searchNearby` call
 * takes. Built here so the limits cannot be forgotten at a call site.
 */
export function nearbyRequest(category: NearbyCategory, center: VerifiedCoordinates) {
  return {
    includedTypes: [...category.includedTypes],
    maxResultCount: NEARBY_LIMITS.perCategory,
    locationRestriction: {
      center: { lat: center.lat, lng: center.lng },
      radius: NEARBY_LIMITS.radiusMetres,
    },
    rankPreference: "DISTANCE" as const,
  };
}

/** One place, reduced to what the page shows. */
export type NearbyPlace = {
  readonly id: string;
  readonly name: string;
  readonly categoryId: string;
  readonly location: VerifiedCoordinates;
  /** Straight-line metres from the property. */
  readonly metres: number;
};

/** Metres between two coordinates on a sphere. Straight line, not walking distance. */
export function metresBetween(a: VerifiedCoordinates, b: VerifiedCoordinates): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

/** "450 m" or "1.4 km". Rounded honestly, never flattered. */
export function formatDistance(metres: number): string {
  return metres < 1000 ? `${metres} m` : `${(metres / 1000).toFixed(1)} km`;
}

type RawPlace = { id?: unknown; displayName?: unknown; location?: unknown };

/**
 * Map what Places returned to what the page shows, dropping anything that does
 * not carry an id, a name and a usable position.
 *
 * Nothing is invented to fill a gap: a result missing its location is dropped
 * rather than pinned at the property, and a category that returns nothing shows
 * as empty rather than borrowing from another.
 */
export function toNearbyPlaces(
  raw: readonly RawPlace[],
  categoryId: string,
  center: VerifiedCoordinates,
): NearbyPlace[] {
  const out: NearbyPlace[] = [];
  for (const place of raw) {
    const id = typeof place.id === "string" ? place.id : null;
    // displayName arrives as { text } on the new Places classes, a string on the old.
    const name =
      typeof place.displayName === "string"
        ? place.displayName
        : typeof (place.displayName as { text?: unknown } | null)?.text === "string"
          ? ((place.displayName as { text: string }).text)
          : null;
    const loc = place.location as { lat?: unknown; lng?: unknown } | null;
    // The SDK hands back either plain numbers or LatLng objects with accessors.
    const read = (v: unknown): number | null =>
      typeof v === "number" ? v : typeof v === "function" ? (v as () => number)() : null;
    const lat = read(loc?.lat);
    const lng = read(loc?.lng);
    if (!id || !name || lat === null || lng === null) continue;
    const location = { lat, lng };
    const metres = metresBetween(center, location);
    if (metres > NEARBY_LIMITS.radiusMetres) continue;
    out.push({ id, name, categoryId, location, metres });
  }
  // Closest first, and never more than the category's share.
  return out.sort((a, b) => a.metres - b.metres).slice(0, NEARBY_LIMITS.perCategory);
}

/** Cap the pins across every selected category, keeping the closest overall. */
export function capMarkers(places: readonly NearbyPlace[]): NearbyPlace[] {
  return [...places].sort((a, b) => a.metres - b.metres).slice(0, NEARBY_LIMITS.maxMarkers);
}
