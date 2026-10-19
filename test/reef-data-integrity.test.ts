/**
 * Data-integrity regression tests for the REEF material.
 *
 * The rule these defend: REAL DATA or NO DATA, never realistic-looking filler.
 *
 * These import the leaf modules directly — reef-projects and the imagery
 * modules import nothing but types, which erase at runtime, so they load under
 * plain node without the app's bundler resolution.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { reefProjects } from "../src/lib/reef-projects.ts";
import { reef1000, reef999 } from "../src/lib/reef-portfolio-additions.ts";
import { REEF_997_IMAGERY } from "../src/lib/reef-997-imagery.ts";
import { REEF_998_IMAGERY } from "../src/lib/reef-998-imagery.ts";

const FAMILY = ["996", "997", "998", "999", "1000"];

test("REEF 999 and 1000 are not in the generated inventory; their hand-authored records carry only published figures", () => {
  for (const n of ["999", "1000"]) {
    assert.equal(reefProjects.find((p) => p.name.includes(n)), undefined, `the 28 June inventory has no REEF ${n}`);
  }
  // Figures from the developer's own project pages (research/sources/reef-999-1000-register.md).
  assert.equal(reef999.totalUnits, 142);
  assert.equal(reef999.completion, "Q2 2027");
  assert.equal(reef999.fromPrice, 1_158_334);
  assert.equal(reef1000.totalUnits, 125);
  assert.equal(reef1000.completion, "Q4 2026");
  assert.equal(reef1000.fromPrice, 0, "the developer publishes no REEF 1000 price; none may be invented");
  for (const p of [reef999, reef1000]) {
    assert.equal(p.buildingConfig, null, `${p.name}: the developer states no floor count`);
    assert.ok(p.unitTypes.every((u) => u.fromPrice === 0), `${p.name}: no per-unit price is published`);
    assert.ok(p.unitTypes.every((u) => u.available === null), `${p.name}: no released-unit counts are published`);
    assert.deepEqual(p.images, [], `${p.name}: no imagery until reuse permission is recorded`);
    assert.equal(p.imagery, undefined);
    assert.deepEqual(p.paymentPlans, [], `${p.name}: no instalment schedule is published`);
  }
});

test("the towers that do have records carry the facts a listing needs", () => {
  assert.ok(reefProjects.length > 0);
  for (const p of reefProjects) {
    assert.ok(p.location, `${p.name} needs a location`);
    assert.ok(p.city, `${p.name} needs a city`);
    assert.ok(p.completion, `${p.name} needs a completion date`);
    assert.ok(p.fromPrice > 0, `${p.name} needs a real starting price`);
    assert.ok(p.unitTypes.length > 0, `${p.name} needs at least one unit type`);
  }
});

test("a UAE project is denominated in AED, never rupees", () => {
  for (const p of reefProjects.filter((x) => x.country === "UAE")) {
    assert.equal(p.currency, "AED", `${p.name} is in the UAE and must price in AED`);
  }
});

test("no REEF record uses stock photography as property imagery", () => {
  for (const p of reefProjects) {
    for (const src of p.images) {
      assert.ok(
        !/unsplash|pexels|shutterstock|istockphoto/i.test(src),
        `${p.name} must not stand a stock photo in for the building (${src})`,
      );
    }
  }
});

/* ── Provenance: an off-plan render must never read as a photograph ─────── */

/* REEF 996's imagery module re-exports a value from project-types, which infra
   also compiles, so it cannot carry the explicit .ts extension node's resolver
   needs. 997 and 998 exercise the same provenance contract. */
const everyImage = [
  REEF_997_IMAGERY.hero,
  ...REEF_997_IMAGERY.gallery,
  REEF_998_IMAGERY.hero,
  ...REEF_998_IMAGERY.gallery,
];

test("every curated frame states how it was produced", () => {
  for (const img of everyImage) {
    assert.ok(
      img.origin === "photo" || img.origin === "render",
      `${img.id} must state its origin`,
    );
  }
});

test("a render is never captioned as a photograph", () => {
  for (const img of everyImage.filter((i) => i.origin === "render")) {
    assert.ok(
      !/\bphotograph/i.test(img.caption),
      `${img.id} is a developer render and must not be captioned as a photograph`,
    );
  }
});

test("every curated frame carries a real alt description", () => {
  for (const img of everyImage) {
    assert.ok(img.alt.length > 20, `${img.id} needs a descriptive alt, got "${img.alt}"`);
  }
});

test("REEF 997 and 998 imagery lives under its own project directory", () => {
  for (const img of [REEF_997_IMAGERY.hero, ...REEF_997_IMAGERY.gallery]) {
    assert.ok(img.dir.startsWith("/images/reef-997/"), `${img.id} is filed under ${img.dir}`);
  }
  for (const img of [REEF_998_IMAGERY.hero, ...REEF_998_IMAGERY.gallery]) {
    assert.ok(img.dir.startsWith("/images/reef-998/"), `${img.id} is filed under ${img.dir}`);
  }
});

test("each curated frame declares at least one generated ratio", () => {
  for (const img of everyImage) {
    assert.ok(img.ratios.length > 0, `${img.id} declares no ratios`);
  }
});

test("the family is five towers, and each now has a record", () => {
  assert.equal(FAMILY.length, 5);
  const all = [...reefProjects, reef999, reef1000];
  const withRecords = FAMILY.filter((n) => all.some((p) => p.name === `REEF ${n}`));
  assert.deepEqual(withRecords, FAMILY);
});
