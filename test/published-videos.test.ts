/**
 * What a PUBLISHED film is allowed to become on a property page.
 *
 * Everything this mapping returns becomes a URL served to anonymous visitors.
 * So a film that is withheld, belongs to another project, is not a video, is
 * an engineering test, or whose key does not belong to it must produce nothing
 * — and what it does produce must not carry anything private.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { publishedVideosQuery, toPublishedVideo } from "../src/lib/viewer/published-videos.ts";

const SLUG = "reef-998-dlrc";
const ID = "b4ade2c8f32c5d3daf9181298b689582";
const HASH = "854857f8c38953ec";
const CDN = "https://d1l4p1pty829ds.cloudfront.net";

/** Shaped as the worker leaves a real published film. */
const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  status: "PUBLISHED",
  kind: "VIDEO",
  format: "MP4",
  subjectType: "PROJECT",
  projectSlug: SLUG,
  storageKey: `m/${ID}/${HASH}`,
  entryFile: "film.mp4",
  sizeBytes: 2_538_354,
  posterKey: null,
  dimensions: { entry: { width: 480, height: 848 }, poster: null },
  metrics: { durationSeconds: 21, codec: "avc1", orientation: "portrait" },
  altText: "REEF 998: the developer's film of the tower and its amenities.",
  provenance: "DEVELOPER_RENDER",
  visibility: "PUBLIC",
  ...over,
});

test("a public, published film of this project resolves to a playable URL", () => {
  const v = toPublishedVideo(row(), SLUG, CDN);
  assert.ok(v);
  assert.equal(v.url, `${CDN}/m/${ID}/${HASH}/film.mp4`);
  assert.equal(v.mimeType, "video/mp4");
  assert.equal(v.width, 480);
  assert.equal(v.height, 848);
  assert.equal(v.durationSeconds, 21);
  assert.equal(v.provenanceLabel, "Developer render");
});

test("what reaches the page carries nothing private", () => {
  const v = toPublishedVideo(row(), SLUG, CDN) as unknown as Record<string, unknown>;
  for (const key of ["storageKey", "sourceKey", "visibility", "provenance", "contentHash", "sourceChecksumSha256", "projectSlug"]) {
    assert.equal(key in v, false, `${key} must not be exposed`);
  }
});

test("an INTERNAL film is invisible to the public resolver, and the query excludes it too", () => {
  assert.equal(toPublishedVideo(row({ visibility: "INTERNAL" }), SLUG, CDN), null);
  assert.equal(publishedVideosQuery(SLUG).where.visibility, "PUBLIC");
});

test("authorised preview may see an INTERNAL film, and only that is relaxed", () => {
  const v = toPublishedVideo(row({ visibility: "INTERNAL" }), SLUG, CDN, { includeInternal: true });
  assert.ok(v);
  assert.equal("visibility" in publishedVideosQuery(SLUG, { includeInternal: true }).where, false);
  // The provenance floor holds even in preview.
  assert.equal(toPublishedVideo(row({ visibility: "INTERNAL", provenance: "INTERNAL_TEST" }), SLUG, CDN, { includeInternal: true }), null);
  assert.deepEqual(publishedVideosQuery(SLUG, { includeInternal: true }).where.provenance, { not: "INTERNAL_TEST" });
});

test("an engineering test clip never resolves, even if marked public", () => {
  assert.equal(toPublishedVideo(row({ provenance: "INTERNAL_TEST" }), SLUG, CDN), null);
});

test("another project's film, another kind, or an unpublished row resolves to nothing", () => {
  assert.equal(toPublishedVideo(row({ projectSlug: "reef-997-dubai-islands" }), SLUG, CDN), null);
  assert.equal(toPublishedVideo(row({ kind: "MODEL" }), SLUG, CDN), null);
  assert.equal(toPublishedVideo(row({ format: "GLB" }), SLUG, CDN), null);
  for (const status of ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "REJECTED", "FAILED", "ARCHIVED"]) {
    assert.equal(toPublishedVideo(row({ status }), SLUG, CDN), null, status);
  }
  assert.equal(toPublishedVideo(null, SLUG, CDN), null);
});

test("a key that does not belong to the asset is refused", () => {
  // Another asset's directory: serving it would publish a film nobody approved here.
  assert.equal(toPublishedVideo(row({ storageKey: `m/ffffffffffffffffffffffffffffffff/${HASH}` }), SLUG, CDN), null);
  assert.equal(toPublishedVideo(row({ storageKey: "../../etc" }), SLUG, CDN), null);
  // A file whose extension is not served as video/mp4.
  assert.equal(toPublishedVideo(row({ entryFile: "film.mov" }), SLUG, CDN), null);
});

test("a row without alt text or without frame dimensions is broken, not shown", () => {
  assert.equal(toPublishedVideo(row({ altText: "  " }), SLUG, CDN), null);
  assert.equal(toPublishedVideo(row({ dimensions: { entry: null } }), SLUG, CDN), null);
});

test("a poster is optional, and a poster that breaks the contract is dropped, not fatal", () => {
  assert.equal(toPublishedVideo(row(), SLUG, CDN)?.posterUrl, null);
  const withPoster = toPublishedVideo(
    row({ posterKey: `m/${ID}/${HASH}/poster.webp`, dimensions: { entry: { width: 480, height: 848 }, poster: { width: 720, height: 1280 } } }),
    SLUG,
    CDN,
  );
  assert.equal(withPoster?.posterUrl, `${CDN}/m/${ID}/${HASH}/poster.webp`);
  // Outside the asset's own directory: dropped, film still plays.
  const foreign = toPublishedVideo(
    row({ posterKey: "m/ffffffffffffffffffffffffffffffff/854857f8c38953ec/poster.webp", dimensions: { entry: { width: 480, height: 848 }, poster: { width: 720, height: 1280 } } }),
    SLUG,
    CDN,
  );
  assert.ok(foreign);
  assert.equal(foreign.posterUrl, null);
});

test("site footage is labelled as site footage, with the note that it is not the finished building", () => {
  const v = toPublishedVideo(row({ provenance: "SITE_FOOTAGE" }), SLUG, CDN);
  assert.equal(v?.provenanceLabel, "Site footage");
  assert.match(v?.provenanceNote ?? "", /not as it will be completed/);
});

test("nothing about a film is ever called 360", () => {
  for (const provenance of ["DEVELOPER_RENDER", "SITE_FOOTAGE"]) {
    const v = toPublishedVideo(row({ provenance }), SLUG, CDN);
    assert.doesNotMatch(`${v?.provenanceLabel} ${v?.provenanceNote}`, /360|spherical|panoram/i);
  }
});
