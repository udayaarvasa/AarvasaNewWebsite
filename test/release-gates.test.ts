/**
 * Release gates for the 20 Oct 2026 launch: media surfaces stay off in
 * production until the media schema exists, and /api/diag is not public.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { mediaFeaturesEnabled, mediaFeaturesResponse } from "../src/lib/media-features.ts";
import { diagAccess } from "../src/lib/diag-access.ts";

test("media features are off in a production build unless explicitly switched on", () => {
  assert.equal(mediaFeaturesEnabled({ NODE_ENV: "production" }), false);
  assert.equal(mediaFeaturesEnabled({ NODE_ENV: "production", AARVASA_MEDIA_FEATURES: "" }), false);
  assert.equal(mediaFeaturesEnabled({ NODE_ENV: "production", AARVASA_MEDIA_FEATURES: "on" }), true);
  assert.equal(mediaFeaturesEnabled({ NODE_ENV: "production", AARVASA_MEDIA_FEATURES: " ON " }), true);
  // Anything that is not exactly "on" keeps production closed.
  assert.equal(mediaFeaturesEnabled({ NODE_ENV: "production", AARVASA_MEDIA_FEATURES: "yes" }), false);
});

test("media features stay on in development unless switched off", () => {
  assert.equal(mediaFeaturesEnabled({ NODE_ENV: "development" }), true);
  assert.equal(mediaFeaturesEnabled({ NODE_ENV: "development", AARVASA_MEDIA_FEATURES: "off" }), false);
});

test("a gated media API answers an intentional 404 with a fixed body, never a 500", async () => {
  const res = mediaFeaturesResponse({ NODE_ENV: "production" });
  assert.ok(res);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get("content-type"), "application/json");
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { error: "Not found" });
  assert.equal(mediaFeaturesResponse({ NODE_ENV: "production", AARVASA_MEDIA_FEATURES: "on" }), null);
});

test("/api/diag is closed in production without the diagnostic key", () => {
  assert.equal(diagAccess({ nodeEnv: "production", key: null, diagKey: undefined }), "none");
  // No key configured: nothing the caller sends can open it.
  assert.equal(diagAccess({ nodeEnv: "production", key: "", diagKey: undefined }), "none");
  assert.equal(diagAccess({ nodeEnv: "production", key: "guess", diagKey: "s3cret" }), "none");
  assert.equal(diagAccess({ nodeEnv: "production", key: "s3cret", diagKey: "s3cret" }), "detailed");
});

test("/api/diag keeps its summary in development", () => {
  assert.equal(diagAccess({ nodeEnv: "development", key: null, diagKey: undefined }), "summary");
});
