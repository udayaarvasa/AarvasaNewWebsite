/**
 * Developer media is shown and served only with a recorded permission.
 *
 * REEF imagery was restored on 30 Oct 2026 on the owner's confirmation
 * that REEF agreed, and 999 and 1000 added once all five were confirmed cleared.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;

async function files(dir: string, match: (p: string) => boolean): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p, match)));
    else if (match(p)) out.push(p);
  }
  return out;
}

test("REEF media in public/ belongs only to projects with a permission entry", async () => {
  const served = await files(join(root, "public"), (p) => /reef/i.test(p.slice(root.length)));
  const uncleared = served.filter((p) => !/public\/(images\/reef-(99[6789]|1000)\/|reef\/reef-996-)/.test(p));
  assert.deepEqual(uncleared, []);
});

test("REEF imagery is attached only with a recorded permission", async () => {
  const src = await readFile(join(root, "src/lib/projects.ts"), "utf8");
  assert.match(src, /needsImageryPermission\(p\) && !imageryCleared\(p\.slug\)\s*\?\s*\{ images: \[\] \}/);
  const block = src.match(/const IMAGERY_PERMISSION: Readonly<Record<string, string>> = \{([^}]*)\};/);
  assert.ok(block, "IMAGERY_PERMISSION exists");
  // Every entry, when one is added, must carry a non-empty filing reference.
  for (const [, ref] of block[1].matchAll(/:\s*"([^"]*)"/g)) assert.ok(ref.trim().length > 10, "a real permission reference");
});

test("permission entries cover the five REEF projects and carry a reference", async () => {
  const src = await readFile(join(root, "src/lib/projects.ts"), "utf8");
  const ref = src.match(/const REEF_IMAGERY_PERMISSION = "([^"]+)"/);
  assert.ok(ref && ref[1].trim().length > 10);
  const block = src.match(/const IMAGERY_PERMISSION: Readonly<Record<string, string>> = \{([^}]*)\};/);
  assert.deepEqual([...block![1].matchAll(/"([a-z0-9-]+)":/g)].map((m) => m[1]), [
    "reef-996-dubai-production-city", "reef-997-dubai-islands", "reef-998-dlrc", "reef-999-al-furjan", "reef-1000-dlrc",
  ]);
});

test("a missing price prints no rupee estimate", async () => {
  const { inrEstimate } = await import("../src/lib/currency.ts");
  assert.equal(inrEstimate(0, "AED"), null);
  assert.match(inrEstimate(100000, "AED") ?? "", /^≈ ₹/);
  assert.equal(inrEstimate(100000, "INR"), null);
});

test("price text on light surfaces uses the readable gold tone", async () => {
  for (const f of ["src/components/property/project-cards.tsx", "src/components/property/db-property-card.tsx", "src/app/projects/[slug]/page.tsx"]) {
    assert.doesNotMatch(await readFile(join(root, f), "utf8"), /font-semibold text-gold-pale/, f);
  }
});
