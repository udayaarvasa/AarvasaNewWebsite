// ─── Property Filtering & Scoring Engine ─────────────────────────────────────
// Scores Aarvasa's REAL represented inventory for the AI advisor.
//
// This deliberately reads from `@/lib/projects` (the verified developer
// projects) and NOT from the `@/lib/properties` sample array. The sample array
// describes properties that do not exist; recommending them to an investor who
// asked what we have would be fabrication, and it also made the advisor
// contradict the site — it answered "no listings in Bhopal" while two Bhopal
// projects were live.
//
// Metrics the developers have not published (ROI, risk grade, growth) are
// represented as unknown (0 / empty string) and omitted from the prompt rather
// than defaulted to a number, so the model is never handed an invented yield.

import { publishedProjects } from "@/lib/projects";
import type { Project } from "@/lib/project-types";
import { formatCurrency } from "@/lib/currency";
import type { QueryParameters, MatchedProperty } from "./types";

/** Map a project onto the advisor's candidate shape. */
function toCandidate(project: Project): MatchedProperty {
  const isPlots = project.kind === "plots";
  const hasAbsolutePrice = project.fromPrice > 0;

  const priceFormatted = hasAbsolutePrice
    ? `from ${formatCurrency(project.fromPrice, project.currency)}`
    : project.ratePerSqft
      ? `${formatCurrency(project.ratePerSqft, project.currency)} per sq.ft`
      : "price on request";

  const summaryParts = [
    `${project.name} by ${project.developer}, ${project.location}, ${project.city}.`,
  ];
  if (project.completion) summaryParts.push(`Completion ${project.completion}.`);
  if (isPlots && project.totalUnits) summaryParts.push(`${project.totalUnits} plots in the layout.`);
  if (project.unitTypes.length > 0) {
    summaryParts.push(
      `Configurations: ${project.unitTypes
        .map((u) => `${u.label} (${u.minSqft.toLocaleString()} sq.ft, from ${formatCurrency(u.fromPrice, project.currency)})`)
        .join("; ")}.`,
    );
  }
  if (project.rateNote) summaryParts.push(project.rateNote);

  return {
    id: project.slug,
    title: project.name,
    price: project.fromPrice,
    priceFormatted,
    location: `${project.location}, ${project.city}`,
    roi: 0, // unknown — developers have not published a yield figure
    type: isPlots ? "Land" : "Apartment",
    risk: "", // unknown
    growth: "", // unknown
    beds: project.unitTypes[0]?.bedrooms ?? 0,
    baths: 0,
    sqft: project.minSqft,
    score: 0, // unknown — no proprietary rating exists for these yet
    summary: summaryParts.join(" "),
    tags: [...project.approvals, ...project.usps].slice(0, 5),
    matchScore: 0,
    matchReasons: [],
  };
}

/**
 * Filter and score Aarvasa's represented projects.
 * Returns the top N matches, scored and ranked.
 */
export function filterProperties(
  params: QueryParameters,
  maxResults: number = 4,
): MatchedProperty[] {
  return publishedProjects()
    .map((project) => scoreProject(project, toCandidate(project), params))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults);
}

function scoreProject(
  project: Project,
  candidate: MatchedProperty,
  params: QueryParameters,
): MatchedProperty {
  let score = 40; // neutral base: every represented project is a genuine option
  const reasons: string[] = [];

  // Budget fit. Projects quoted only as a per-sq.ft rate have no absolute
  // entry price, so they are scored neutrally rather than treated as free.
  if (params.budget && candidate.price > 0) {
    if (candidate.price <= params.budget) {
      const ratio = 1 - candidate.price / params.budget;
      score += 20 + Math.round(ratio * 5);
      reasons.push(`Entry price within ${params.budgetLabel || "budget"}`);
    } else {
      const overRatio = (candidate.price - params.budget) / params.budget;
      score += Math.max(0, 15 - Math.round(overRatio * 20));
      if (overRatio < 0.15) reasons.push("Slightly above budget but worth considering");
    }
  } else {
    score += 10;
  }

  // Location fit — match against project, locality, city and country.
  if (params.locations.length > 0) {
    const haystack = [
      project.name,
      project.location,
      project.city,
      project.country,
    ]
      .join(" ")
      .toLowerCase();
    const hit = params.locations.find((l) => haystack.includes(l.toLowerCase()));
    if (hit) {
      score += 25;
      reasons.push(`Located in ${project.city}`);
    } else {
      score += 2;
    }
  } else {
    score += 10;
  }

  // Property type fit
  if (params.propertyTypes.length > 0) {
    if (params.propertyTypes.includes(candidate.type)) {
      score += 15;
      reasons.push(`Matches ${candidate.type} preference`);
    } else {
      score += 3;
    }
  } else {
    score += 8;
  }

  // Regulatory standing is a genuine, verifiable differentiator.
  if (project.approvals.length > 0) {
    score += 5;
    reasons.push(project.approvals[0]);
  }

  if (reasons.length === 0) {
    reasons.push(`Represented by Aarvasa in ${project.city}`);
  }

  return { ...candidate, matchScore: Math.min(99, score), matchReasons: reasons };
}

/**
 * Format matched projects for prompt injection.
 * Unknown metrics are omitted entirely — never emitted as "0%".
 */
export function formatPropertiesForPrompt(matched: MatchedProperty[]): string {
  if (matched.length === 0) {
    return "No properties in Aarvasa's represented inventory match this query.";
  }
  return matched
    .map((p, i) => {
      const lines = [
        `[Property ${i + 1}] ${p.title}`,
        `  • Location: ${p.location}`,
        `  • Price: ${p.priceFormatted}`,
        `  • Type: ${p.type}`,
      ];
      if (p.roi > 0) lines.push(`  • ROI: ${p.roi}%`);
      if (p.risk) lines.push(`  • Risk: ${p.risk}`);
      if (p.growth) lines.push(`  • Growth: ${p.growth}`);
      if (p.sqft > 0) lines.push(`  • Size from: ${p.sqft.toLocaleString()} sq.ft`);
      if (p.tags.length) lines.push(`  • Highlights: ${p.tags.join(", ")}`);
      lines.push(`  • Summary: ${p.summary}`);
      lines.push(`  • Match: ${p.matchScore}/99 — ${p.matchReasons.join("; ")}`);
      lines.push(
        `  • NOTE: no published ROI, risk grade or appreciation forecast exists for this project. Do not state or estimate one.`,
      );
      return lines.join("\n");
    })
    .join("\n\n");
}
