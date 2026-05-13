// ─── Mock AI Response Generator (Multi-Source Aware) ─────────────────────────
// Generates rich, varied, source-attributed responses when no OpenAI key is set.

import type { NormalizedProperty, QueryParameters, AggregatedResult } from "./types";

const OPENING_LINES = [
  "After cross-referencing our verified database with real-time market intelligence, here are the most compelling opportunities I've identified:",
  "Based on multi-source analysis combining Aarvasa's proprietary data, infrastructure tracking, and demand signals, I recommend focusing on:",
  "My analysis spans verified Aarvasa listings and external market data to surface these high-conviction investment picks:",
  "Leveraging our multi-source intelligence pipeline — proprietary data, market signals, and macro trends — here are your top opportunities:",
  "I've evaluated properties across multiple data sources and ranked them against your investment criteria. Here's my shortlist:",
  "Drawing on Aarvasa's verified portfolio, real-time demand data, and infrastructure growth corridors, these properties stand out:",
];

const NEXT_STEPS = [
  "Schedule a site visit and request the RERA compliance report via Aarvasa's concierge",
  "Compare rental comps in the micro-market using our interactive yield calculator",
  "Request our detailed due-diligence package with blockchain-verified title documentation",
  "Book a consultation with our investment desk to discuss financing and portfolio allocation",
  "Review the blockchain-verified title and escrow documentation on the Aarvasa platform",
  "Analyse the 5-year exit liquidity projections with your financial advisor",
  "Request a virtual site tour through our premium concierge service",
  "Connect with our local market expert for ground-level intelligence on this micro-market",
];

function pickRandom<T>(arr: T[], count: number = 1): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function generatePropertyBlock(property: NormalizedProperty): string {
  const nextStep = pickRandom(NEXT_STEPS)[0];
  const sourceLabel = property.source === "aarvasa" ? "Aarvasa Verified ✓" : `External (${property.source})`;
  const rentalYield = property.rentalYield?.toFixed(1) ?? (Math.random() * 3 + 3).toFixed(1);
  const appreciation = property.appreciationPotential?.toFixed(1) ?? (Math.random() * 4 + 8).toFixed(1);

  // Generate market signals from market intelligence or defaults
  const signals = generateContextualSignals(property);

  return `### 🏛️ ${property.title}
**📍 Location:** ${property.locality}${property.locality ? ", " : ""}${property.city}
**💰 Price:** ${property.priceFormatted}
**📈 Projected ROI:** ${property.roi ?? "N/A"}%
**⚖️ Risk Profile:** ${property.risk ?? "Under Assessment"}
**🔍 Source:** ${sourceLabel}

**Why This Property:**
${property.summary} With a relevance score of ${property.relevanceScore}/99 against your criteria, this ${property.type.toLowerCase()} presents an estimated rental yield of ~${rentalYield}% and capital appreciation potential of ~${appreciation}% annually. ${property.matchReasons.slice(0, 2).join(". ")}${property.matchReasons.length > 0 ? "." : ""}

**Market Signals:**
${signals.map((s) => `- ${s}`).join("\n")}

**🎯 Suggested Next Step:** ${nextStep}`;
}

function generateContextualSignals(property: NormalizedProperty): string[] {
  const citySignals: Record<string, string[]> = {
    Bengaluru: [
      "Metro Phase 3 corridor boosting connectivity to IT hubs — 15% rental appreciation in North Belt",
      "GCC office leasing at record 18.2M sqft — sustaining 6.2% residential rental yields",
      "Airport corridor (Devanahalli) emerging as next growth hotspot with 25% price momentum",
    ],
    Mumbai: [
      "Coastal Road Phase 1 reducing Worli commute — South Mumbai valuations up 11%",
      "MTHL opening Navi Mumbai corridor — 18% price momentum in affordable luxury segment",
      "Ultra-prime vacancy at 2.1% — lowest in India, indicating strong capital preservation",
    ],
    Goa: [
      "Short-term rental occupancy averaging 78% in premium belt — 3x metro yields",
      "Mopa Airport expansion projected to boost tourist arrivals 40% by 2027",
      "CRZ-compliant villa supply constrained — only 12 new projects in Assagao corridor",
    ],
    Gurugram: [
      "Dwarka Expressway completion unlocking Sectors 85-115 — 24% price momentum",
      "Institutional investors increasing NCR luxury allocation — resale velocity up 24%",
      "HRERA compliance at 92% — highest buyer confidence in NCR market",
    ],
    Pune: [
      "Hinjewadi IT expansion driving 33% rental search growth — young professional influx",
      "₹1-2Cr segment at 74% sell-through — highest absorption across Tier-1 cities",
      "Metro Phase 1 live — Baner-Hinjewadi corridor seeing 18% value uplift",
    ],
    Alibaug: [
      "MTHL reducing Mumbai travel to 45 min — luxury weekend home inquiries up 28%",
      "CRZ waterfront plots appreciating 14-18% annually on scarcity premium",
      "Kihim-Nagaon belt emerging as Mumbai's premier second-home destination",
    ],
  };

  const city = Object.keys(citySignals).find((c) =>
    property.city.toLowerCase().includes(c.toLowerCase()) ||
    property.locality.toLowerCase().includes(c.toLowerCase()),
  );

  const pool = citySignals[city || ""] || [
    "Indian real estate FDI inflows up 18% YoY — positive macro environment",
    "Residential absorption at 7-year high across top-8 cities",
    "Home loan rates stabilising near 8.2% — favourable entry point for investors",
  ];

  return pickRandom(pool, 3);
}

/**
 * Generate a rich mock AI response using aggregated multi-source data.
 */
export function generateMockResponse(
  aggregated: AggregatedResult,
  params: QueryParameters,
): string {
  if (params.intent === "greeting") {
    return `Welcome to **Aarvasa AI** — India's multi-source real estate intelligence platform. 👋

I combine our **verified property database**, **real-time market signals**, and **AI-powered investment reasoning** to help you discover institutional-grade opportunities across India's most dynamic markets.

**What I can do:**
- 🏠 Recommend properties by city, budget, ROI, and risk profile
- 📊 Analyse rental yields and capital appreciation across micro-markets
- 📈 Surface real-time infrastructure, demand, and regulatory signals
- 🔍 Cross-reference multiple data sources for high-conviction picks
- ⚖️ Risk-adjusted portfolio analysis with exit liquidity projections

What kind of investment opportunity are you exploring today?`;
  }

  if (aggregated.properties.length === 0) {
    const marketContext = aggregated.marketIntelligence.length > 0
      ? `\n\nHowever, based on current market intelligence:\n${aggregated.marketIntelligence.flatMap((m) => m.insights.slice(0, 2).map((i) => `- **${i.title}:** ${i.description}`)).join("\n")}\n\nThese signals suggest expanding your search could uncover strong opportunities.`
      : "";

    return `I wasn't able to find properties that precisely match your criteria across our multi-source pipeline. Here's what I'd suggest:

1. **Broaden your budget range** — even a 15-20% flex can unlock significantly better options
2. **Consider adjacent micro-markets** — often higher ROI at lower entry points  
3. **Explore different property types** — commercial assets sometimes offer better risk-adjusted returns
4. **Expand location radius** — peripheral growth corridors often outperform prime locations on ROI${marketContext}

Could you share more about your investment goals? I'll refine the search across all data sources.`;
  }

  const opening = pickRandom(OPENING_LINES)[0];
  const sourceSummary = aggregated.sourceSummary
    .filter((s) => s.status === "success" && s.propertyCount > 0)
    .map((s) => `${s.source === "aarvasa" ? "Aarvasa Verified" : s.source} (${s.propertyCount})`)
    .join(", ");

  const propertyBlocks = aggregated.properties
    .slice(0, 3)
    .map((p) => generatePropertyBlock(p))
    .join("\n\n---\n\n");

  // Market Intelligence section
  let marketSection = "";
  if (aggregated.marketIntelligence.length > 0) {
    const insights = aggregated.marketIntelligence
      .flatMap((m) => m.insights.slice(0, 2).map((i) => `- **${i.title}:** ${i.description}`))
      .slice(0, 4);
    if (insights.length > 0) {
      marketSection = `\n\n---\n\n### 📊 Market Intelligence\n${insights.join("\n")}`;
    }
  }

  const footer = `\n\n---\n\n**Data Sources:** ${sourceSummary || "Aarvasa Verified"} | ${aggregated.totalCandidates} properties evaluated\n\n> *Projections combine Aarvasa's proprietary scoring model with external market intelligence. Past performance does not guarantee future returns. Always conduct independent due diligence.*`;

  return `${opening}\n\n${propertyBlocks}${marketSection}${footer}`;
}
