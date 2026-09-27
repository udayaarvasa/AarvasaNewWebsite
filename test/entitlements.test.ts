/**
 * The entitlement decision rule.
 *
 * This is the commercial boundary in one function: everything premium is
 * authorized here or nowhere. The tests are written as the rule's contract —
 * that only an explicitly ACTIVE, unexpired, unrevoked row naming the exact
 * capability may ever return allowed, and that every other state denies.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { decide, type EntitlementRow } from "../src/lib/entitlements/decide.ts";
import {
  ENTITLEMENT_CAPABILITIES,
  isCapability,
  sanitizeCapabilities,
} from "../src/lib/entitlements/capabilities.ts";

const NOW = new Date("2026-06-01T00:00:00Z");
const row = (o: Partial<EntitlementRow> = {}): EntitlementRow => ({
  id: "e1",
  planKey: "test",
  status: "ACTIVE",
  capabilities: ["CREATE_3D"],
  expiresAt: null,
  revokedAt: null,
  ...o,
});

/* ── Fail closed ───────────────────────────────────────────────────────── */

test("no entitlement at all denies", () => {
  const d = decide([], "CREATE_3D", NOW);
  assert.equal(d.allowed, false);
});

test("every non-ACTIVE status denies", () => {
  for (const status of ["INACTIVE", "EXPIRED", "SUSPENDED", "PENDING", "CANCELLED", ""]) {
    const d = decide([row({ status })], "CREATE_3D", NOW);
    assert.equal(d.allowed, false, `status "${status}" must not authorize`);
  }
});

test("a status this build has never heard of denies rather than defaults open", () => {
  const d = decide([row({ status: "SOME_FUTURE_STATUS" })], "CREATE_3D", NOW);
  assert.equal(d.allowed, false);
});

test("a revoked row denies even while still marked ACTIVE", () => {
  const d = decide(
    [row({ status: "ACTIVE", revokedAt: new Date("2026-05-01T00:00:00Z") })],
    "CREATE_3D",
    NOW,
  );
  assert.equal(d.allowed, false);
});

test("an ACTIVE row past its expiry denies — the date wins over the column", () => {
  const d = decide(
    [row({ status: "ACTIVE", expiresAt: new Date("2026-05-31T23:59:59Z") })],
    "CREATE_3D",
    NOW,
  );
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.reason, "EXPIRED");
});

test("expiry exactly at the current instant denies", () => {
  const d = decide([row({ expiresAt: NOW })], "CREATE_3D", NOW);
  assert.equal(d.allowed, false);
});

/* ── Capability granularity ────────────────────────────────────────────── */

test("holding one capability does not grant another", () => {
  const d = decide([row({ capabilities: ["CREATE_3D"] })], "CREATE_SPLAT", NOW);
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.reason, "CAPABILITY_NOT_INCLUDED");
});

test("an unrecognised capability name in the row grants nothing", () => {
  const d = decide([row({ capabilities: ["EVERYTHING", "*", "ADMIN"] })], "CREATE_3D", NOW);
  assert.equal(d.allowed, false);
});

/* ── The one path that allows ──────────────────────────────────────────── */

test("an ACTIVE, unexpired, unrevoked row naming the capability allows", () => {
  const d = decide([row()], "CREATE_3D", NOW);
  assert.equal(d.allowed, true);
  assert.equal(d.allowed === true && d.entitlementId, "e1");
});

test("a future expiry still allows", () => {
  const d = decide([row({ expiresAt: new Date("2026-12-31T00:00:00Z") })], "CREATE_3D", NOW);
  assert.equal(d.allowed, true);
});

test("one good row among several bad ones allows", () => {
  const d = decide(
    [
      row({ id: "bad1", status: "SUSPENDED" }),
      row({ id: "bad2", status: "ACTIVE", expiresAt: new Date("2020-01-01T00:00:00Z") }),
      row({ id: "good", status: "ACTIVE", capabilities: ["CREATE_3D"] }),
    ],
    "CREATE_3D",
    NOW,
  );
  assert.equal(d.allowed, true);
  assert.equal(d.allowed === true && d.entitlementId, "good");
});

test("several bad rows deny, reporting the closest miss", () => {
  const d = decide(
    [row({ status: "INACTIVE" }), row({ status: "ACTIVE", capabilities: ["CREATE_360"] })],
    "CREATE_3D",
    NOW,
  );
  assert.equal(d.allowed, false);
  assert.equal(d.allowed === false && d.reason, "CAPABILITY_NOT_INCLUDED");
});

/* ── Capability registry ───────────────────────────────────────────────── */

test("the capability registry covers the premium operations", () => {
  for (const c of ["CREATE_3D", "CREATE_SPLAT", "CREATE_360", "PROCESS_MEDIA", "PUBLISH_IMMERSIVE"]) {
    assert.ok(ENTITLEMENT_CAPABILITIES.includes(c as never), `${c} must be a known capability`);
  }
});

test("public discovery is not a gated capability", () => {
  for (const c of ["BROWSE", "SEARCH", "VIEW_PROPERTY", "COMPARE", "VIEW_PUBLISHED_MEDIA"]) {
    assert.ok(!isCapability(c), `${c} must not be gated — public discovery stays free`);
  }
});

test("sanitize drops anything not in the registry", () => {
  assert.deepEqual(sanitizeCapabilities(["CREATE_3D", "NOT_REAL", "*"]), ["CREATE_3D"]);
});

test("every capability required by a premium route is registered", () => {
  // Mirrors JOB_CAPABILITY in /api/studio/jobs and the publish route.
  for (const c of ["CREATE_3D", "CREATE_SPLAT", "CREATE_360", "PROCESS_MEDIA", "PUBLISH_IMMERSIVE"]) {
    assert.ok(isCapability(c));
  }
});
