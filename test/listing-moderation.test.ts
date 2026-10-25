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
  assert.match(adminRoute, /const admin = await requireAdmin\(\)\n\s*if \(!admin\.ok\) return admin\.response/);
});

test("every admin API checks the role in the database, not the token", async () => {
  const guard = await readFile(new URL("../src/lib/admin-guard.ts", import.meta.url), "utf8");
  assert.match(guard, /prisma\.user\.findUnique\(\{ where: \{ id: userId \}, select: \{ role: true \} \}\)/);
  assert.match(guard, /if \(user\?\.role !== "ADMIN"\)/);
  for (const route of ["properties/route.ts", "properties/[id]/route.ts", "users/route.ts", "users/[id]/route.ts", "stats/route.ts"]) {
    const src = await readFile(new URL(`../src/app/api/admin/${route}`, import.meta.url), "utf8");
    const handlers = src.match(/export async function (GET|POST|PATCH|DELETE)/g) ?? [];
    const guarded = src.match(/const admin = await requireAdmin\(\)\n\s*if \(!admin\.ok\) return admin\.response/g) ?? [];
    assert.ok(handlers.length > 0, route);
    assert.equal(guarded.length, handlers.length, `${route}: every handler is guarded`);
    assert.doesNotMatch(src, /session\.user as any\)\.role/, `${route}: no token-role check`);
  }
});

test("an admin cannot remove their own admin role", async () => {
  const src = await readFile(new URL("../src/app/api/admin/users/[id]/route.ts", import.meta.url), "utf8");
  assert.match(src, /if \(id === admin\.userId && parsed\.data\.role && parsed\.data\.role !== "ADMIN"\)/);
});

test("favourites cannot reach a non-public listing or its owner's private fields", async () => {
  const svc = await readFile(new URL("../src/lib/services/property.service.ts", import.meta.url), "utf8");
  assert.match(svc, /where: \{ userId, property: publicListingWhere\(\) \}/);
  assert.match(svc, /include: \{ property: \{ select: PUBLIC_PROPERTY_SELECT \} \}/);
  assert.match(svc, /if \(!listing \|\| !isPubliclyVisible\(listing\)\) return null;\n\s*await prisma\.favorite\.create/);
});

test("signed-in checks require a user id, not just a session object", async () => {
  const proxy = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert.match(proxy, /const isLoggedIn = !!req\.auth\?\.user\?\.id/);
  for (const page of ["admin/page.tsx", "dashboard/page.tsx", "properties/create/page.tsx", "properties/edit/[id]/page.tsx"]) {
    const src = await readFile(new URL(`../src/app/${page}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /if \(!session\) redirect/, page);
  }
});
