// ─── Source Aggregator ────────────────────────────────────────────────────────
// Combines Aarvasa DB + external API results, deduplicates, and ranks.

import type {
  QueryParameters, NormalizedProperty, AggregatedResult,
  SourceSummary, MatchedProperty, DataSource,
} from "./types";
import { filterProperties, formatPropertiesForPrompt } from "./property-filter";
import { fetchExternalData, getMarketIntelligence } from "./external-sources";
import { apiCache, buildCacheKey } from "./cache";

/**
 * Convert Aarvasa MatchedProperty → NormalizedProperty
 */
function normalizeAarvasaProperty(p: MatchedProperty): NormalizedProperty {
  const city = p.location.split(",").pop()?.trim() || p.location;
  const locality = p.location.split(",")[0]?.trim() || "";

  return {
    id: `aarvasa:${p.id}`,
    title: p.title,
    city,
    locality,
    price: p.price,
    priceFormatted: p.priceFormatted,
    type: p.type,
    rentalYield: p.roi * 0.35,
    roi: p.roi,
    risk: p.risk,
    appreciationPotential: p.roi * 0.6,
    sqft: p.sqft,
    beds: p.beds,
    baths: p.baths,
    amenities: [],
    tags: [...p.tags, "Aarvasa Verified"],
    summary: p.summary,
    growth: p.growth,
    score: p.score,
    source: "aarvasa",
    sourceVerified: true,
    fetchedAt: new Date().toISOString(),
    relevanceScore: p.matchScore,
    matchReasons: p.matchReasons,
  };
}

/**
 * Deduplicate properties across sources. Aarvasa listings take priority.
 */
function deduplicateProperties(properties: NormalizedProperty[]): NormalizedProperty[] {
  const seen = new Map<string, NormalizedProperty>();

  for (const prop of properties) {
    // Create a fuzzy key for dedup (title + city normalized)
    const dedupKey = `${prop.title.toLowerCase().replace(/\s+/g, "")}:${prop.city.toLowerCase()}`;

    const existing = seen.get(dedupKey);
    if (!existing) {
      seen.set(dedupKey, prop);
    } else if (prop.source === "aarvasa" && existing.source !== "aarvasa") {
      seen.set(dedupKey, prop); // Aarvasa always wins
    } else if (prop.relevanceScore > existing.relevanceScore) {
      seen.set(dedupKey, prop);
    }
  }

  return Array.from(seen.values());
}

/**
 * Rank properties by composite score: relevance + source trust + data completeness.
 */
function rankProperties(properties: NormalizedProperty[]): NormalizedProperty[] {
  return properties
    .map((p) => {
      let boost = 0;

      // Source trust bonus
      if (p.source === "aarvasa") boost += 15;
      if (p.sourceVerified) boost += 5;

      // Data completeness bonus
      if (p.roi) boost += 3;
      if (p.rentalYield) boost += 2;
      if (p.risk) boost += 2;
      if (p.sqft) boost += 1;
      if (p.summary.length > 50) boost += 2;

      return { ...p, relevanceScore: Math.min(99, p.relevanceScore + boost) };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Main aggregation pipeline — combines all sources into a ranked result set.
 */
export async function aggregateSources(
  params: QueryParameters,
  maxResults: number = 5,
): Promise<AggregatedResult> {
  // Check cache
  const cacheKey = buildCacheKey("aggregated", {
    ...params,
    locations: params.locations.join(","),
    propertyTypes: params.propertyTypes.join(","),
  });
  const cached = apiCache.get<AggregatedResult>(cacheKey);
  if (cached) return cached;

  const sourceSummary: SourceSummary[] = [];

  // 1. Aarvasa proprietary database (always first)
  const aarvasaStart = Date.now();
  const aarvasaMatched = filterProperties(params, 6);
  const aarvasaNormalized = aarvasaMatched.map(normalizeAarvasaProperty);
  sourceSummary.push({
    source: "aarvasa",
    propertyCount: aarvasaNormalized.length,
    latencyMs: Date.now() - aarvasaStart,
    status: "success",
  });

  // 2. External sources (parallel, with fallback)
  let externalProperties: NormalizedProperty[] = [];
  const externalStart = Date.now();
  try {
    const externalResults = await fetchExternalData(params);
    for (const result of externalResults) {
      externalProperties.push(...result.properties);
      sourceSummary.push({
        source: result.source,
        propertyCount: result.properties.length,
        latencyMs: result.latencyMs,
        status: result.error ? "error" : "success",
        error: result.error,
      });
    }
  } catch {
    sourceSummary.push({
      source: "rapidapi",
      propertyCount: 0,
      latencyMs: Date.now() - externalStart,
      status: "error",
      error: "External fetch failed",
    });
  }

  // 3. Score external properties against query params
  for (const prop of externalProperties) {
    let score = 30; // base
    if (params.budget && prop.price <= params.budget) score += 15;
    if (params.locations.some((l) => prop.city.toLowerCase().includes(l.toLowerCase()))) score += 15;
    if (params.propertyTypes.includes(prop.type)) score += 10;
    prop.relevanceScore = Math.min(99, score);
    prop.matchReasons.push("External market listing");
  }

  // 4. Combine, deduplicate, rank
  const allProperties = [...aarvasaNormalized, ...externalProperties];
  const deduped = deduplicateProperties(allProperties);
  const ranked = rankProperties(deduped).slice(0, maxResults);

  // 5. Market intelligence
  const cities = params.locations.length > 0
    ? params.locations
    : [...new Set(ranked.map((p) => p.city))].slice(0, 3);
  const marketIntelligence = getMarketIntelligence(cities, []);

  const result: AggregatedResult = {
    properties: ranked,
    marketIntelligence,
    sourceSummary,
    totalCandidates: allProperties.length,
  };

  // Cache for 60s
  apiCache.set(cacheKey, result, 60);

  return result;
}

/**
 * Format aggregated properties + market intelligence for the AI prompt.
 */
export function formatAggregatedForPrompt(result: AggregatedResult): string {
  const parts: string[] = [];

  // Properties
  if (result.properties.length > 0) {
    parts.push("## Property Database — Matched Results");
    parts.push(
      result.properties
        .map(
          (p, i) =>
            `[Property ${i + 1}] ${p.title} [Source: ${p.source.toUpperCase()}${p.sourceVerified ? " ✓" : ""}]
  • Location: ${p.locality}, ${p.city}
  • Price: ${p.priceFormatted}
  • Type: ${p.type}
  • Projected ROI: ${p.roi ?? "N/A"}%
  • Rental Yield: ~${p.rentalYield?.toFixed(1) ?? "N/A"}%
  • Risk Profile: ${p.risk ?? "Unrated"}
  • Growth Signal: ${p.growth ?? "N/A"}
  • Aarvasa Score: ${p.score ?? "N/A"}/100
  • Relevance Score: ${p.relevanceScore}/99
  • Size: ${p.sqft?.toLocaleString() ?? "N/A"} sqft${p.beds ? ` | ${p.beds} bed` : ""}${p.baths ? ` | ${p.baths} bath` : ""}
  • Tags: ${p.tags.join(", ")}
  • Summary: ${p.summary}
  • Match Reasons: ${p.matchReasons.join("; ")}`,
        )
        .join("\n\n"),
    );
  } else {
    parts.push("No properties currently match the investor's criteria.");
  }

  // Market Intelligence
  if (result.marketIntelligence.length > 0) {
    parts.push("\n## Real-Time Market Intelligence");
    for (const intel of result.marketIntelligence) {
      parts.push(`\n### ${intel.city} Market Signals`);
      for (const insight of intel.insights) {
        parts.push(
          `- [${insight.category.toUpperCase()}] ${insight.title}: ${insight.description} (Impact: ${insight.impact}, Confidence: ${Math.round(insight.confidence * 100)}%)`,
        );
      }
    }
  }

  // Source summary
  parts.push(`\n## Data Sources: ${result.sourceSummary.map((s) => `${s.source}(${s.propertyCount})`).join(", ")} | Total candidates evaluated: ${result.totalCandidates}`);

  return parts.join("\n");
}
