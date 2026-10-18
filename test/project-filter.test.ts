/**
 * The listings filters applied to developer projects: a search for "bhopal"
 * or a choice of "Plot" must narrow the projects, not leave all of them up.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { matchesProjectQuery } from "../src/lib/project-filter.ts";
import type { Project } from "../src/lib/project-types.ts";

const base = {
  developer: "Dev",
  country: "India",
  completion: null,
  totalUnits: null,
  buildingConfig: null,
  availableUnits: null,
  toPrice: 0,
  maxSqft: 0,
  rateNote: null,
  published: true,
  views: [],
  images: [],
  planImages: [],
  planLabels: [],
} as unknown as Project;

const reef = {
  ...base,
  slug: "reef-996",
  name: "REEF 996",
  developer: "REEF Luxury Developments",
  location: "Dubai Production City (IMPZ)",
  city: "Dubai",
  country: "UAE",
  currency: "AED",
  kind: "apartments",
  fromPrice: 679_467,
  minSqft: 452,
  ratePerSqft: null,
  unitTypes: [{ type: "1BR", label: "1 Bedroom", bedrooms: 1, available: 4, minSqft: 645, maxSqft: 672, fromPrice: 977_379 }],
} as unknown as Project;

const plots = {
  ...base,
  slug: "aaradhyam-pearl",
  name: "Aaradhyam Pearl",
  developer: "Aaradhyam",
  location: "Badwai Road",
  city: "Bhopal",
  currency: "INR",
  kind: "plots",
  fromPrice: 2_695_000,
  minSqft: 770,
  ratePerSqft: 3500,
  unitTypes: [],
} as unknown as Project;

test("search narrows by city, name, location or developer", () => {
  assert.equal(matchesProjectQuery(plots, { search: "bhopal" }), true);
  assert.equal(matchesProjectQuery(reef, { search: "bhopal" }), false);
  assert.equal(matchesProjectQuery(reef, { search: "REEF" }), true);
  assert.equal(matchesProjectQuery(reef, { search: "production city" }), true);
});

test("type separates plots from homes, and nothing listed is an office", () => {
  assert.equal(matchesProjectQuery(plots, { propertyType: "PLOT" }), true);
  assert.equal(matchesProjectQuery(reef, { propertyType: "PLOT" }), false);
  assert.equal(matchesProjectQuery(reef, { propertyType: "APARTMENT" }), true);
  assert.equal(matchesProjectQuery(reef, { propertyType: "OFFICE" }), false);
});

test("price bounds compare in rupees, converting AED", () => {
  // 679,467 AED ≈ ₹1.64 Cr
  assert.equal(matchesProjectQuery(reef, { maxPrice: "10000000" }), false);
  assert.equal(matchesProjectQuery(reef, { maxPrice: "20000000" }), true);
  assert.equal(matchesProjectQuery(plots, { minPrice: "5000000" }), false);
});

test("bedrooms require a configuration with at least that many", () => {
  assert.equal(matchesProjectQuery(reef, { bedrooms: "1" }), true);
  assert.equal(matchesProjectQuery(reef, { bedrooms: "2" }), false);
  assert.equal(matchesProjectQuery(plots, { bedrooms: "1" }), false);
});

test("no query keeps everything", () => {
  assert.equal(matchesProjectQuery(reef, {}), true);
  assert.equal(matchesProjectQuery(plots, {}), true);
});
