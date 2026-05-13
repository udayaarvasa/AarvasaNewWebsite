// ─── Enhanced Natural Language Query Parser ──────────────────────────────────
// Extracts structured investment parameters from free-form user queries.

import type { QueryParameters } from "./types";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Alias Dictionaries
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CITY_ALIASES: Record<string, string> = {
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  blr: "Bengaluru",
  hebbal: "Bengaluru",
  whitefield: "Bengaluru",
  koramangala: "Bengaluru",
  electronic: "Bengaluru",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  worli: "Mumbai",
  bandra: "Mumbai",
  andheri: "Mumbai",
  bkc: "Mumbai",
  powai: "Mumbai",
  goa: "Goa",
  assagao: "Goa",
  calangute: "Goa",
  panjim: "Goa",
  anjuna: "Goa",
  gurugram: "Gurugram",
  gurgaon: "Gurugram",
  "golf course": "Gurugram",
  "dwarka expressway": "Gurugram",
  pune: "Pune",
  hinjewadi: "Pune",
  wakad: "Pune",
  kharadi: "Pune",
  baner: "Pune",
  alibaug: "Alibaug",
  noida: "Noida",
  "greater noida": "Noida",
  delhi: "Delhi",
  "new delhi": "Delhi",
  hyderabad: "Hyderabad",
  "hi-tech city": "Hyderabad",
  gachibowli: "Hyderabad",
  chennai: "Chennai",
  "omr road": "Chennai",
  kolkata: "Kolkata",
  jaipur: "Jaipur",
  ahmedabad: "Ahmedabad",
  lucknow: "Lucknow",
  chandigarh: "Chandigarh",
  kochi: "Kochi",
  coimbatore: "Coimbatore",
  indore: "Indore",
  nagpur: "Nagpur",
  dehradun: "Dehradun",
  rishikesh: "Dehradun",
  shimla: "Shimla",
  manali: "Himachal Pradesh",
  lonavala: "Pune",
  navi: "Mumbai",
  thane: "Mumbai",
};

const TYPE_ALIASES: Record<string, string> = {
  villa: "Villa",
  villas: "Villa",
  bungalow: "Villa",
  farmhouse: "Villa",
  apartment: "Apartment",
  apartments: "Apartment",
  flat: "Apartment",
  flats: "Apartment",
  condo: "Apartment",
  penthouse: "Apartment",
  office: "Office",
  offices: "Office",
  commercial: "Office",
  coworking: "Office",
  "co-working": "Office",
  land: "Land",
  plot: "Land",
  plots: "Land",
  "farm land": "Land",
  warehouse: "Office",
  retail: "Office",
  shop: "Office",
};

const RISK_ALIASES: Record<string, string> = {
  low: "Low",
  "low risk": "Low",
  safe: "Low",
  conservative: "Low",
  stable: "Low",
  "capital preservation": "Low",
  secure: "Low",
  moderate: "Moderate",
  medium: "Moderate",
  "medium risk": "Moderate",
  balanced: "Balanced",
  mixed: "Balanced",
  diversified: "Balanced",
  high: "Moderate",
  aggressive: "Moderate",
  "high growth": "Moderate",
  speculative: "Moderate",
};

const GREETING_PATTERNS =
  /^(hi|hello|hey|good\s?(morning|evening|afternoon|night)|howdy|greetings|namaste|yo|sup|what's up)/i;

const LUXURY_PATTERNS =
  /\b(luxury|premium|ultra|high[\s-]end|elite|exclusive|top[\s-]tier|prestige|opulent|upscale|designer|boutique)\b/i;

const AFFORDABLE_PATTERNS =
  /\b(affordable|budget|cheap|low[\s-]cost|value|economical|starter|entry[\s-]level|modest|reasonable)\b/i;

const RENTAL_YIELD_PATTERNS =
  /\b(rental|rent|yield|passive\s*income|monthly\s*income|letting|tenant|lease\s*income|cash\s*flow)\b/i;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Parser
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse a user query into structured parameters for multi-source retrieval.
 */
export function parseQuery(query: string): QueryParameters {
  const lower = query.toLowerCase().trim();

  // ── Greeting detection ──
  if (GREETING_PATTERNS.test(lower) && lower.split(/\s+/).length <= 6) {
    return {
      locations: [],
      propertyTypes: [],
      rentalYieldIntent: false,
      intent: "greeting",
    };
  }

  // ── Budget extraction ──
  const { budget, budgetLabel } = extractBudget(lower);

  // ── Location extraction ──
  const locations = extractLocations(lower);

  // ── Property type ──
  const propertyTypes = extractPropertyTypes(lower);

  // ── Risk preference ──
  const riskPreference = extractRiskPreference(lower);

  // ── Minimum ROI ──
  const minRoi = extractMinRoi(lower);

  // ── Luxury / Affordable preference ──
  let luxuryPreference: QueryParameters["luxuryPreference"];
  if (LUXURY_PATTERNS.test(lower)) {
    luxuryPreference = "luxury";
  } else if (AFFORDABLE_PATTERNS.test(lower)) {
    luxuryPreference = "affordable";
  } else if (budget && budget >= 50_000_000) {
    luxuryPreference = "luxury"; // infer from budget
  } else if (budget && budget <= 15_000_000) {
    luxuryPreference = "affordable";
  }

  // ── Rental yield intent ──
  const rentalYieldIntent = RENTAL_YIELD_PATTERNS.test(lower);

  // ── Intent detection ──
  let intent: QueryParameters["intent"] = "general";
  if (/\b(invest|investment|buy|purchase|acquire|portfolio|allocate)\b/i.test(lower)) {
    intent = "invest";
  } else if (/\b(rent|rental|lease|tenant|letting|passive\s*income)\b/i.test(lower)) {
    intent = "rent";
  } else if (/\b(compare|versus|vs\.?|difference|between|or\b.*\bor\b)\b/i.test(lower)) {
    intent = "compare";
  }

  return {
    budget,
    budgetLabel,
    locations,
    propertyTypes,
    riskPreference,
    minRoi,
    luxuryPreference,
    rentalYieldIntent,
    intent,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Extraction Helpers
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function extractBudget(lower: string): { budget?: number; budgetLabel?: string } {
  // Match patterns like: "50L", "2 crore", "₹50,00,000", "under 1.5cr"
  const budgetMatch = lower.match(
    /(?:under|below|within|upto|up\s?to|max|budget\s*(?:of|is|:)?\s*)?\s*(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)?)\s*(l|lac|lacs|lakh|lakhs|cr|crore|crores|k)?/i,
  );

  if (!budgetMatch) return {};

  const numeric = parseFloat(budgetMatch[1].replace(/,/g, ""));
  const unit = (budgetMatch[2] || "").toLowerCase();

  if (/^(cr|crore|crores)$/.test(unit)) {
    return { budget: numeric * 10_000_000, budgetLabel: `₹${numeric} Cr` };
  }
  if (/^(l|lac|lacs|lakh|lakhs)$/.test(unit)) {
    return { budget: numeric * 100_000, budgetLabel: `₹${numeric} Lakh` };
  }
  if (/^k$/.test(unit)) {
    return { budget: numeric * 1_000, budgetLabel: `₹${numeric}K` };
  }
  if (numeric > 100_000) {
    return { budget: numeric, budgetLabel: `₹${(numeric / 100_000).toFixed(1)} Lakh` };
  }

  return {};
}

function extractLocations(lower: string): string[] {
  const locations: string[] = [];
  // Sort by key length desc so longer aliases match first (e.g. "greater noida" before "noida")
  const sorted = Object.entries(CITY_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, city] of sorted) {
    if (lower.includes(alias) && !locations.includes(city)) {
      locations.push(city);
    }
  }
  return locations;
}

function extractPropertyTypes(lower: string): string[] {
  const types: string[] = [];
  for (const [alias, type] of Object.entries(TYPE_ALIASES)) {
    if (lower.includes(alias) && !types.includes(type)) {
      types.push(type);
    }
  }
  return types;
}

function extractRiskPreference(lower: string): string | undefined {
  // Sort by key length desc for multi-word aliases
  const sorted = Object.entries(RISK_ALIASES).sort((a, b) => b[0].length - a[0].length);
  for (const [alias, risk] of sorted) {
    if (new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)) {
      return risk;
    }
  }
  return undefined;
}

function extractMinRoi(lower: string): number | undefined {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%?\s*(?:\+\s*)?roi/i,
    /roi\s*(?:of\s*)?(?:above|over|more\s*than|at\s*least|minimum|min|>)?\s*(\d+(?:\.\d+)?)\s*%?/i,
    /(?:above|over|more\s*than|at\s*least|minimum|min)\s*(\d+(?:\.\d+)?)\s*%\s*(?:roi|return)/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }
  return undefined;
}
