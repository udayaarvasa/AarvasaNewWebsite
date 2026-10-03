/**
 * What may be shown as "nearby".
 *
 * Proximity sells, which is why it needs rules. Nothing here is written into the
 * repository — a hand-kept list of amenities near a building goes stale silently
 * and reads as a promise — and nothing is invented to fill a gap in what Google
 * returned. These cases pin both.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NEARBY_CATEGORIES,
  NEARBY_DISCLAIMER,
  NEARBY_LIMITS,
  PLACES_ATTRIBUTION,
  capMarkers,
  findCategory,
  formatDistance,
  metresBetween,
  nearbyRequest,
  toNearbyPlaces,
} from "../src/lib/maps/nearby-places.ts";

const CENTER = { lat: 25.2048, lng: 55.2708 };

/** A place `metres` roughly north of the centre. */
const north = (id: string, name: string, metres: number) => ({
  id,
  displayName: { text: name },
  location: { lat: CENTER.lat + metres / 111_320, lng: CENTER.lng },
});

test("the categories are the ones a buyer asks about, and stay few", () => {
  const ids = NEARBY_CATEGORIES.map((c) => c.id);
  assert.deepEqual(ids, ["transit", "schools", "health", "shopping", "dining", "parks"]);
  // Every extra category is another reason to carpet the map in pins.
  assert.ok(NEARBY_CATEGORIES.length <= 8);
  for (const c of NEARBY_CATEGORIES) {
    assert.ok(c.includedTypes.length > 0, c.id);
    assert.ok(c.label.length > 0, c.id);
  }
  assert.equal(findCategory("transit")?.label, "Metro & transit");
  assert.equal(findCategory("nonsense"), undefined);
});

test("the request carries the limits, so a call site cannot forget them", () => {
  const req = nearbyRequest(NEARBY_CATEGORIES[0], CENTER);
  assert.equal(req.maxResultCount, NEARBY_LIMITS.perCategory);
  assert.equal(req.locationRestriction.radius, NEARBY_LIMITS.radiusMetres);
  assert.deepEqual(req.locationRestriction.center, CENTER);
  // Closest first: a distant mall is not more "nearby" than the station outside.
  assert.equal(req.rankPreference, "DISTANCE");
});

test("distance is measured, not estimated", () => {
  assert.equal(metresBetween(CENTER, CENTER), 0);
  // One degree of latitude is about 111 km.
  const d = metresBetween(CENTER, { lat: CENTER.lat + 1, lng: CENTER.lng });
  assert.ok(Math.abs(d - 111_000) < 1_000, String(d));
  assert.equal(formatDistance(450), "450 m");
  assert.equal(formatDistance(1400), "1.4 km");
});

test("a result missing an id, a name or a position is dropped, never pinned at the property", () => {
  const raw = [
    north("a", "Metro Station", 300),
    { id: "b", displayName: { text: "No location" } },
    { displayName: { text: "No id" }, location: { lat: CENTER.lat, lng: CENTER.lng } },
    { id: "d", location: { lat: CENTER.lat, lng: CENTER.lng } },
  ];
  const places = toNearbyPlaces(raw, "transit", CENTER);
  assert.deepEqual(places.map((p) => p.id), ["a"]);
  assert.equal(places[0].name, "Metro Station");
  assert.equal(places[0].categoryId, "transit");
});

test("anything beyond the radius is dropped rather than called nearby", () => {
  const raw = [north("close", "Close", 400), north("far", "Far", NEARBY_LIMITS.radiusMetres + 2_000)];
  assert.deepEqual(toNearbyPlaces(raw, "transit", CENTER).map((p) => p.id), ["close"]);
});

test("results come back closest first and capped per category", () => {
  const raw = Array.from({ length: 12 }, (_, i) => north(`p${i}`, `Place ${i}`, (12 - i) * 100));
  const places = toNearbyPlaces(raw, "dining", CENTER);
  assert.equal(places.length, NEARBY_LIMITS.perCategory);
  for (let i = 1; i < places.length; i++) {
    assert.ok(places[i].metres >= places[i - 1].metres, "sorted by distance");
  }
});

test("the map is capped overall, however many categories are on", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`,
    name: `X${i}`,
    categoryId: "dining",
    location: CENTER,
    metres: i * 10,
  }));
  const capped = capMarkers(many);
  assert.equal(capped.length, NEARBY_LIMITS.maxMarkers);
  assert.equal(capped[0].metres, 0, "the closest survive the cap");
});

test("a plain string display name is accepted too", () => {
  const raw = [{ id: "a", displayName: "Old Shape", location: { lat: CENTER.lat, lng: CENTER.lng } }];
  assert.equal(toNearbyPlaces(raw, "parks", CENTER)[0]?.name, "Old Shape");
});

test("an empty category stays empty rather than borrowing from another", () => {
  assert.deepEqual(toNearbyPlaces([], "schools", CENTER), []);
});

test("the list is credited to Google and never called complete", () => {
  assert.match(PLACES_ATTRIBUTION, /Google/);
  assert.match(NEARBY_DISCLAIMER, /not a complete survey/i);
  assert.match(NEARBY_DISCLAIMER, /straight-line/i);
});
