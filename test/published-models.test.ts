/**
 * What a PUBLISHED model row is allowed to become on a public project page.
 *
 * Everything this mapping returns is turned into a CDN URL and served to
 * anonymous visitors, so the query's promises are checked again on the way out.
 * These cases pin that down: a row that is not published, not this project's,
 * not a GLB, or whose key does not belong to it must produce nothing at all —
 * returning the row anyway would publish an unreviewed or someone else's asset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { publishedModelQuery, toPublishedModel } from "../src/lib/viewer/published-models.ts";

const SLUG = "reef-997-dubai-islands";
const ID = "b4ade2c8f32c5d3daf9181298b689582";
const HASH = "854857f8c38953ec";

/** A row shaped exactly as the approve step leaves a real published model. */
const row = (over: Record<string, unknown> = {}) => ({
  id: ID,
  status: "PUBLISHED",
  kind: "MODEL",
  format: "GLB",
  subjectType: "PROJECT",
  projectSlug: SLUG,
  storageKey: `m/${ID}/${HASH}`,
  entryFile: "scene.glb",
  contentHash: "52063935ded425f14f7fe8fd4fefe92b597fbaba1c707be4736450c93b6ff3be",
  sizeBytes: 952,
  posterKey: null,
  dimensions: { entry: null, poster: null },
  altText: "A grey cube test model.",
  processorVersion: "1.0.0/passthrough-v1",
  ...over,
});

test("a published model of this project maps to approved media", () => {
  const media = toPublishedModel(row(), SLUG);
  assert.ok(media);
  assert.equal(media.mediaId, ID);
  assert.equal(media.storageKey, `m/${ID}/${HASH}`);
  assert.equal(media.entryFile, "scene.glb");
  assert.equal(media.sizeBytes, 952);
  // Reaching PUBLISHED means a reviewer approved it, so it is never a placeholder.
  assert.equal(media.review, "approved");
  assert.equal(media.poster, null);
});

test("AR and VR are not offered, because nothing measures the model's scale", () => {
  assert.equal(toPublishedModel(row(), SLUG)?.xr, undefined);
});

test("only PUBLISHED is shown", () => {
  for (const status of ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "REJECTED", "FAILED", "ARCHIVED"]) {
    assert.equal(toPublishedModel(row({ status }), SLUG), null, status);
  }
});

test("another project's asset is never shown on this project", () => {
  assert.equal(toPublishedModel(row(), "reef-998-dlrc"), null);
  assert.equal(toPublishedModel(row({ projectSlug: "reef-998-dlrc" }), SLUG), null);
});

test("only a PROJECT-subject GLB model qualifies", () => {
  assert.equal(toPublishedModel(row({ kind: "PANORAMA" }), SLUG), null);
  assert.equal(toPublishedModel(row({ format: "EQUIRECT_JPEG" }), SLUG), null);
  assert.equal(toPublishedModel(row({ subjectType: "PROPERTY" }), SLUG), null);
});

test("a key that does not belong to this asset is refused", () => {
  // The version directory must be the asset's own id, so one row can never
  // point the viewer at another asset's objects.
  assert.equal(toPublishedModel(row({ storageKey: `m/0123456789abcdef01234567/${HASH}` }), SLUG), null);
  assert.equal(toPublishedModel(row({ storageKey: `review/${ID}/${HASH}` }), SLUG), null);
  assert.equal(toPublishedModel(row({ storageKey: `uploads/${ID}/${HASH}` }), SLUG), null);
  assert.equal(toPublishedModel(row({ entryFile: "../../etc/passwd" }), SLUG), null);
  // Right prefix, wrong kind of object.
  assert.equal(toPublishedModel(row({ entryFile: "scene.ply" }), SLUG), null);
});

test("a model with no alt text is not rendered", () => {
  assert.equal(toPublishedModel(row({ altText: null }), SLUG), null);
  assert.equal(toPublishedModel(row({ altText: "   " }), SLUG), null);
});

test("a nonsense size is refused rather than displayed", () => {
  for (const sizeBytes of [0, -1, 1.5, null, "952"]) {
    assert.equal(toPublishedModel(row({ sizeBytes }), SLUG), null, String(sizeBytes));
  }
});

test("a poster is used only when its key and dimensions both hold up", () => {
  const good = toPublishedModel(
    row({
      posterKey: `m/${ID}/${HASH}/poster.webp`,
      dimensions: { entry: null, poster: { width: 1280, height: 720 } },
    }),
    SLUG,
  );
  assert.deepEqual(good?.poster, { key: `m/${ID}/${HASH}/poster.webp`, width: 1280, height: 720 });

  // A poster outside the asset's own version directory is dropped, not followed.
  const foreign = toPublishedModel(
    row({
      posterKey: `m/0123456789abcdef01234567/${HASH}/poster.webp`,
      dimensions: { entry: null, poster: { width: 1280, height: 720 } },
    }),
    SLUG,
  );
  assert.equal(foreign?.poster, null);

  // Dimensions missing: the model still shows, without a poster.
  const sizeless = toPublishedModel(row({ posterKey: `m/${ID}/${HASH}/poster.webp` }), SLUG);
  assert.ok(sizeless);
  assert.equal(sizeless.poster, null);
});

test("nothing at all maps to nothing", () => {
  assert.equal(toPublishedModel(null, SLUG), null);
  assert.equal(toPublishedModel(undefined, SLUG), null);
});

test("the query itself constrains status, kind and subject", () => {
  const q = publishedModelQuery(SLUG);
  assert.deepEqual(q.where, {
    status: "PUBLISHED",
    kind: "MODEL",
    subjectType: "PROJECT",
    projectSlug: SLUG,
  });
  assert.equal(q.take, 1);
  // Private columns must never be selected into a page's props.
  for (const column of ["sourceKey", "sourceChecksumSha256", "uploadedById", "reviewedById", "processingError"]) {
    assert.ok(!(column in q.select), `${column} must not be selected`);
  }
});
