/**
 * Developer media without recorded permission is neither shown nor served.
 *
 * Removing a file from the latest commit does not remove it from Git history;
 * these tests only guard what the next build publishes.
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

test("no REEF developer media is in public/, so none is served", async () => {
  const served = await files(join(root, "public"), (p) => /reef/i.test(p.slice(root.length)));
  assert.deepEqual(served, []);
});

test("no page or component references a REEF image path directly", async () => {
  const hits: string[] = [];
  for (const p of await files(join(root, "src"), (f) => /\.(ts|tsx)$/.test(f))) {
    // The curated libraries and the generated inventory: both reach a page only through projects.ts, which gates them.
    if (/(reef-99[678]-imagery|reef-projects)\.ts$/.test(p)) continue;
    const src = (await readFile(p, "utf8")).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    if (/["'`]\/(images\/reef-|reef\/)/.test(src)) hits.push(p.slice(root.length));
  }
  assert.deepEqual(hits, []);
});

test("REEF imagery is attached only with a recorded permission", async () => {
  const src = await readFile(join(root, "src/lib/projects.ts"), "utf8");
  assert.match(src, /needsImageryPermission\(p\) && !imageryCleared\(p\.slug\)\s*\?\s*\{ images: \[\] \}/);
  const block = src.match(/const IMAGERY_PERMISSION: Readonly<Record<string, string>> = \{([^}]*)\};/);
  assert.ok(block, "IMAGERY_PERMISSION exists");
  // Every entry, when one is added, must carry a non-empty filing reference.
  for (const [, ref] of block[1].matchAll(/:\s*"([^"]*)"/g)) assert.ok(ref.trim().length > 10, "a real permission reference");
});

test("stock imagery is captioned as stock and names no project", async () => {
  const src = await readFile(join(root, "src/lib/stock-imagery.ts"), "utf8");
  assert.match(src, /caption: `\$\{subject\} · Stock photograph`/);
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /REEF|Aaradhyam/);
});
