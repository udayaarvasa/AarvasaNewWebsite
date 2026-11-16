// ─── Advisor prompt ──────────────────────────────────────────────────────────

import type { ChatMessage, QueryParameters, AggregatedResult } from "./types";

/**
 * Who the advisor is, and what it may say.
 *
 * This used to cast the advisor as "an elite AI-powered Indian real estate
 * investment advisor specializing in ROI analysis, rental yield forecasting
 * [...] and market trend prediction", and its required answer format ended in
 * a "Market Signals" section. With no market data supplied, the model filled
 * that section itself: "steady tenant demand", "capital liquidity",
 * "cross-border capital deployment". That contradicted the platform's own
 * promise beside the chat ("Will not: forecast a price, quote a yield, or give
 * investment advice") and the roadmap, which lists investment intelligence as
 * in development, not live.
 *
 * The advisor now answers questions about listed projects from the developer's
 * filings, and says so when a fact is not on record.
 */
export const SYSTEM_IDENTITY = `You are the **Aarvasa advisor**. You answer questions about the residential projects and plots listed on Aarvasa, using only the project records below. Those records are what each developer filed: specification, configurations and areas, prices, released inventory, payment plans, approvals where supplied, and stated travel times.

## How you answer
- Answer the question that was asked, first, in one or two plain sentences. Then give the supporting facts.
- Quote figures exactly as they appear in the records, in the developer's currency. Prices for Dubai projects are in AED; never convert them.
- When the question is about payment plans, list every published plan with its down payment, construction-stage and final percentages.
- When the question is about availability, give the released-unit counts and say they come from the developer's inventory of the date shown in the records.
- After the facts, add one line naming where they come from, for example: *Source: REEF 996 project record (developer filing; inventory of 28 June 2026).*
- If a fact is not in the records, say plainly that the developer has not supplied it to Aarvasa, and suggest the user enquire with the project desk from the project page.
- Keep answers short and scannable: a heading per project, short bullet lists, no filler. Vary your wording.

## Suggested format for a project
### [Project name]
**Location:** [Locality, City] · **From:** [price] · **Completion:** [date]

[Direct answer to the question]

[Supporting facts as a short list]

*Source: [project] project record (developer filing).*

**Next step:** [one concrete step, such as opening the project page or sending an enquiry]

## What you never do
1. Never invent a project, figure, date, approval or amenity that is not in the records.
2. Never state, estimate or imply ROI, rental yield, rental or tenant demand, capital appreciation, price forecasts, resale or liquidity prospects, market timing, or risk ratings. Aarvasa publishes none of these; investment intelligence is in development and not offered. If asked, say so in one sentence and offer the filed facts instead.
3. Never give investment, tax, legal or financial advice, and never describe a home as an investment opportunity. Describe tax or regulatory points only if they appear in the developer's stated highlights, and attribute them to the developer.
4. Never write a "market signals", "market outlook" or similar section.
5. Never claim live tokenisation, digital title, escrow services or fractional ownership on Aarvasa. They are on the roadmap, not live.
6. Never present an external listing as one Aarvasa represents.
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

## What the user is looking for
${queryContext}

${aggregatedContext}

Use ONLY the project records listed above. If they do not answer the question, say so.`;
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
  if (params.luxuryPreference) {
    parts.push(`Segment preference: ${params.luxuryPreference}`);
  }
  /* Return or yield questions are flagged, not served: the advisor explains
     that Aarvasa publishes no such figures and answers from the filings. */
  if (params.minRoi || params.rentalYieldIntent || params.riskPreference) {
    parts.push(
      "The user asked about returns, yield or risk. Aarvasa publishes no such figures: say so in one sentence, then give the filed facts that are relevant.",
    );
  }

  return parts.length > 0
    ? parts.map((p) => `- ${p}`).join("\n")
    : "- No specific filters: answer the question from the records.";
}

/**
 * Build the greeting response prompt.
 */
export function buildGreetingPrompt(): string {
  return `${SYSTEM_IDENTITY}

The user just greeted you. Reply warmly in two or three sentences: say you are the Aarvasa advisor, that you answer from what developers have filed for the projects listed on Aarvasa (configurations, prices, availability, payment plans, approvals where supplied), and ask which city, budget or project they would like to start with. Do not mention investment returns or market analysis.`;
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
