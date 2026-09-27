/**
 * Regression tests for the public property catalogue's exposure contract.
 *
 * These exist because /api/properties and /api/properties/[id] are public and
 * unauthenticated: anything the query selects is harvestable at scale by an
 * anonymous caller paging the catalogue. A previous version selected the full
 * owner record and leaked every lister's email address, internal id and role.
 *
 * Run with: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PRIVILEGED_PROPERTY_FIELDS,
  PUBLIC_OWNER_SELECT,
  PUBLIC_PROPERTY_SELECT,
  toPublicProperty,
  toPublicRole,
} from "../src/lib/services/property-projection.ts";

test("public owner projection never selects an email address", () => {
  assert.ok(
    !("email" in PUBLIC_OWNER_SELECT),
    "PUBLIC_OWNER_SELECT must not select email: the catalogue is unauthenticated and paginated, so every selected field is harvestable",
  );
});

test("public owner projection never selects the internal user id", () => {
  assert.ok(
    !("id" in PUBLIC_OWNER_SELECT),
    "PUBLIC_OWNER_SELECT must not select the user id: it lets an anonymous caller correlate listings to accounts",
  );
});

test("public owner projection exposes only display fields", () => {
  assert.deepEqual(Object.keys(PUBLIC_OWNER_SELECT).sort(), ["image", "name", "role"]);
});

test("public property projection excludes every privileged field", () => {
  for (const field of PRIVILEGED_PROPERTY_FIELDS) {
    assert.ok(
      !(field in PUBLIC_PROPERTY_SELECT),
      `PUBLIC_PROPERTY_SELECT must not select "${field}"`,
    );
  }
});

test("public property projection embeds the public owner shape, not the full record", () => {
  const owner = (PUBLIC_PROPERTY_SELECT as Record<string, unknown>).owner as {
    select: Record<string, unknown>;
  };
  assert.ok(!("email" in owner.select), "nested owner select must not reach email");
  assert.ok(!("id" in owner.select), "nested owner select must not reach the user id");
});

test("public property projection still returns the facts the catalogue needs", () => {
  for (const field of ["id", "title", "price", "city", "images", "amenities", "bedrooms"]) {
    assert.ok(field in PUBLIC_PROPERTY_SELECT, `public listing must keep "${field}"`);
  }
});

test("ADMIN is never disclosed as a public listing capacity", () => {
  assert.equal(toPublicRole("ADMIN"), "OWNER");
});

test("genuine listing capacities are preserved", () => {
  assert.equal(toPublicRole("AGENT"), "AGENT");
  assert.equal(toPublicRole("BUILDER"), "BUILDER");
  assert.equal(toPublicRole("USER"), "USER");
});

test("toPublicProperty coarsens an admin owner on an outgoing record", () => {
  const out = toPublicProperty({ id: "p1", owner: { name: "A", role: "ADMIN" } });
  assert.equal(out.owner?.role, "OWNER");
});

test("toPublicProperty tolerates a record with no owner", () => {
  const out = toPublicProperty({ id: "p1", owner: null });
  assert.equal(out.owner, null);
});
