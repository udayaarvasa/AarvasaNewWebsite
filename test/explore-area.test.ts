/**
 * What Explore Area is allowed to show.
 *
 * The rule under test is that it refuses rather than guesses. A plausible
 * latitude for "Dubai Islands" is a made-up fact about where somebody's home is,
 * and a confidently wrong pin is worse than an honest absence — so a record with
 * no coordinates produces no map, and no amount of having an API key changes
 * that.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EXPLORE_AREA_NOTE,
  GOOGLE_ATTRIBUTION,
  exploreAreaMode,
  isUsableCoordinate,
  mapsScriptUrl,
} from "../src/lib/maps/google-3d.ts";

const KEY = "test-browser-key";
const DUBAI = { lat: 25.2048, lng: 55.2708 };

test("a key and verified coordinates are both required", () => {
  assert.equal(exploreAreaMode({ coordinates: DUBAI, apiKey: KEY }).kind, "3d");
  assert.equal(exploreAreaMode({ coordinates: DUBAI, apiKey: null }).kind, "unavailable");
  assert.equal(exploreAreaMode({ coordinates: null, apiKey: KEY }).kind, "unavailable");
});

test("a missing key is reported as configuration, not as a missing location", () => {
  const mode = exploreAreaMode({ coordinates: DUBAI, apiKey: "   " });
  assert.equal(mode.kind, "unavailable");
  assert.equal(mode.kind === "unavailable" && mode.reason, "NO_API_KEY");
});

test("every REEF record today produces no map, because none has coordinates", () => {
  // This is the live state of the data, not a hypothetical.
  for (const coordinates of [null, undefined]) {
    const mode = exploreAreaMode({ coordinates, apiKey: KEY });
    assert.equal(mode.kind, "unavailable");
    assert.equal(mode.kind === "unavailable" && mode.reason, "NO_VERIFIED_COORDINATES");
  }
});

test("the visitor is told the location is unconfirmed, not that something broke", () => {
  const mode = exploreAreaMode({ coordinates: null, apiKey: KEY });
  assert.ok(mode.kind === "unavailable" && /not been confirmed/i.test(mode.message));
});

test("nonsense coordinates are refused rather than plotted", () => {
  for (const bad of [
    { lat: 91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: Number.NaN, lng: 10 },
    { lat: Infinity, lng: 10 },
    { lat: "25.2", lng: "55.3" },
    { lat: 25.2 },
    {},
    [],
    "25.2,55.3",
  ]) {
    assert.equal(isUsableCoordinate(bad), false, JSON.stringify(bad));
    assert.equal(exploreAreaMode({ coordinates: bad, apiKey: KEY }).kind, "unavailable");
  }
});

test("Null Island is treated as an empty record, not as a place", () => {
  // (0, 0) is what an uninitialised row looks like, and it is open ocean.
  assert.equal(isUsableCoordinate({ lat: 0, lng: 0 }), false);
  // A real coordinate on one axis only is still a place.
  assert.equal(isUsableCoordinate({ lat: 0, lng: 55.2708 }), true);
});

test("no photorealistic coverage falls back to the flat map at the same point", () => {
  const mode = exploreAreaMode({ coordinates: DUBAI, apiKey: KEY, photorealisticCoverage: false });
  assert.equal(mode.kind, "2d");
  assert.deepEqual(mode.kind === "2d" && mode.center, DUBAI);
});

test("coverage unknown is optimistic, so the attempt is actually made", () => {
  assert.equal(exploreAreaMode({ coordinates: DUBAI, apiKey: KEY }).kind, "3d");
  assert.equal(
    exploreAreaMode({ coordinates: DUBAI, apiKey: KEY, photorealisticCoverage: true }).kind,
    "3d",
  );
});

test("the script URL loads only the 3D library, and carries the key Google expects", () => {
  const url = new URL(mapsScriptUrl(KEY));
  assert.equal(url.origin + url.pathname, "https://maps.googleapis.com/maps/api/js");
  assert.equal(url.searchParams.get("key"), KEY);
  assert.equal(url.searchParams.get("libraries"), "maps3d");
});

test("the note says the surroundings are not the property", () => {
  assert.match(EXPLORE_AREA_NOTE, /not a model of the property/i);
  assert.match(GOOGLE_ATTRIBUTION, /Google/);
});
