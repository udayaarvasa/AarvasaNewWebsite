/**
 * End-to-end check of listing moderation and admin authorization, against a
 * RUNNING production build and a THROWAWAY database. It creates accounts and
 * listings, so it refuses to run anywhere but localhost with a local database.
 *
 *   E2E_BASE_URL=http://localhost:3110 \
 *   E2E_DATABASE_URL=postgresql://user@127.0.0.1:55432/aarvasa_e2e \
 *   node test/e2e/listing-moderation.e2e.mjs
 *
 * The server must be started with the same DATABASE_URL. Not part of `npm test`
 * (which needs no server); the static and unit checks live in test/*.test.ts.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const BASE = process.env.E2E_BASE_URL ?? "";
const DB = process.env.E2E_DATABASE_URL ?? "";
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
if (!LOCAL.test(new URL(BASE).hostname)) throw new Error("E2E_BASE_URL must be localhost");
if (!LOCAL.test(new URL(DB).hostname)) throw new Error("E2E_DATABASE_URL must be a local database");

const sql = (q) => execFileSync("psql", [DB, "-qtAc", q], { encoding: "utf8" }).trim();
const run = randomBytes(4).toString("hex");
const password = () => `E2e-${randomBytes(12).toString("base64url")}`;
let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
};

async function api(path, { method = "GET", token, cookie, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, headers: res.headers };
}

async function register(label) {
  const email = `e2e-${label}-${run}@example.test`;
  const pw = password();
  const r = await api("/api/mobile/auth/register", { method: "POST", body: { name: `E2E ${label}`, email, password: pw } });
  assert.equal(r.status, 201, `register ${label}`);
  return { email, pw, id: r.json.user.id, token: r.json.accessToken };
}

/** Web sign-in through Auth.js credentials: returns the session cookie. */
async function webLogin({ email, pw }) {
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  const jar = csrf.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { csrfToken } = await csrf.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: jar },
    body: new URLSearchParams({ csrfToken, email, password: pw, callbackUrl: `${BASE}/dashboard` }),
  });
  const session = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("authjs.session-token="));
  assert.ok(session, `web sign-in for ${email}`);
  return session;
}

const listing = {
  title: `E2E moderation flat ${run}`,
  description: "A three-bedroom flat used only by the end-to-end moderation test.",
  price: 9500000, location: "Test Road", city: "Bhopal", state: "Madhya Pradesh",
  propertyType: "APARTMENT", area: 1450,
};
const publicTotal = async (q = "") => (await api(`/api/properties${q}`)).json.total;

console.log(`listing moderation e2e against ${BASE}`);
const owner = await register("owner");
const other = await register("other");
const admin = await register("admin");
sql(`update "User" set role = 'ADMIN' where id = '${admin.id}'`);
const adminCookie = await webLogin(admin);
const ownerCookie = await webLogin(owner);
let id;

await step("1-2 an ordinary user's listing is PENDING, unverified and unfeatured, whatever it asks for", async () => {
  const r = await api("/api/properties", { method: "POST", token: owner.token, body: { ...listing, status: "ACTIVE", verified: true, featured: true } });
  assert.equal(r.status, 201);
  id = r.json.data.id;
  assert.deepEqual([r.json.data.status, r.json.data.verified, r.json.data.featured], ["PENDING", false, false]);
  assert.deepEqual(sql(`select status || ',' || verified || ',' || featured from "Property" where id = '${id}'`), "PENDING,false,false");
});

await step("6 a pending listing is absent from the catalogue, status filters, search and direct URLs", async () => {
  assert.equal(await publicTotal(), 0);
  assert.equal(await publicTotal("?status=PENDING"), 0);
  assert.equal(await publicTotal(`?search=${encodeURIComponent(listing.title)}`), 0);
  assert.equal((await api(`/api/properties/${id}`)).status, 404);
  assert.equal((await api(`/api/properties/${id}`, { token: other.token })).status, 404);
  assert.equal((await api(`/property/${id}`)).status, 404);
  assert.equal((await api(`/api/properties/${id}`, { token: owner.token })).status, 200, "the owner still sees it");
});

await step("3-4 the owner cannot self-approve, verify or feature through the owner route", async () => {
  const r = await api(`/api/properties/${id}`, { method: "PATCH", token: owner.token, body: { status: "ACTIVE", verified: true, featured: true } });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.data.status, r.json.data.verified, r.json.data.featured], ["PENDING", false, false]);
});

await step("4 another user cannot edit the listing at all", async () => {
  assert.equal((await api(`/api/properties/${id}`, { method: "PATCH", token: other.token, body: { title: "Taken over by someone else" } })).status, 403);
});

await step("3 the owner cannot use the admin route, by token or by web session", async () => {
  assert.equal((await api(`/api/admin/properties/${id}`, { method: "PATCH", token: owner.token, body: { status: "ACTIVE" } })).status, 401);
  assert.equal((await api(`/api/admin/properties/${id}`, { method: "PATCH", cookie: ownerCookie, body: { status: "ACTIVE", verified: true } })).status, 403);
  assert.equal(sql(`select status from "Property" where id = '${id}'`), "PENDING");
});

await step("7 no enquiry or favourite on a pending listing", async () => {
  const inquiry = { name: "E2E", email: "visitor@example.test", message: "Is this flat still available?", propertyId: id };
  assert.equal((await api("/api/inquiries", { method: "POST", body: inquiry })).status, 404);
  assert.equal((await api("/api/favorites", { method: "POST", token: other.token, body: { propertyId: id } })).status, 404);
});

await step("5 an admin approves the listing and it becomes public", async () => {
  assert.equal((await api(`/api/admin/properties/${id}`, { method: "PATCH", cookie: adminCookie, body: { status: "PUBLISHED" } })).status, 400, "invalid status refused");
  assert.equal((await api(`/api/admin/properties/${id}`, { method: "PATCH", cookie: adminCookie, body: {} })).status, 400, "empty change refused");
  const r = await api(`/api/admin/properties/${id}`, { method: "PATCH", cookie: adminCookie, body: { status: "ACTIVE" } });
  assert.equal(r.status, 200);
  assert.equal(await publicTotal(), 1);
  const pub = await api(`/api/properties/${id}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.json.data.verified, false, "approval is not verification");
  assert.equal(pub.json.data.owner.email, undefined, "no owner email in the public projection");
  assert.equal((await api("/api/inquiries", { method: "POST", body: { name: "E2E", email: "visitor@example.test", message: "Is this flat still available?", propertyId: id } })).status, 201);
  assert.equal((await api("/api/favorites", { method: "POST", token: other.token, body: { propertyId: id } })).status, 200);
  const favs = await api("/api/favorites", { token: other.token });
  assert.equal(favs.json.data.length, 1);
  assert.equal(favs.json.data[0].owner.email, undefined, "no owner email in saved listings");
});

await step("3 an owner's edit after approval sends the listing back to review", async () => {
  const r = await api(`/api/properties/${id}`, { method: "PATCH", token: owner.token, body: { title: `E2E rewritten after approval ${run}` } });
  assert.equal(r.json.data.status, "PENDING");
  assert.equal(await publicTotal(), 0);
  assert.equal((await api(`/api/properties/${id}`)).status, 404);
  assert.equal((await api("/api/favorites", { token: other.token })).json.data.length, 0, "saved list drops it too");
});

await step("7 a hidden record stays hidden even when ACTIVE", async () => {
  const hidden = "cmuel1f6k0002em0bjlfqdq6y"; // ZK9TEST Marker Villa's id in listing-visibility.ts
  sql(`insert into "Property" (id, title, description, price, location, city, state, area, status, "ownerId", "updatedAt") values ('${hidden}', 'ZK9TEST e2e copy', 'Hidden record used by the e2e test only.', 1, 'x', 'x', 'x', 1, 'ACTIVE', '${owner.id}', now()) on conflict (id) do nothing`);
  assert.equal(await publicTotal(), 0);
  assert.equal((await api(`/api/properties/${hidden}`)).status, 404);
  assert.equal((await api("/api/inquiries", { method: "POST", body: { name: "E2E", email: "visitor@example.test", message: "Is this villa still available?", propertyId: hidden } })).status, 404);
});

await step("an admin cannot remove their own admin role", async () => {
  assert.equal((await api(`/api/admin/users/${admin.id}`, { method: "PATCH", cookie: adminCookie, body: { role: "USER" } })).status, 400);
});

await step("a demoted admin loses access at once, although their token still says ADMIN", async () => {
  sql(`update "User" set role = 'USER' where id = '${admin.id}'`);
  assert.equal((await api(`/api/admin/properties/${id}`, { method: "PATCH", cookie: adminCookie, body: { status: "ACTIVE" } })).status, 403);
  assert.equal((await api("/api/admin/users", { cookie: adminCookie })).status, 403);
});

await step("signed-out visitors are sent to sign-in; the ledger endpoints are gone", async () => {
  const page = await api("/admin");
  assert.ok([302, 307].includes(page.status));
  assert.match(page.headers.get("location") ?? "", /\/login/);
  assert.equal((await api("/api/admin/stats")).status, 401);
  assert.equal((await api("/api/blockchain/status")).status, 410);
  assert.equal((await api("/api/blockchain/transaction", { method: "POST", body: {} })).status, 410);
});

await step("a partial edit leaves every field it did not send untouched", async () => {
  const before = sql(`select bedrooms || ',' || bathrooms || ',' || array_length(amenities,1) || ',' || array_length(images,1) || ',' || country from "Property" where id = '${id}'`);
  sql(`update "Property" set bedrooms = 3, bathrooms = 2, amenities = '{Gym,Parking}', images = '{https://example.test/a.jpg}', country = 'UAE' where id = '${id}'`);
  const r = await api(`/api/properties/${id}`, { method: "PATCH", token: owner.token, body: { title: `E2E title-only edit ${run}` } });
  assert.equal(r.status, 200);
  assert.equal(sql(`select bedrooms || ',' || bathrooms || ',' || array_to_string(amenities,'|') || ',' || array_to_string(images,'|') || ',' || country from "Property" where id = '${id}'`),
    "3,2,Gym|Parking,https://example.test/a.jpg,UAE", `was ${before}`);
});

await step("owner transitions: withdraw, resubmit, sold — never approve; others and admins-by-token refused", async () => {
  sql(`update "User" set role = 'ADMIN' where id = '${admin.id}'`); // restored for this step
  const act = (action, who = owner) => api(`/api/properties/${id}/status`, { method: "POST", token: who.token, body: { action } });
  assert.equal(sql(`select status from "Property" where id = '${id}'`), "PENDING");
  assert.equal((await act("mark_sold")).status, 409, "cannot sell what is not live");
  assert.equal((await act("approve")).status, 400, "no approve action exists");
  assert.equal((await act("withdraw", other)).status, 403, "only the owner");
  assert.equal((await act("withdraw")).json.data.status, "INACTIVE");
  assert.equal((await act("resubmit")).json.data.status, "PENDING");
  assert.equal(await publicTotal(), 0, "resubmitting does not publish");
  // Admin rejects (INACTIVE), owner resubmits, admin approves, owner marks sold.
  assert.equal((await api(`/api/admin/properties/${id}`, { method: "PATCH", cookie: adminCookie, body: { status: "INACTIVE" } })).status, 200);
  assert.equal((await act("resubmit")).json.data.status, "PENDING");
  assert.equal((await api(`/api/admin/properties/${id}`, { method: "PATCH", cookie: adminCookie, body: { status: "ACTIVE" } })).status, 200);
  assert.equal(await publicTotal(), 1);
  assert.equal((await act("resubmit")).status, 409, "a live listing is not resubmitted");
  assert.equal((await act("mark_sold")).json.data.status, "SOLD");
  assert.equal(await publicTotal(), 0, "a sold listing leaves the catalogue");
  assert.equal((await api(`/api/properties/${id}`)).status, 404);
});

console.log(`${passed} steps passed`);
