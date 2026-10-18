/**
 * Preconditions for running prisma/seed.js.
 *
 * The seed creates demo accounts (including an ADMIN) and fictional demo
 * listings. It must never run against production, and it must never again use
 * a password written into the repository: the one it used until 19 Oct 2026 is
 * public in Git history for good.
 *
 *   SEED_PASSWORD   required; at least 16 characters; not a known-exposed value.
 *
 * Production administrators are not created by this script. See
 * docs/admin-bootstrap.md for the controlled process.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS script run directly by node
const { createHash } = require("node:crypto");

const COMPROMISED_SHA256 = new Set([
  "a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea",
]);
const MIN_LENGTH = 16;

function looksLikeProductionDatabase(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return !(host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost") || host.endsWith(".test"));
  } catch {
    return true; // unparseable: assume the worst
  }
}

/** Returns the password to seed with, or throws with the reason it may not run. */
function seedPassword(env = process.env) {
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV is production. The seed creates demo accounts and fictional listings.");
  }
  if (looksLikeProductionDatabase(env.DATABASE_URL)) {
    throw new Error("Refusing to seed: DATABASE_URL is not a local development database.");
  }
  const password = env.SEED_PASSWORD;
  if (!password) throw new Error("Set SEED_PASSWORD (16+ characters) to seed demo accounts. No default exists.");
  if (password.length < MIN_LENGTH) throw new Error(`SEED_PASSWORD must be at least ${MIN_LENGTH} characters.`);
  if (COMPROMISED_SHA256.has(createHash("sha256").update(password, "utf8").digest("hex"))) {
    throw new Error("SEED_PASSWORD is a publicly exposed credential and cannot be used.");
  }
  return password;
}

module.exports = { seedPassword, looksLikeProductionDatabase, COMPROMISED_SHA256 };
