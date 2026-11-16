/**
 * The advisor answers from developer filings and nothing else.
 *
 * Two live failures these defend against:
 *  - Asked for REEF 996's payment plans, the advisor said none were published,
 *    because the plans never reached its prompt. The project page lists two.
 *  - Its answer format required a "Market Signals" section and its persona was
 *    an "investment advisor", so it wrote about tenant demand and capital
 *    liquidity: investment advice the platform says it will not give.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { reefProjects } from "../src/lib/reef-projects.ts";
import { projectFacts, DEVELOPER_INVENTORY_DATE } from "../src/lib/ai/project-facts.ts";
import { SYSTEM_IDENTITY, buildSystemPrompt, buildGreetingPrompt } from "../src/lib/ai/prompt-builder.ts";
import type { QueryParameters } from "../src/lib/ai/types.ts";

const reef996 = reefProjects.find((p) => p.slug === "reef-996-dubai-production-city");

const params = (over: Partial<QueryParameters> = {}): QueryParameters =>
  ({
    budget: null,
    budgetLabel: null,
    locations: [],
    propertyTypes: [],
    riskPreference: null,
    minRoi: null,
    luxuryPreference: null,
    rentalYieldIntent: false,
    intent: "search",
    ...over,
  }) as unknown as QueryParameters;

test("REEF 996's facts carry every published payment plan, in full", () => {
  assert.ok(reef996, "REEF 996 record must exist");
  const facts = projectFacts(reef996);
  assert.ok(reef996.paymentPlans.length >= 2);
  for (const plan of reef996.paymentPlans) {
    assert.ok(facts.includes(plan.name), `missing plan ${plan.name}`);
    assert.ok(facts.includes(`down payment ${plan.downPayment}`));
    assert.ok(facts.includes(`final payment ${plan.final}`));
  }
  assert.ok(!facts.includes("none published"), "must not claim plans are unpublished");
});

test("REEF 996's facts carry released units, their date, and each configuration", () => {
  assert.ok(reef996);
  const facts = projectFacts(reef996);
  assert.ok(facts.includes(`${reef996.availableUnits} units released`));
  assert.ok(facts.includes(DEVELOPER_INVENTORY_DATE));
  assert.ok(facts.includes("Completion: Q3 2028"));
  for (const u of reef996.unitTypes) {
    assert.ok(facts.includes(u.label), `missing configuration ${u.label}`);
    if (u.available !== null) assert.ok(facts.includes(`${u.available} available`));
  }
  assert.ok(facts.includes("AED 679,467"), "price stays in the developer's currency");
});

test("project facts contain no return, yield or risk figures", () => {
  for (const p of reefProjects) {
    const facts = projectFacts(p).toLowerCase();
    for (const word of ["roi", "yield", "appreciation", "risk", "%/yr", "per annum"]) {
      assert.ok(!facts.includes(word), `${p.name} facts mention "${word}"`);
    }
  }
});

test("a project with no published plan says so rather than inventing one", () => {
  const withoutPlans = reefProjects.find((p) => p.paymentPlans.length === 0);
  if (!withoutPlans) return;
  assert.match(projectFacts(withoutPlans), /Payment plans: none published on Aarvasa/);
});

test("the persona is not an investment advisor and demands no market-signal section", () => {
  const prompt = SYSTEM_IDENTITY.toLowerCase();
  assert.ok(!prompt.includes("investment advisor"));
  assert.ok(!prompt.includes("**market signals:**"));
  assert.ok(!prompt.includes("projected roi:"));
  assert.ok(!prompt.includes("rental yield forecasting"));
  // It must forbid the specific claims that reached users.
  for (const forbidden of ["rental yield", "tenant demand", "capital appreciation", "liquidity", "never give investment"]) {
    assert.ok(prompt.includes(forbidden), `the never-list should name "${forbidden}"`);
  }
  assert.match(SYSTEM_IDENTITY, /Source:/, "answers must name their source");
});

test("a returns question is flagged for refusal, not passed on as a target", () => {
  const prompt = buildSystemPrompt("records", params({ minRoi: 8, rentalYieldIntent: true }));
  assert.ok(!/Minimum ROI target/.test(prompt));
  assert.match(prompt, /Aarvasa publishes no such figures/);
});

test("the greeting does not offer investment reasoning or market signals", () => {
  const greeting = buildGreetingPrompt().split("The user just greeted you.")[1].toLowerCase();
  assert.ok(!greeting.includes("investment reasoning"));
  assert.ok(!greeting.includes("market signals"));
});
