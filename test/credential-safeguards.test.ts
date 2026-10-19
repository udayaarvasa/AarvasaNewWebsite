/**
 * Known-exposed credentials are refused everywhere, and the seed can never
 * create demo accounts (including an ADMIN) against production.
 *
 * The exposed value itself is never written here. Where available, the last
 * test reads it from the published Git history at runtime and proves both
 * guards refuse it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import { COMPROMISED_PASSWORD_SHA256, isCompromisedPassword } from "../src/lib/compromised-passwords.ts";

const require = createRequire(import.meta.url);
const { seedPassword, looksLikeProductionDatabase, COMPROMISED_SHA256 } = require("../prisma/seed-guard.cjs");

const LOCAL = "postgresql://dev@localhost:5432/aarvasa";
const STRONG = "a-strong-local-seed-pass-2026";

test("the app and the seed refuse the same exposed fingerprints", () => {
  assert.deepEqual([...COMPROMISED_SHA256].sort(), [...COMPROMISED_PASSWORD_SHA256].sort());
  for (const h of COMPROMISED_PASSWORD_SHA256) assert.match(h, /^[0-9a-f]{64}$/);
});

test("an ordinary password is not flagged; empty input is not a match", () => {
  assert.equal(isCompromisedPassword("correct horse battery staple"), false);
  assert.equal(isCompromisedPassword(""), false);
  assert.equal(isCompromisedPassword(undefined), false);
});

test("the seed refuses production, by environment or by database host", () => {
  assert.throws(() => seedPassword({ NODE_ENV: "production", DATABASE_URL: LOCAL, SEED_PASSWORD: STRONG }), /production/);
  assert.throws(
    () => seedPassword({ DATABASE_URL: "postgresql://u@database-1.abc.us-east-1.rds.amazonaws.com:5432/postgres", SEED_PASSWORD: STRONG }),
    /not a local development database/,
  );
  assert.equal(looksLikeProductionDatabase("not a url"), true);
  assert.equal(looksLikeProductionDatabase("postgresql://u@127.0.0.1:15432/x"), false);
});

test("the seed has no default password and rejects weak ones", () => {
  assert.throws(() => seedPassword({ DATABASE_URL: LOCAL }), /SEED_PASSWORD/);
  assert.throws(() => seedPassword({ DATABASE_URL: LOCAL, SEED_PASSWORD: "short" }), /at least 16/);
  assert.equal(seedPassword({ DATABASE_URL: LOCAL, SEED_PASSWORD: STRONG }), STRONG);
});

test("the seed script carries no password literal any more", async () => {
  const { readFileSync } = await import("node:fs");
  const seed = readFileSync(new URL("../prisma/seed.js", import.meta.url), "utf8");
  assert.doesNotMatch(seed, /bcrypt\.hash\(\s*["']/);
  for (const m of seed.matchAll(/["']([^"']{6,})["']/g)) {
    const h = createHash("sha256").update(m[1]).digest("hex");
    assert.equal(COMPROMISED_PASSWORD_SHA256.has(h), false, "an exposed value is still in seed.js");
  }
});

test("the actually published password is refused by both guards (read from Git history at runtime)", (t) => {
  let published: string | undefined;
  try {
    const old = execFileSync("git", ["show", "43888d0:prisma/seed.js"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    published = old.match(/bcrypt\.hash\(\s*["']([^"']+)["']/)?.[1];
  } catch {
    // Not a full clone (e.g. a shallow CI checkout): nothing to read.
  }
  if (!published) return t.skip("published seed history not available in this checkout");
  assert.equal(isCompromisedPassword(published), true);
  // The exact published value is refused by the seed even when it is long enough.
  const env = { DATABASE_URL: LOCAL, SEED_PASSWORD: published };
  assert.throws(() => seedPassword(env), published.length < 16 ? /at least 16/ : /publicly exposed/);
});

test("Google sign-in always asks which account to use", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../src/auth.ts", import.meta.url), "utf8");
  // Without prompt=select_account Google reuses the browser's active account,
  // which signed a visitor into a colleague's Aarvasa account on a shared browser.
  assert.match(src, /Google\(\{[\s\S]*?authorization:\s*\{\s*params:\s*\{\s*prompt:\s*"select_account"\s*\}\s*\}/);
});

test("the auth proxy never runs on public pages, so no cached page can carry a session cookie", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8");
  const matcher = src.slice(src.indexOf("export const config"));
  // The old catch-all matcher put a signed-in visitor's refreshed session cookie
  // on statically cached pages, and CloudFront replayed it to everyone after them.
  assert.doesNotMatch(matcher, /\(\?!/, "no negative-lookahead catch-all matcher");
  for (const publicPath of ['"/"', '"/listings', '"/projects', '"/reef', '"/about', '"/login"', '"/signup"']) {
    assert.ok(!matcher.includes(publicPath), `${publicPath} must not be matched by the proxy`);
  }
  for (const privatePath of ['"/dashboard/:path*"', '"/admin/:path*"', '"/properties/create"']) {
    assert.ok(matcher.includes(privatePath), `${privatePath} must stay protected`);
  }
  assert.match(src, /Cache-Control", "private, no-store"/, "proxied responses are never shared-cacheable");
  assert.doesNotMatch(src, /return NextResponse\.(redirect|next)\(/, "every proxy response goes through privateResponse");
});

test("sessions issued before the current epoch are refused", async () => {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(new URL("../src/auth.ts", import.meta.url), "utf8");
  assert.match(src, /export const SESSION_EPOCH = \d+/);
  assert.match(src, /token\.epoch = SESSION_EPOCH/, "stamped at sign-in");
  assert.match(src, /if \(token\.epoch !== SESSION_EPOCH\) return null/, "checked on every request");
});

test("login and signup read the session server-side, so they are dynamic and never cached", async () => {
  const { readFile } = await import("node:fs/promises");
  for (const page of ["login", "signup"]) {
    const src = await readFile(new URL(`../src/app/(auth)/${page}/page.tsx`, import.meta.url), "utf8");
    assert.match(src, /if \(await auth\(\)\) redirect\("\/dashboard"\)/, page);
  }
});
