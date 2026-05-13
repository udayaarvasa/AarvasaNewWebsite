// ─── Property Filtering & Scoring Engine ─────────────────────────────────────
// Filters and scores Aarvasa proprietary database properties.

import { properties, formatCurrency, type Property } from "@/lib/properties";
import type { QueryParameters, MatchedProperty } from "./types";

/**
 * Filter and score properties from the Aarvasa dataset.
 * Returns the top N matches, scored and ranked.
 */
export function filterProperties(
  params: QueryParameters,
  maxResults: number = 4,
): MatchedProperty[] {
  return properties
    .map((p) => scoreProperty(p, params))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, maxResults);
}

function scoreProperty(property: Property, params: QueryParameters): MatchedProperty {
  let score = 0;
  const reasons: string[] = [];

  // Base quality score (0-30)
  score += Math.round(property.score * 0.3);

  // Budget fit (0-25)
  if (params.budget) {
    if (property.price <= params.budget) {
      const ratio = 1 - property.price / params.budget;
      score += 20 + Math.round(ratio * 5);
      reasons.push(`Within ${params.budgetLabel || "budget"}`);
    } else {
      const overRatio = (property.price - params.budget) / params.budget;
      score += Math.max(0, 15 - Math.round(overRatio * 20));
      if (overRatio < 0.15) reasons.push("Slightly above budget but worth considering");
    }
  } else {
    score += 12;
  }

  // Location fit (0-20)
  if (params.locations.length > 0) {
    const match = params.locations.some((l) =>
      property.location.toLowerCase().includes(l.toLowerCase()),
    );
    if (match) { score += 20; reasons.push(`Located in ${property.location}`); }
    else score += 4;
  } else {
    score += 10;
  }

  // Property type fit (0-15)
  if (params.propertyTypes.length > 0) {
    if (params.propertyTypes.includes(property.type)) {
      score += 15; reasons.push(`Matches ${property.type} preference`);
    } else score += 3;
  } else score += 8;

  // Risk fit (0-10)
  if (params.riskPreference) {
    if (property.risk === params.riskPreference) {
      score += 10; reasons.push(`${property.risk} risk — matches your profile`);
    } else score += 3;
  } else score += 5;

  // ROI threshold (0-10)
  if (params.minRoi) {
    if (property.roi >= params.minRoi) {
      score += 10; reasons.push(`ROI ${property.roi}% exceeds ${params.minRoi}% target`);
    } else score += Math.round((property.roi / params.minRoi) * 5);
  } else {
    score += Math.min(8, Math.round(property.roi * 0.4));
  }

  // Luxury preference bonus
  if (params.luxuryPreference === "luxury" && property.price >= 50_000_000) {
    score += 5; reasons.push("Premium luxury segment");
  } else if (params.luxuryPreference === "affordable" && property.price <= 25_000_000) {
    score += 5; reasons.push("Affordable entry point");
  }

  // Rental yield intent bonus
  if (params.rentalYieldIntent && property.roi >= 15) {
    score += 5; reasons.push("Strong rental yield potential");
  }

  if (reasons.length === 0) {
    reasons.push(`${property.roi}% projected ROI with ${property.risk.toLowerCase()} risk`);
  }

  return {
    id: property.id,
    title: property.title,
    price: property.price,
    priceFormatted: formatCurrency(property.price),
    location: property.location,
    roi: property.roi,
    type: property.type,
    risk: property.risk,
    growth: property.growth,
    beds: property.beds,
    baths: property.baths,
    sqft: property.sqft,
    score: property.score,
    summary: property.summary,
    tags: property.tags,
    matchScore: Math.min(99, score),
    matchReasons: reasons,
  };
}

/**
 * Format matched properties for prompt injection (legacy compat).
 */
export function formatPropertiesForPrompt(matched: MatchedProperty[]): string {
  if (matched.length === 0) return "No properties match in Aarvasa database.";
  return matched
    .map(
      (p, i) => `[Property ${i + 1}] ${p.title}
  • Location: ${p.location}
  • Price: ${p.priceFormatted}
  • Type: ${p.type}
  • ROI: ${p.roi}% | Risk: ${p.risk}
  • Growth: ${p.growth}
  • Score: ${p.score}/100 | Match: ${p.matchScore}/99
  • Size: ${p.sqft.toLocaleString()} sqft | ${p.beds} bed | ${p.baths} bath
  • Tags: ${p.tags.join(", ")}
  • Summary: ${p.summary}
  • Reasons: ${p.matchReasons.join("; ")}`,
    )
    .join("\n\n");
}
