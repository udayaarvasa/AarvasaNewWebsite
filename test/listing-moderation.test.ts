/**
 * A lister cannot publish, verify or feature their own listing. Only an admin
 * changes a listing's standing (src/lib/listing-moderation.ts).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { listingEditData, newListingData, NEW_LISTING_MODERATION } from "../src/lib/listing-moderation.ts";
import { isPubliclyVisible } from "../src/lib/listing-visibility.ts";
import {
  adminListingReviewSchema,
  createPropertySchema,
  updatePropertySchema,
} from "../src/lib/validations/property.ts";

const listing = {
  title: "Three-bedroom flat near the lake",
  description: "A three-bedroom flat with two balconies, a short walk from the lake.",
  price: 9_500_000,
  location: "Shymala Hills",
  city: "Bhopal",
  state: "Madhya Pradesh",
  propertyType: "APARTMENT",
  area: 1450,
};

/** What a hostile request body would add to an otherwise valid listing. */
const escalation = { status: "ACTIVE", verified: true, featured: true };

test("the owner schemas strip status, verified and featured", () => {
  const created = createPropertySchema.parse({ ...listing, ...escalation });
  for (const key of Object.keys(escalation)) assert.equal(key in created, false, `create kept ${key}`);

  const updated = updatePropertySchema.parse({ title: "A new title for the flat", ...escalation });
  for (const key of Object.keys(escalation)) assert.equal(key in updated, false, `update kept ${key}`);
});

test("a new listing is PENDING, unverified and unfeatured whatever was sent", () => {
  // Even if a moderation field slipped past validation, the server's values win.
  const data = newListingData({ ...listing, ...escalation }, "owner-1");
  assert.equal(data.status, "PENDING");
  assert.equal(data.verified, false);
  assert.equal(data.featured, false);
  assert.equal(data.ownerId, "owner-1");
  assert.equal(data.title, listing.title);
  assert.deepEqual(NEW_LISTING_MODERATION, { status: "PENDING", verified: false, featured: false });
  assert.equal(isPubliclyVisible({ id: "new-listing", status: data.status }), false, "not public until approved");
});

test("an owner's edit returns the listing to review and cannot verify it", () => {
  for (const role of ["USER", "AGENT", "BUILDER"]) {
    const data = listingEditData({ title: "Rewritten after approval", ...escalation }, role);
    assert.equal(data.status, "PENDING", role);
    assert.equal(data.verified, false, role);
    assert.equal("featured" in data, false, `${role} cannot touch featured`);
  }
});

test("an admin's content edit keeps the listing's standing", () => {
  const data = listingEditData({ title: "Typo fixed by an admin", ...escalation }, "ADMIN");
  assert.deepEqual(data, { title: "Typo fixed by an admin" });
});

test("the admin review schema validates its fields and refuses an empty change", () => {
  assert.deepEqual(adminListingReviewSchema.parse({ status: "ACTIVE" }), { status: "ACTIVE" });
  assert.equal(adminListingReviewSchema.safeParse({ status: "PUBLISHED" }).success, false);
  assert.equal(adminListingReviewSchema.safeParse({ verified: "yes" }).success, false);
  assert.equal(adminListingReviewSchema.safeParse({}).success, false);
  assert.deepEqual(adminListingReviewSchema.parse({ verified: true, title: "ignored" }), { verified: true });
});

test("the service and routes use the moderation rule", async () => {
  const svc = await readFile(new URL("../src/lib/services/property.service.ts", import.meta.url), "utf8");
  assert.match(svc, /data: newListingData\(data, ownerId\)/);
  assert.match(svc, /data: listingEditData\(data, requesterRole\)/);
  assert.doesNotMatch(svc, /data: \{ \.\.\.data, ownerId \}/, "no raw spread of the request into a new listing");

  const ownerRoute = await readFile(new URL("../src/app/api/properties/[id]/route.ts", import.meta.url), "utf8");
  assert.match(ownerRoute, /updatePropertySchema\.safeParse/);

  const adminRoute = await readFile(new URL("../src/app/api/admin/properties/[id]/route.ts", import.meta.url), "utf8");
  assert.match(adminRoute, /adminListingReviewSchema\.safeParse/);
  assert.match(adminRoute, /role !== "ADMIN"/);
});
