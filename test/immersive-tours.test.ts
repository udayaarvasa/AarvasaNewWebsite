/**
 * The Immersive Tour catalogue: which film shows which space, and when.
 *
 * Pinned against the scene lists established from the footage itself, so a
 * scene cannot be quietly added that no film shows, and against the binding
 * rules, so a film that has not been through the pipeline can never play.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  IMMERSIVE_TOURS,
  TOUR_CATEGORY_LABEL,
  TOUR_UNAVAILABLE_MESSAGE,
  boundFilmIds,
  resolveImmersiveTour,
  tourForProject,
  type ImmersiveTourCatalogue,
} from "../src/lib/immersive-tours.ts";
import type { PublishedVideo } from "../src/lib/viewer/published-videos.ts";

const byName = (name: string) => IMMERSIVE_TOURS.find((t) => t.projectName === name)!;

const labels = (t: ImmersiveTourCatalogue) => [...t.scenes].sort((a, b) => a.order - b.order).map((s) => TOUR_CATEGORY_LABEL[s.category]);

test("each project's scenes are exactly the ones the footage supports, in order", () => {
  assert.deepEqual(labels(byName("REEF 998")), [
    "Exterior", "Sunken balcony", "Gym", "Residence", "Pool",
    "Corridor", "Lift lobby", "Retail arcade", "Bakery", "Florist", "Gourmet grocer",
  ]);
  assert.deepEqual(labels(byName("REEF 999")), ["Exterior", "Sunken balcony", "Amenity deck", "Pool", "Construction progress"]);
  assert.deepEqual(labels(byName("REEF 1000")), ["Exterior", "Sunken balcony", "Lobby", "Pool", "Construction progress"]);
});

test("each tour is two films, traced to the file supplied and how it was identified", () => {
  const supplied = IMMERSIVE_TOURS.flatMap((t) => t.films.map((f) => f.suppliedAs)).sort();
  assert.deepEqual(supplied, [
    "WhatsApp Video 2026-10-04 at 17.54.27.mp4",
    "WhatsApp Video 2026-10-04 at 17.54.28.mp4",
    "WhatsApp Video 2026-10-04 at 17.55.52.mp4",
    "WhatsApp Video 2026-10-04 at 17.55.58.mp4",
    "WhatsApp Video 2026-10-04 at 17.59.50.mp4",
    "WhatsApp Video 2026-10-04 at 17.59.53.mp4",
  ]);
  for (const tour of IMMERSIVE_TOURS) {
    assert.equal(tour.films.length, 2, tour.projectName);
    for (const film of tour.films) {
      // Identity rests on what the film shows, which names the project.
      assert.match(film.identifiedBy, new RegExp(tour.projectName.replace("REEF ", "")), film.ref);
    }
  }
});

test("orders are contiguous and every scene sits inside its film", () => {
  for (const tour of IMMERSIVE_TOURS) {
    const orders = tour.scenes.map((s) => s.order).sort((a, b) => a - b);
    assert.deepEqual(orders, orders.map((_, i) => i + 1), tour.projectName);
    const refs = new Set(tour.scenes.map((s) => s.ref));
    assert.equal(refs.size, tour.scenes.length, `${tour.projectName} scene refs are unique`);
    for (const scene of tour.scenes) {
      const film = tour.films.find((f) => f.ref === scene.film);
      assert.ok(film, `${scene.ref} names a film in its own tour`);
      assert.ok(scene.startSeconds >= 0 && scene.startSeconds < scene.endSeconds, scene.ref);
      assert.ok(scene.endSeconds <= film.durationSeconds + 1e-6, `${scene.ref} ends inside ${film.ref}`);
      assert.ok(scene.evidence.length > 0, `${scene.ref} says where it was seen`);
    }
  }
});

test("films are labelled for what they are: renders, or footage of a real site", () => {
  for (const tour of IMMERSIVE_TOURS) {
    for (const film of tour.films) assert.ok(["DEVELOPER_RENDER", "SITE_FOOTAGE"].includes(film.provenance), film.ref);
  }
  // The two progress films were shot on site; the rest are renders.
  const footage = IMMERSIVE_TOURS.flatMap((t) => t.films).filter((f) => f.provenance === "SITE_FOOTAGE").map((f) => f.suppliedAs).sort();
  assert.deepEqual(footage, ["WhatsApp Video 2026-10-04 at 17.54.27.mp4", "WhatsApp Video 2026-10-04 at 17.55.58.mp4"]);
});

test("nothing in the catalogue is described as 360 or spherical", () => {
  const text = JSON.stringify(IMMERSIVE_TOURS) + JSON.stringify(TOUR_CATEGORY_LABEL) + TOUR_UNAVAILABLE_MESSAGE;
  assert.doesNotMatch(text, /360|spherical|equirect|panoram|walkthrough/i);
});

test("no film is bound until it has been through the pipeline, so no tour plays today", () => {
  for (const tour of IMMERSIVE_TOURS) {
    assert.deepEqual(boundFilmIds(tour), [], tour.projectName);
    assert.equal(resolveImmersiveTour(tour, new Map()), null, tour.projectName);
  }
});

test("a tour with no project record never attaches to a page", () => {
  // REEF 999 and 1000 have no project record; inventing one would invent their
  // location, price and completion date.
  assert.equal(byName("REEF 999").projectSlug, null);
  assert.equal(byName("REEF 1000").projectSlug, null);
  assert.equal(tourForProject("reef-998-dlrc")?.projectName, "REEF 998");
  assert.equal(tourForProject("reef-996-dubai-production-city"), null);
  assert.equal(tourForProject(""), null);
});

/* ── Binding ─────────────────────────────────────────────────────────────── */

const film = (over: Partial<PublishedVideo> = {}): PublishedVideo => ({
  mediaId: "a".repeat(32),
  url: "https://cdn.example/m/a/b/film.mp4",
  posterUrl: null,
  mimeType: "video/mp4",
  width: 480,
  height: 848,
  durationSeconds: 21,
  altText: "Film",
  provenanceLabel: "Developer render",
  provenanceNote: null,
  ...over,
});

/** REEF 998 with film A bound to `id`. */
const bound = (id: string, filmB: string | null = null): ImmersiveTourCatalogue => {
  const t = byName("REEF 998");
  return {
    ...t,
    films: t.films.map((f) => (f.ref === "998-film-a" ? { ...f, mediaAssetId: id } : f.ref === "998-film-b" ? { ...f, mediaAssetId: filmB } : f)),
  };
};

test("a bound, resolved film yields its scenes in order, carrying nothing private", () => {
  const id = "a".repeat(32);
  const scenes = resolveImmersiveTour(bound(id), new Map([[id, film()]]));
  assert.ok(scenes);
  assert.deepEqual(scenes.map((s) => s.title), ["The tower", "Sunken balcony", "Gym", "Residence", "Pool"]);
  for (const s of scenes) {
    assert.equal("mediaId" in s.video, false, "ids stay on the server");
    assert.equal(s.video.url, "https://cdn.example/m/a/b/film.mp4");
  }
});

test("a film that did not resolve contributes no scenes, and nothing takes its place", () => {
  const a = "a".repeat(32);
  const b = "b".repeat(32);
  // Film B is bound but missing from what the resolver returned (withheld,
  // unpublished, or another project's): only film A's scenes remain.
  const scenes = resolveImmersiveTour(bound(a, b), new Map([[a, film()]]));
  assert.equal(scenes?.length, 5);
  assert.ok(scenes?.every((s) => s.video.ref === "998-film-a"));
});

test("a published film whose provenance contradicts the catalogue is refused, not relabelled", () => {
  const id = "a".repeat(32);
  assert.equal(resolveImmersiveTour(bound(id), new Map([[id, film({ provenanceLabel: "Site footage" })]])), null);
});

test("a poster is optional and passes through when present", () => {
  const id = "a".repeat(32);
  const scenes = resolveImmersiveTour(bound(id), new Map([[id, film({ posterUrl: "https://cdn.example/p.webp" })]]));
  assert.equal(scenes?.[0].video.posterUrl, "https://cdn.example/p.webp");
});

test("scenes beyond the end of the film that was actually published are dropped", () => {
  const id = "a".repeat(32);
  // A 10-second film cannot hold the scenes catalogued at 12 s.
  const scenes = resolveImmersiveTour(bound(id), new Map([[id, film({ durationSeconds: 10 })]]));
  assert.deepEqual(scenes?.map((s) => s.title), ["The tower", "Sunken balcony", "Gym", "Residence"]);
});
