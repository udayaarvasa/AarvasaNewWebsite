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
    /* Represented projects carry roi 0 ("not published"). Yield and
       appreciation used to be derived from it (roi × 0.35, roi × 0.6), which
       put "Rental Yield: ~0.0%" in front of the model. Unknown stays unknown. */
    ...(p.roi > 0 ? { roi: p.roi } : {}),
    ...(p.risk ? { risk: p.risk } : {}),
    sqft: p.sqft,
    beds: p.beds,
    baths: p.baths,
    amenities: [],
    tags: p.tags,
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
function rankProperties(properties: NormalizedProperty[], namedSlugs: string[] = []): NormalizedProperty[] {
  const namedIds = new Set(namedSlugs.map((slug) => `aarvasa:${slug}`));
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
    .sort((a, b) => Number(namedIds.has(b.id)) - Number(namedIds.has(a.id)) || b.relevanceScore - a.relevanceScore);
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
  const externalProperties: NormalizedProperty[] = [];
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
  const ranked = rankProperties(deduped, params.projectSlugs).slice(0, maxResults);

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
 * Format the matched records for the prompt.
 *
 * Only facts that exist are written. ROI, yield, risk, growth and score lines
 * used to be printed for every project as "0%", "~0.0%" or "Unrated", which
 * invited the model to talk about them; the market-intelligence block was
 * headed "Market Signals", which the old answer format also demanded.
 */
export function formatAggregatedForPrompt(result: AggregatedResult): string {
  const parts: string[] = [];

  if (result.properties.length > 0) {
    parts.push("## Project records (as filed by each developer)");
    parts.push(
      result.properties
        .map((p, i) => {
          const source =
            p.source === "aarvasa"
              ? "Aarvasa project record — developer filing"
              : `External listing (${p.source}) — not represented by Aarvasa; do not quote any return, yield or risk figure from it`;
          return `[Project ${i + 1}] ${p.title}\nSource: ${source}\n${p.summary}`;
        })
        .join("\n\n"),
    );
  } else {
    parts.push("No listed project matches this question.");
  }

  /* Third-party locality data, only when a real provider supplied it (off by
     default). Context about the area, never a forecast. */
  if (result.marketIntelligence.length > 0) {
    parts.push("\n## Locality context from external providers (background only; never present as a forecast)");
    for (const intel of result.marketIntelligence) {
      parts.push(`\n### ${intel.city}`);
      for (const insight of intel.insights) {
        parts.push(`- ${insight.title}: ${insight.description}`);
      }
    }
  }

  return parts.join("\n");
}
