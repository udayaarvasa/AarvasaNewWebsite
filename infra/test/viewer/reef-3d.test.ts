/**
 * REEF 3D: every listed REEF property gets the Google 3D surroundings at its own
 * coordinate, labelled approximate; a building model appears only where its
 * public release is recorded, and it is served from the production model CDN.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { getProject, PUBLIC_MODEL_APPROVALS } from "../../../src/lib/projects";
import { exploreAreaMode, AREA_APPROXIMATE_LOCATION } from "../../../src/lib/maps/google-3d";
import { MEDIA_CDN_ORIGIN, PROD_PUBLIC_MODEL_ORIGIN } from "../../../src/lib/viewer/media-origin";
import { projectViewerConfig } from "../../../src/lib/viewer/project-media";

const REEF = ["reef-996-dubai-production-city", "reef-997-dubai-islands", "reef-998-dlrc", "reef-999-al-furjan", "reef-1000-dlrc"] as const;

test("each REEF property has its own coordinate, recorded as locality precision", () => {
  const seen = new Set<string>();
  for (const slug of REEF) {
    const p = getProject(slug);
    assert.ok(p, slug);
    assert.ok(p.coordinates, `${slug} has coordinates`);
    assert.equal(p.coordinatesPrecision, "locality", `${slug} is not presented as a surveyed plot`);
    assert.ok(p.coordinatesSource, `${slug} records where its coordinate came from`);
    const key = `${p.coordinates.lat},${p.coordinates.lng}`;
    assert.ok(!seen.has(key), `${slug} does not reuse another property's coordinate`);
    seen.add(key);
  }
});

test("each REEF property offers the 3D surroundings once a key is configured", () => {
  for (const slug of REEF) {
    const p = getProject(slug)!;
    const mode = exploreAreaMode({ coordinates: p.coordinates, apiKey: "test-key" });
    assert.equal(mode.kind, "3d", slug);
    if (mode.kind === "3d") assert.deepEqual(mode.center, p.coordinates);
  }
  assert.equal(exploreAreaMode({ coordinates: getProject(REEF[0])!.coordinates, apiKey: "" }).kind, "unavailable");
  assert.match(AREA_APPROXIMATE_LOCATION, /approximate/i);
});

test("all five reviewed REEF models are approved, distinct and map-ready", () => {
  assert.deepEqual([...PUBLIC_MODEL_APPROVALS], [...REEF]);
  const keys = new Set<string>();
  for (const slug of REEF) {
    const p = getProject(slug)!;
    assert.equal(p.immersive?.provenance, "AARVASA_RECONSTRUCTION");
    assert.equal(p.immersive?.review, "approved");
    assert.ok(p.immersive?.mapOverlay && p.immersive.mapOverlay.baseOffsetMetres > 0);
    assert.equal(p.coordinatesPrecision, "locality");
    keys.add(p.immersive!.storageKey);
  }
  assert.equal(keys.size, 5);
  assert.equal(getProject("reef-998-dlrc")!.immersive?.contentHash, "589b15693f0a2ef6db8a416dea3a2043b13a30860cc62649f091cd9a219ace20");
  assert.deepEqual(getProject("reef-998-dlrc")!.immersive?.mapOverlay, { baseOffsetMetres: 44.25 });
});

test("the approved model is served from the production model CDN, never the dev CDN or the repository", () => {
  assert.match(PROD_PUBLIC_MODEL_ORIGIN, /^https:\/\/[a-z0-9]+\.cloudfront\.net$/);
  assert.notEqual(PROD_PUBLIC_MODEL_ORIGIN, MEDIA_CDN_ORIGIN);
  assert.notEqual(PROD_PUBLIC_MODEL_ORIGIN, "https://d1l4p1pty829ds.cloudfront.net");
  const cfg = projectViewerConfig(getProject("reef-998-dlrc")!, "production");
  assert.ok(cfg, "998 has a viewer in production");
  assert.equal(cfg.source.kind, "model");
  assert.ok(cfg.source.url.endsWith("/m/0448dc15c26a47c585c33d51/589b15693f0a2ef6/scene.glb"));
  assert.equal(cfg.xr, null, "no AR/VR for a reconstruction");
  assert.equal(cfg.provenance?.label !== undefined, true, "labelled as a reconstruction");
});

test("model-specific lighting is carried from the reviewed reconstruction", () => {
  const reef998 = getProject("reef-998-dlrc")!;
  const live = projectViewerConfig(reef998, "production");
  assert.ok(live);
  assert.deepEqual(live.lighting, reef998.immersive!.lighting);
  const raking = { keyPitchDeg: 35, keyYawDeg: 70, intensity: 1.5, ambient: 0.3, shadows: true };
  const lit = projectViewerConfig({ ...reef998, immersive: { ...reef998.immersive!, lighting: raking } }, "production");
  assert.deepEqual(lit?.lighting, raking);
});
