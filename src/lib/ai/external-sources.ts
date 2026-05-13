// ─── External Data Provider System ───────────────────────────────────────────
// Scalable provider architecture for multi-source market intelligence.

import type {
  DataSource, ExternalProviderConfig, ExternalProviderResult,
  NormalizedProperty, MarketIntelligence, MarketInsight, QueryParameters,
} from "./types";
import { apiCache, buildCacheKey } from "./cache";
import { rateLimiter, EXTERNAL_API_LIMIT } from "./rate-limiter";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provider Registry
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROVIDER_CONFIGS: ExternalProviderConfig[] = [
  {
    name: "RapidAPI Property Feed",
    source: "rapidapi",
    enabled: !!process.env.RAPIDAPI_KEY,
    apiKeyEnvVar: "RAPIDAPI_KEY",
    baseUrl: "https://real-estate-india.p.rapidapi.com",
    rateLimit: 10,
    cacheTtlSeconds: 300,
  },
  {
    name: "RERA Public Dataset",
    source: "rera",
    enabled: !!process.env.RERA_API_KEY,
    apiKeyEnvVar: "RERA_API_KEY",
    baseUrl: "https://rera-api.example.com",
    rateLimit: 20,
    cacheTtlSeconds: 600,
  },
  {
    name: "Google Places",
    source: "google_places",
    enabled: !!process.env.GOOGLE_PLACES_KEY,
    apiKeyEnvVar: "GOOGLE_PLACES_KEY",
    baseUrl: "https://maps.googleapis.com/maps/api/place",
    rateLimit: 30,
    cacheTtlSeconds: 900,
  },
  {
    name: "Infrastructure & News",
    source: "infrastructure",
    enabled: !!process.env.NEWS_API_KEY,
    apiKeyEnvVar: "NEWS_API_KEY",
    baseUrl: "https://newsapi.org/v2",
    rateLimit: 15,
    cacheTtlSeconds: 1800,
  },
  {
    name: "Rental Market Intelligence",
    source: "rental_market",
    enabled: !!process.env.RENTAL_API_KEY,
    apiKeyEnvVar: "RENTAL_API_KEY",
    rateLimit: 10,
    cacheTtlSeconds: 600,
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provider Interface (Adapter Pattern)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ProviderAdapter {
  source: DataSource;
  fetchProperties(params: QueryParameters): Promise<NormalizedProperty[]>;
  fetchMarketIntelligence(cities: string[]): Promise<MarketIntelligence[]>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RapidAPI Adapter
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const rapidApiAdapter: ProviderAdapter = {
  source: "rapidapi",
  async fetchProperties(params) {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) return [];
    const cacheKey = buildCacheKey("rapidapi:props", params);
    const cached = apiCache.get<NormalizedProperty[]>(cacheKey);
    if (cached) return cached;

    try {
      const queryParams = new URLSearchParams();
      if (params.locations[0]) queryParams.set("city", params.locations[0]);
      if (params.budget) queryParams.set("max_price", String(params.budget));
      if (params.propertyTypes[0]) queryParams.set("type", params.propertyTypes[0]);

      const res = await fetch(
        `https://real-estate-india.p.rapidapi.com/properties?${queryParams}`,
        {
          headers: {
            "X-RapidAPI-Key": apiKey,
            "X-RapidAPI-Host": "real-estate-india.p.rapidapi.com",
          },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) return [];
      const data = await res.json();
      const normalized = normalizeRapidApiResponse(data);
      apiCache.set(cacheKey, normalized, 300);
      return normalized;
    } catch {
      return [];
    }
  },
  async fetchMarketIntelligence() { return []; },
};

function normalizeRapidApiResponse(data: unknown): NormalizedProperty[] {
  if (!data || !Array.isArray((data as { results?: unknown[] }).results)) return [];
  return ((data as { results: Record<string, unknown>[] }).results).slice(0, 5).map((item, i) => ({
    id: `rapidapi:${item.id || i}`,
    title: String(item.title || "External Listing"),
    city: String(item.city || ""),
    locality: String(item.locality || item.area || ""),
    price: Number(item.price) || 0,
    priceFormatted: formatPriceINR(Number(item.price) || 0),
    type: String(item.property_type || "Apartment"),
    rentalYield: item.rental_yield ? Number(item.rental_yield) : undefined,
    roi: item.roi ? Number(item.roi) : undefined,
    risk: undefined,
    sqft: item.area_sqft ? Number(item.area_sqft) : undefined,
    beds: item.bedrooms ? Number(item.bedrooms) : undefined,
    baths: item.bathrooms ? Number(item.bathrooms) : undefined,
    amenities: Array.isArray(item.amenities) ? item.amenities.map(String) : [],
    tags: ["External Listing"],
    summary: String(item.description || ""),
    source: "rapidapi" as DataSource,
    sourceVerified: false,
    fetchedAt: new Date().toISOString(),
    relevanceScore: 0,
    matchReasons: [],
  }));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Mock External Intelligence (always-on fallback)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const MARKET_INTELLIGENCE_DB: Record<string, MarketInsight[]> = {
  Bengaluru: [
    { category: "infrastructure", title: "Namma Metro Phase 3 Expansion", description: "₹16,000 Cr metro corridor connecting Hebbal–ITPL–Silk Board, completion 2027. Expected to boost peripheral land values 20-30%.", impact: "positive", confidence: 0.88 },
    { category: "demand", title: "GCC Leasing at Record High", description: "Global Capability Centres leased 18.2M sqft in 2025, highest ever. IT/BFSI employment sustaining 6.2% rental yields.", impact: "positive", confidence: 0.92 },
    { category: "price_trend", title: "Peripheral Market Repricing", description: "North Bengaluru (Hebbal, Yelahanka, Devanahalli) seeing 15% YoY price appreciation driven by airport corridor.", impact: "positive", confidence: 0.85 },
    { category: "supply", title: "Premium Launch Pipeline", description: "42 new premium projects launched in 2025 across ORR belt. Moderate supply absorption at 68%.", impact: "neutral", confidence: 0.78 },
  ],
  Mumbai: [
    { category: "infrastructure", title: "Coastal Road Phase 1 Operational", description: "10.58 km Coastal Road reducing Worli-Marine Drive commute to 8 min. South Mumbai property values up 11%.", impact: "positive", confidence: 0.91 },
    { category: "price_trend", title: "Ultra-Prime Market Resilience", description: "Trophy assets in Worli-BKC corridor maintaining 2.1% vacancy, lowest in India. ₹50Cr+ segment up 11% YoY.", impact: "positive", confidence: 0.89 },
    { category: "infrastructure", title: "Trans-Harbour Link Impact", description: "22 km MTHL connecting Sewri to Navi Mumbai. Opening new affordable luxury corridor with 18% price momentum.", impact: "positive", confidence: 0.86 },
    { category: "regulatory", title: "BMC SRA Policy Updates", description: "Revised FSI norms for slum rehabilitation projects creating redevelopment opportunities in central Mumbai.", impact: "neutral", confidence: 0.72 },
  ],
  Goa: [
    { category: "demand", title: "Luxury Tourism Demand Surge", description: "Foreign tourist arrivals up 34% YoY. Short-term rental occupancy averaging 78% in premium Assagao–Siolim belt.", impact: "positive", confidence: 0.87 },
    { category: "supply", title: "Villa Supply Constrained", description: "Only 12 new villa projects launched in North Goa corridor this year. Limited CRZ-compliant land creating scarcity premium.", impact: "positive", confidence: 0.84 },
    { category: "infrastructure", title: "Mopa Airport Expansion", description: "New Mopa international airport expected to boost tourist arrivals 40% by 2027. Direct impact on North Goa property values.", impact: "positive", confidence: 0.82 },
    { category: "rental", title: "Short-term Rental Yields", description: "Premium villa STR yields averaging 8-12% annually, 3x higher than long-term residential yields in metros.", impact: "positive", confidence: 0.86 },
  ],
  Gurugram: [
    { category: "infrastructure", title: "Dwarka Expressway Completion", description: "29 km Dwarka Expressway nearing completion. Unlocking 15,000+ apartment units. New sectors 85-115 seeing 24% price momentum.", impact: "positive", confidence: 0.88 },
    { category: "demand", title: "Corporate Demand Corridor", description: "Golf Course Extension and SPR seeing institutional investor allocation. Premium resale velocity up 24%.", impact: "positive", confidence: 0.83 },
    { category: "rental", title: "Rental Market Stabilisation", description: "Grade-A residential rental yields stabilising at 3.8-4.2% after correction. Expat demand driving furnished segment.", impact: "neutral", confidence: 0.79 },
    { category: "regulatory", title: "HRERA Compliance Push", description: "Haryana RERA enforcement improving buyer confidence. 92% of new launches now RERA-registered.", impact: "positive", confidence: 0.81 },
  ],
  Pune: [
    { category: "demand", title: "IT-Driven Rental Demand", description: "Hinjewadi IT park expansion driving 33% rental search growth. Young professional influx sustaining absorption.", impact: "positive", confidence: 0.88 },
    { category: "price_trend", title: "Affordable Luxury Sweet Spot", description: "₹1-2 Cr segment seeing highest absorption rates across all Tier-1 cities. Pune leading with 74% sell-through.", impact: "positive", confidence: 0.85 },
    { category: "infrastructure", title: "Pune Metro Phase 1 Live", description: "Metro connectivity improving east-west travel times 40%. Stations along Baner-Hinjewadi corridor boosting values.", impact: "positive", confidence: 0.83 },
    { category: "supply", title: "Student Housing Opportunity", description: "30+ education institutions driving student rental demand. Purpose-built student housing emerging as 7%+ yield asset class.", impact: "positive", confidence: 0.76 },
  ],
  Alibaug: [
    { category: "demand", title: "Weekend Home Demand", description: "Mumbai MTHL reducing travel time to 45 min. Luxury weekend home inquiries up 28%. Kihim-Nagaon belt premium.", impact: "positive", confidence: 0.82 },
    { category: "supply", title: "CRZ Land Scarcity", description: "Waterfront plots limited by CRZ regulations. Existing inventory appreciating at 14-18% annually.", impact: "positive", confidence: 0.80 },
  ],
};

const MACRO_INSIGHTS: MarketInsight[] = [
  { category: "price_trend", title: "National Residential Momentum", description: "Indian residential absorption at 7-year high across top 8 cities. FDI inflows up 18% YoY into real estate.", impact: "positive", confidence: 0.87 },
  { category: "regulatory", title: "RERA Ecosystem Maturing", description: "RERA compliance now at 85%+ in major states. Buyer confidence at highest level since 2017. Dispute resolution 40% faster.", impact: "positive", confidence: 0.84 },
  { category: "price_trend", title: "Home Loan Rate Environment", description: "RBI maintaining accommodative stance. Home loan rates stabilising near 8.2%, favourable for investment entry.", impact: "positive", confidence: 0.81 },
  { category: "demand", title: "NRI Investment Resurgence", description: "NRI property investments up 22% driven by rupee arbitrage and digital purchase platforms like Aarvasa.", impact: "positive", confidence: 0.79 },
];

/**
 * Generate market intelligence from built-in knowledge base for given cities.
 */
function getMockMarketIntelligence(cities: string[]): MarketIntelligence[] {
  const results: MarketIntelligence[] = [];
  const now = new Date().toISOString();

  for (const city of cities) {
    const cityInsights = MARKET_INTELLIGENCE_DB[city];
    if (cityInsights) {
      results.push({
        city,
        insights: pickRandom(cityInsights, 3),
        fetchedAt: now,
        source: "mock_external",
      });
    }
  }

  // Always include macro insights
  if (results.length === 0 || cities.length === 0) {
    results.push({
      city: "India",
      insights: pickRandom(MACRO_INSIGHTS, 2),
      fetchedAt: now,
      source: "mock_external",
    });
  }

  return results;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Provider Orchestrator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const adapters: ProviderAdapter[] = [rapidApiAdapter];

/**
 * Query all enabled external providers in parallel.
 * Falls back gracefully if any provider fails.
 */
export async function fetchExternalData(
  params: QueryParameters,
): Promise<ExternalProviderResult[]> {
  const results: ExternalProviderResult[] = [];
  const cities = params.locations.length > 0 ? params.locations : ["India"];

  // Run enabled adapters in parallel with timeout
  const adapterPromises = adapters
    .filter((adapter) => {
      const config = PROVIDER_CONFIGS.find((c) => c.source === adapter.source);
      return config?.enabled;
    })
    .map(async (adapter) => {
      const start = Date.now();
      const rateKey = `external:${adapter.source}`;

      if (!rateLimiter.tryConsume(rateKey, EXTERNAL_API_LIMIT)) {
        return {
          source: adapter.source,
          properties: [],
          error: "Rate limited",
          latencyMs: 0,
        } as ExternalProviderResult;
      }

      try {
        const [properties, intelligence] = await Promise.all([
          adapter.fetchProperties(params),
          adapter.fetchMarketIntelligence(cities),
        ]);
        return {
          source: adapter.source,
          properties,
          marketIntelligence: intelligence[0],
          latencyMs: Date.now() - start,
        } as ExternalProviderResult;
      } catch (err) {
        return {
          source: adapter.source,
          properties: [],
          error: String(err),
          latencyMs: Date.now() - start,
        } as ExternalProviderResult;
      }
    });

  const settled = await Promise.allSettled(adapterPromises);
  for (const r of settled) {
    if (r.status === "fulfilled") results.push(r.value);
  }

  return results;
}

/**
 * Get market intelligence for given cities.
 * Uses external APIs if available, falls back to built-in knowledge.
 */
export function getMarketIntelligence(
  cities: string[],
  externalResults: ExternalProviderResult[],
): MarketIntelligence[] {
  // Collect from external providers
  const external = externalResults
    .filter((r) => r.marketIntelligence)
    .map((r) => r.marketIntelligence!);

  // Supplement with built-in intelligence
  const mock = getMockMarketIntelligence(cities);

  // Merge, deduplicate by city
  const seen = new Set<string>();
  const merged: MarketIntelligence[] = [];

  for (const intel of [...external, ...mock]) {
    if (!seen.has(intel.city)) {
      seen.add(intel.city);
      merged.push(intel);
    }
  }

  return merged;
}

/**
 * Get list of all provider configurations (for status/debug).
 */
export function getProviderStatus(): ExternalProviderConfig[] {
  return PROVIDER_CONFIGS.map((c) => ({
    ...c,
    enabled: c.apiKeyEnvVar ? !!process.env[c.apiKeyEnvVar] : c.enabled,
  }));
}

// ── Helpers ──

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function formatPriceINR(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(value);
}
