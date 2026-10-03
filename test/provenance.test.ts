/**
 * What provenance permits.
 *
 * The rule that matters most is the boring one: anything that has not stated
 * what it is stays private. A 952-byte cube uploaded to prove the pipeline was
 * being served on a project page as that project's architecture, and no amount
 * of captioning fixes a control that says "Explore in 3D".
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MEDIA_PROVENANCE,
  PROVENANCE_BY_KIND,
  PROVENANCE_LABEL,
  isMediaProvenance,
  isPubliclyShowable,
  provenanceAllowedFor,
} from "../src/lib/media/provenance.ts";

test("internal test material is the only provenance kept out of public view", () => {
  assert.equal(isPubliclyShowable("INTERNAL_TEST"), false);
  for (const p of MEDIA_PROVENANCE.filter((x) => x !== "INTERNAL_TEST")) {
    assert.equal(isPubliclyShowable(p), true, p);
  }
});

test("anything unstated or unrecognised is treated as private", () => {
  // A row this build cannot interpret is not evidence that publishing is safe.
  for (const value of [undefined, null, "", "internal_test", "REAL", 1, {}, []]) {
    assert.equal(isPubliclyShowable(value), false, JSON.stringify(value));
  }
});

test("provenance values are recognised exactly, case included", () => {
  assert.equal(isMediaProvenance("OFFICIAL_MODEL"), true);
  assert.equal(isMediaProvenance("Official_Model"), false);
  assert.equal(isMediaProvenance("DEVELOPER_RENDERS"), false);
});

test("a kind cannot claim a provenance it could not have", () => {
  // A GLB is not a photograph and a panorama is not an official building model.
  assert.equal(provenanceAllowedFor("MODEL", "PHOTO_360"), false);
  assert.equal(provenanceAllowedFor("MODEL", "SHOW_APARTMENT_PHOTO"), false);
  assert.equal(provenanceAllowedFor("PANORAMA", "OFFICIAL_MODEL"), false);
  assert.equal(provenanceAllowedFor("SPLAT", "DEVELOPER_RENDER"), false);
  assert.equal(provenanceAllowedFor("MODEL", "OFFICIAL_MODEL"), true);
  assert.equal(provenanceAllowedFor("PANORAMA", "PHOTO_360"), true);
  assert.equal(provenanceAllowedFor("PANORAMA", "RENDERED_360"), true);
  assert.equal(provenanceAllowedFor("SPLAT", "AARVASA_RECONSTRUCTION"), true);
});

test("every kind can still carry a test asset, so QA never needs a false claim", () => {
  for (const kind of ["MODEL", "PANORAMA", "SPLAT"]) {
    assert.equal(provenanceAllowedFor(kind, "INTERNAL_TEST"), true, kind);
  }
});

test("an unknown kind grants nothing", () => {
  assert.equal(provenanceAllowedFor("VIDEO", "OFFICIAL_MODEL"), false);
  assert.equal(provenanceAllowedFor("", "INTERNAL_TEST"), false);
});

test("a rendered panorama is never labelled a photograph", () => {
  assert.match(PROVENANCE_LABEL.RENDERED_360, /rendered/i);
  assert.doesNotMatch(PROVENANCE_LABEL.RENDERED_360, /photograph/i);
  assert.match(PROVENANCE_LABEL.PHOTO_360, /photograph/i);
});

test("a reconstruction is never labelled an official model", () => {
  assert.doesNotMatch(PROVENANCE_LABEL.AARVASA_RECONSTRUCTION, /official/i);
  assert.match(PROVENANCE_LABEL.OFFICIAL_MODEL, /official/i);
});

test("every provenance has a label, and every kind list is a subset of them", () => {
  for (const p of MEDIA_PROVENANCE) {
    assert.ok(PROVENANCE_LABEL[p]?.length > 0, p);
  }
  for (const [kind, allowed] of Object.entries(PROVENANCE_BY_KIND)) {
    for (const p of allowed) assert.ok(MEDIA_PROVENANCE.includes(p), `${kind}: ${p}`);
  }
});
