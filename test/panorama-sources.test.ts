/**
 * Genuine 360° sources may reach a page only with recorded permission, and no
 * page may reference the partner-hosted tours in the meantime.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { PANORAMA_SOURCES, missingChapters, publishablePanoramaSources } from "../src/lib/panorama-sources.ts";

test("no 360° source is publishable until permission is granted and filed", () => {
  assert.deepEqual(publishablePanoramaSources(), [], "nothing is cleared today");
  const granted = { ...PANORAMA_SOURCES[0], rights: "GRANTED" as const };
  assert.deepEqual(publishablePanoramaSources([granted]), [], "GRANTED without a permission record is not enough");
  assert.equal(publishablePanoramaSources([{ ...granted, permissionRef: "email 2026-11-01" }]).length, 1);
});

test("every source is a labelled CG render for a real REEF project, and 999 has none", () => {
  const slugs = ["reef-996-dubai-production-city", "reef-997-dubai-islands", "reef-998-dlrc", "reef-1000-dlrc"];
  assert.deepEqual(PANORAMA_SOURCES.map((s) => s.projectSlug), slugs);
  for (const s of PANORAMA_SOURCES) assert.equal(s.kind, "CG_RENDER");
  assert.equal(PANORAMA_SOURCES.some((s) => s.projectSlug === "reef-999-al-furjan"), false);
  assert.ok(missingChapters("reef-999-al-furjan").length === 7, "999 lacks every chapter");
  assert.ok(missingChapters("reef-996-dubai-production-city").includes("BALCONY"));
});

test("no application file outside the register references the partner-hosted tours", async () => {
  const hits: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !p.endsWith("panorama-sources.ts")) {
        if ((await readFile(p, "utf8")).includes("reefchannelpartners")) hits.push(p);
      }
    }
  };
  await walk(new URL("../src", import.meta.url).pathname);
  assert.deepEqual(hits, []);
});
