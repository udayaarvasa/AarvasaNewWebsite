import assert from "node:assert/strict";
import test from "node:test";
import { getAuthRedirect } from "../src/lib/auth-redirect.ts";

test("authentication resumes a protected listing destination", () => {
  assert.equal(getAuthRedirect("/properties/create"), "/properties/create");
  assert.equal(getAuthRedirect("/dashboard?tab=properties"), "/dashboard?tab=properties");
});

test("authentication falls back when a destination is missing, external, or an auth page", () => {
  for (const target of [
    undefined,
    ["/properties/create", "/dashboard"],
    "https://example.org/listing",
    "//example.org/listing",
    "/\\example.org",
    "/a/..//example.org",
    "/login?callbackUrl=/properties/create",
    "/signup/",
  ]) {
    assert.equal(getAuthRedirect(target), "/dashboard");
  }
});
