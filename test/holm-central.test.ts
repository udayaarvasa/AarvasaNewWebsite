import assert from "node:assert/strict";
import test from "node:test";
import { holmCentral } from "../src/lib/holm-central.ts";
import { projectFacts } from "../src/lib/ai/project-facts.ts";
import { parseQuery } from "../src/lib/ai/query-parser.ts";
import { matchesProjectQuery } from "../src/lib/project-filter.ts";

test("HOLM Central inventory is dated, searchable and internally consistent", () => {
  assert.equal(holmCentral.availableUnits, holmCentral.unitTypes.reduce((total, unit) => total + (unit.available ?? 0), 0));
  assert.equal(holmCentral.fromPrice, Math.min(...holmCentral.unitTypes.map((unit) => unit.fromPrice)));
  assert.equal(matchesProjectQuery(holmCentral, { city: "Dubai", search: "holm central", propertyType: "STUDIO" }), true);
  const facts = projectFacts(holmCentral);
  assert.match(facts, /89 units released.*15 October 2026/);
  assert.match(facts, /311\.71 sq\.ft – 332\.39 sq\.ft net/);
  assert.match(facts, /down payment 10%; during construction 25%; final payment 65% on handover/);
});

test("the Advisor can prioritize HOLM Central when asked about it by name", () => {
  assert.deepEqual(
    parseQuery("Hi, what is HOLM Central's payment plan?", [holmCentral]).projectSlugs,
    [holmCentral.slug],
  );
});
