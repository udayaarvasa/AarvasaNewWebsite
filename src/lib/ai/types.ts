// ─── Aarvasa AI — Core Type System ───────────────────────────────────────────
// Enterprise-grade types for the multi-source intelligence platform.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Chat & Messaging
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Normalized Property Interface (source-agnostic)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type DataSource =
  | "aarvasa"
  | "rapidapi"
  | "rera"
  | "google_places"
  | "infrastructure"
  | "rental_market"
  | "news"
  | "mock_external";

export interface NormalizedProperty {
  /** Unique ID — prefixed by source (e.g. "aarvasa:goa-cliff-villas") */
  id: string;
  title: string;
  city: string;
  locality: string;
  price: number;
  priceFormatted: string;
  type: string;
  rentalYield?: number;
  roi?: number;
  risk?: string;
  appreciationPotential?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  amenities: string[];
  tags: string[];
  summary: string;
  growth?: string;
  score?: number;
  source: DataSource;
  sourceVerified: boolean;
  /** ISO date when data was fetched/cached */
  fetchedAt: string;
  /** Raw match/relevance score from aggregation */
  relevanceScore: number;
  matchReasons: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Query Parameters (enriched)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface QueryParameters {
  budget?: number;
  budgetLabel?: string;
  locations: string[];
  propertyTypes: string[];
  riskPreference?: string;
  minRoi?: number;
  /** Luxury vs affordable preference */
  luxuryPreference?: "luxury" | "affordable" | "mid-range";
  /** Whether user explicitly asked about rental yield/income */
  rentalYieldIntent: boolean;
  intent: "invest" | "rent" | "compare" | "general" | "greeting";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Legacy MatchedProperty (Aarvasa DB specific — for backward compat)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MatchedProperty {
  id: string;
  title: string;
  price: number;
  priceFormatted: string;
  location: string;
  roi: number;
  type: string;
  risk: string;
  growth: string;
  beds: number;
  baths: number;
  sqft: number;
  score: number;
  summary: string;
  tags: string[];
  matchScore: number;
  matchReasons: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// External Data Provider System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface ExternalProviderConfig {
  name: string;
  source: DataSource;
  enabled: boolean;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  /** Rate limit: max requests per minute */
  rateLimit: number;
  /** TTL for cached responses in seconds */
  cacheTtlSeconds: number;
}

export interface ExternalProviderResult {
  source: DataSource;
  properties: NormalizedProperty[];
  marketIntelligence?: MarketIntelligence;
  error?: string;
  latencyMs: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Market Intelligence (from external sources)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MarketIntelligence {
  city: string;
  insights: MarketInsight[];
  fetchedAt: string;
  source: DataSource;
}

export interface MarketInsight {
  category: "infrastructure" | "price_trend" | "rental" | "regulatory" | "demand" | "supply";
  title: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
  confidence: number; // 0-1
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Source Aggregation
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AggregatedResult {
  properties: NormalizedProperty[];
  marketIntelligence: MarketIntelligence[];
  sourceSummary: SourceSummary[];
  totalCandidates: number;
}

export interface SourceSummary {
  source: DataSource;
  propertyCount: number;
  latencyMs: number;
  status: "success" | "error" | "cached" | "disabled";
  error?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cache
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
  key: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI Pipeline Result
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AiResult {
  stream?: ReadableStream<Uint8Array>;
  text?: string;
  mode: "gemini";
  aggregatedResult: AggregatedResult;
  parsedParams: QueryParameters;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Structured AI Response (for programmatic consumers)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface PropertyRecommendation {
  propertyName: string;
  location: string;
  price: string;
  roi: string;
  risk: string;
  whyRecommended: string;
  rentalYield: string;
  appreciationPotential: string;
  liquidityOutlook: string;
  marketSignals: string[];
  suggestedNextStep: string;
  source: DataSource;
}

export interface AdvisorResponse {
  summary: string;
  recommendations: PropertyRecommendation[];
  marketOutlook?: string;
  disclaimers?: string;
  sources: DataSource[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Vector / Semantic Search (future-ready interfaces)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorStoreConfig {
  provider: "pinecone" | "pgvector" | "in-memory";
  indexName?: string;
  namespace?: string;
  dimension: number;
}
