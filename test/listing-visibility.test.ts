/**
 * Seed demo data and test records never reach a public surface, and the public
 * catalogue cannot be widened from the query string.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { HIDDEN_LISTINGS, HIDDEN_LISTING_IDS, isPubliclyVisible, publicListingWhere } from "../src/lib/listing-visibility.ts";

test("the seed demo listings and the ZK9TEST record are hidden", () => {
  const titles = Object.values(HIDDEN_LISTINGS).join(" | ");
  for (const t of ["Aarvasa Cliff Villas", "Skyline Residences 72", "Northstar Tech Park", "Kihim Waterfront Estate", "Sea Link Private Residences", "Hinjewadi Growth Homes", "ZK9TEST Marker Villa"]) {
    assert.ok(titles.includes(t), t);
  }
  assert.equal(HIDDEN_LISTING_IDS.length, 7);
});

test("public visibility needs ACTIVE status and a non-hidden id", () => {
  assert.equal(isPubliclyVisible({ id: "cmuel1f6k0002em0bjlfqdq6y", status: "ACTIVE" }), false);
  assert.equal(isPubliclyVisible({ id: "some-real-listing", status: "INACTIVE" }), false);
  assert.equal(isPubliclyVisible({ id: "some-real-listing", status: "ACTIVE" }), true);
  assert.deepEqual(publicListingWhere(), { status: "ACTIVE", id: { notIn: [...HIDDEN_LISTING_IDS] } });
});

test("every public listing path applies the rule", async () => {
  const svc = await readFile(new URL("../src/lib/services/property.service.ts", import.meta.url), "utf8");
  // The catalogue ignores a ?status= filter and always uses the public where-clause.
  assert.match(svc, /const where: any = \{ \.\.\.publicListingWhere\(\) \};/);
  assert.doesNotMatch(svc, /status = "ACTIVE",/, "status is no longer taken from the request");
  // A single listing is withheld from non-privileged viewers unless publicly visible.
  assert.match(svc, /if \(!privileged && !isPubliclyVisible\(\{ id, status: ownership\.status \}\)\) return null;/);
  // No inquiry about a hidden or inactive listing.
  assert.match(svc, /if \(!listing \|\| !isPubliclyVisible\(listing\)\) return null;/);
  const route = await readFile(new URL("../src/app/api/inquiries/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!inquiry\)/);
});

test("the seed script still cannot target production", async () => {
  const seed = await readFile(new URL("../prisma/seed.js", import.meta.url), "utf8");
  assert.match(seed, /seed-guard/);
});
