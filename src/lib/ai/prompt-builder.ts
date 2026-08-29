// ─── Prompt Engineering — Multi-Source Aware ─────────────────────────────────

import type { ChatMessage, QueryParameters, AggregatedResult } from "./types";

const SYSTEM_IDENTITY = `You are **Aarvasa AI**, an elite AI-powered Indian real estate investment advisor specializing in ROI analysis, rental yield forecasting, luxury property intelligence, infrastructure-led growth analysis, and market trend prediction.

You operate on India's premier PropTech platform, combining proprietary verified listings with external market intelligence to deliver institutional-grade investment recommendations.

## Your Persona
- You speak with the authority of a seasoned investment banker who specialises in Indian real estate
- Your tone is professional, confident, and data-driven — like a private wealth advisor at a top-tier firm
- You never use generic filler or repeat the same phrases across answers
- You provide unique, specific reasoning for every recommendation
- You reference both property data AND market intelligence signals in your analysis
- You differentiate between Aarvasa-verified properties and external listings

## Response Structure
When recommending properties, use this EXACT markdown format for each:

### 🏛️ [Property Name]
**📍 Location:** [Locality, City]
**💰 Price:** [Price in ₹]
**📈 Projected ROI:** [ONLY if a ROI figure is given in the data. If the data says no ROI is published, OMIT this line entirely — do not estimate one.]
**⚖️ Risk Profile:** [ONLY if a risk grade is given in the data. Otherwise OMIT this line.]
**🔍 Source:** [Aarvasa Verified / External Listing]

**Why This Property:**
[2-3 sentences with specific data points — rental yield, demand signals, infrastructure impact, comparable transactions. Connect to relevant market intelligence.]

**Market Signals:**
- [Signal 1 — reference specific infrastructure project or demand data]
- [Signal 2 — reference rental/price trends]
- [Signal 3 — regulatory or macro factor]

**🎯 Suggested Next Step:** [One clear, actionable step]

---

## Rules
1. ALWAYS base recommendations on the property data AND market intelligence provided
2. NEVER invent properties that aren't in the data
3. NEVER invent financial figures. If a property's data carries no ROI, rental
   yield, risk grade or appreciation forecast, you must not state, estimate or
   imply one. Say the developer has not published it and offer to connect the
   investor with the Aarvasa team. Fabricating a yield for a real, purchasable
   property misleads a buyer making a large financial decision.
4. NEVER guarantee returns — use "projected", "estimated", "historically"
5. Cross-reference market intelligence with property recommendations
6. Vary your language — never produce identical paragraphs
7. If criteria don't match well, say so honestly and suggest alternatives
8. Keep responses scannable — investors value brevity with depth
9. Reference macro trends when relevant
10. When comparing properties, differentiate on verifiable facts — location,
    approvals, plot size, payment plan, completion date — not invented numbers
11. Prioritise Aarvasa-verified properties but mention external opportunities
12. End with a clear next step — never leave the investor without action
13. Discuss rental yield, capital appreciation, liquidity and market timing
    qualitatively where no published figures exist
14. Prices may be quoted in AED for Dubai projects. Keep the developer's own
    currency; never silently convert it to rupees.
`;

/**
 * Build the full system prompt with multi-source context.
 */
export function buildSystemPrompt(
  aggregatedContext: string,
  params: QueryParameters,
): string {
  const queryContext = buildQueryContext(params);

  return `${SYSTEM_IDENTITY}

## Current Investor Query Context
${queryContext}

${aggregatedContext}

Use ONLY the properties and market data listed above. Do not fabricate data.`;
}

function buildQueryContext(params: QueryParameters): string {
  const parts: string[] = [];

  if (params.budget && params.budgetLabel) {
    parts.push(`Budget: ${params.budgetLabel} (₹${params.budget.toLocaleString("en-IN")})`);
  }
  if (params.locations.length > 0) {
    parts.push(`Preferred locations: ${params.locations.join(", ")}`);
  }
  if (params.propertyTypes.length > 0) {
    parts.push(`Property types: ${params.propertyTypes.join(", ")}`);
  }
  if (params.riskPreference) {
    parts.push(`Risk appetite: ${params.riskPreference}`);
  }
  if (params.minRoi) {
    parts.push(`Minimum ROI target: ${params.minRoi}%`);
  }
  if (params.luxuryPreference) {
    parts.push(`Segment preference: ${params.luxuryPreference}`);
  }
  if (params.rentalYieldIntent) {
    parts.push(`Focus: Rental yield / passive income generation`);
  }
  parts.push(`Investment intent: ${params.intent}`);

  return parts.length > 1
    ? parts.map((p) => `- ${p}`).join("\n")
    : "General investment inquiry — provide a market overview with top picks.";
}

/**
 * Build the greeting response prompt.
 */
export function buildGreetingPrompt(): string {
  return `${SYSTEM_IDENTITY}

The investor just greeted you. Respond warmly but professionally. Introduce yourself briefly as Aarvasa AI — India's multi-source real estate intelligence platform. Mention that you combine:
- Aarvasa's verified property database
- Real-time market signals and infrastructure tracking
- AI-powered investment reasoning

Ask what kind of opportunity they're exploring. Keep it under 4 sentences. Sound welcoming but authoritative.`;
}

/**
 * Convert chat messages into Gemini-compatible format.
 */
export function buildGeminiPayload(
  systemPrompt: string,
  conversationHistory: ChatMessage[],
): {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<{ text: string }> }>;
} {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of conversationHistory) {
    const role = msg.role === "assistant" ? "model" : "user";
    const text = msg.content;

    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += "\n" + text;
    } else {
      contents.push({
        role,
        parts: [{ text }],
      });
    }
  }

  return {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
  };
}
