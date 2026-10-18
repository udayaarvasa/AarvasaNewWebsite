import { createHash } from "node:crypto";

/**
 * Passwords known to be public, held only as SHA-256 fingerprints.
 *
 * The development password that prisma/seed.js carried until 19 Oct 2026 is in
 * the repository's public history and cannot be withdrawn from it, so the
 * application refuses it everywhere a password is set or used. Add to this list
 * (fingerprint only, never the value) whenever a credential is found exposed.
 */
export const COMPROMISED_PASSWORD_SHA256: ReadonlySet<string> = new Set([
  // prisma/seed.js demo-account password, published 2026 (commit 43888d0).
  "a109e36947ad56de1dca1cc49f0ef8ac9ad9a7b1aa0df41fb3c4cb73c1ff01ea",
]);

export function isCompromisedPassword(password: string | null | undefined): boolean {
  if (!password) return false;
  return COMPROMISED_PASSWORD_SHA256.has(createHash("sha256").update(password, "utf8").digest("hex"));
}

export const COMPROMISED_PASSWORD_MESSAGE =
  "This password has been exposed publicly and cannot be used. Please choose a different password.";
