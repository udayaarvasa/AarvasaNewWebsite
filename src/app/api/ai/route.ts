// ─── Aarvasa AI — Dedicated Intelligence API ────────────────────────────────
// Provides status, provider info, and direct query endpoints.

import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/ai";
import { aggregateSources } from "@/lib/ai/source-aggregator";
import { parseQuery } from "@/lib/ai/query-parser";
import { isRateLimited, AI_ENDPOINT_LIMIT } from "@/lib/ai/rate-limiter";
import { apiCache } from "@/lib/ai/cache";

/**
 * GET /api/ai — Returns AI system status and provider health.
 */
export async function GET() {
  const providers = getProviderStatus();
  const hasGemini = !!process.env.GEMINI_API_KEY;
  const cacheStats = apiCache.stats();

  return NextResponse.json({
    status: "operational",
    version: "2.0.0",
    mode: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    providers: providers.map((p) => ({
      name: p.name,
      source: p.source,
      enabled: p.enabled,
      rateLimit: p.rateLimit,
    })),
    cache: cacheStats,
    capabilities: [
      "multi-source-retrieval",
      "streaming-responses",
      "conversation-memory",
      "market-intelligence",
      "rate-limiting",
      "response-caching",
      "vector-search-ready",
    ],
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/ai — Direct query endpoint for programmatic access.
 * Body: { query: string, budget?: number, locations?: string[], risk?: string }
 */
export async function POST(request: Request) {
  if (isRateLimited("ai-api:global", AI_ENDPOINT_LIMIT)) {
    return NextResponse.json(
      { error: "Rate limited. Please try again shortly." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = String(body.query || "");
  if (!query.trim()) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const params = parseQuery(query);

  // Allow overrides from body
  if (body.budget) params.budget = Number(body.budget);
  if (Array.isArray(body.locations)) params.locations = body.locations as string[];
  if (body.risk) params.riskPreference = String(body.risk);

  try {
    const aggregated = await aggregateSources(params);

    return NextResponse.json({
      query,
      parsedParams: params,
      results: {
        properties: aggregated.properties,
        marketIntelligence: aggregated.marketIntelligence,
        sourceSummary: aggregated.sourceSummary,
        totalCandidates: aggregated.totalCandidates,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("AI query error:", err);
    return NextResponse.json(
      { error: "Intelligence pipeline failed", message: String(err) },
      { status: 500 },
    );
  }
}
