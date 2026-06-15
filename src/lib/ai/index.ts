// ─── Aarvasa AI — Multi-Source Intelligence Orchestrator ─────────────────────
// Processes queries through: parse → aggregate → prompt → stream.

import type { ChatMessage, QueryParameters, AiResult, AggregatedResult } from "./types";
import { parseQuery } from "./query-parser";
import { aggregateSources, formatAggregatedForPrompt } from "./source-aggregator";
import { buildSystemPrompt, buildGreetingPrompt, buildGeminiPayload } from "./prompt-builder";
import { aiResponseCache, buildCacheKey } from "./cache";
import { isRateLimited, GEMINI_LIMIT } from "./rate-limiter";

const EMPTY_AGGREGATION: AggregatedResult = {
  properties: [],
  marketIntelligence: [],
  sourceSummary: [],
  totalCandidates: 0,
};

/**
 * Main entrypoint — processes a conversation through the full pipeline:
 * Query → Parse → Multi-source Retrieval → Normalize → AI Reasoning → Stream
 */
export async function processAdvisorQuery(
  messages: ChatMessage[],
): Promise<AiResult> {
  const latestUserMessage = messages.filter((m) => m.role === "user").at(-1)?.content || "";
  const params = parseQuery(latestUserMessage);

  // Greetings don't need data retrieval
  if (params.intent === "greeting") {
    return handleGreeting(messages, params);
  }

  // Multi-source aggregation
  let aggregated: AggregatedResult;
  try {
    aggregated = await aggregateSources(params);
  } catch (err) {
    console.error("Source aggregation failed:", err);
    aggregated = EMPTY_AGGREGATION;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // No API key → user notification
  if (!apiKey) {
    return {
      text: "Aarvasa AI Advisor requires `GEMINI_API_KEY` to be configured in the environment variables. Please add your Gemini API key to `.env` to enable the advisor.",
      mode: "gemini",
      aggregatedResult: aggregated,
      parsedParams: params,
    };
  }

  // Rate limiting
  if (isRateLimited("gemini:global", GEMINI_LIMIT)) {
    return {
      text: "Aarvasa AI Advisor is currently experiencing high demand. Please try again in a few seconds.",
      mode: "gemini",
      aggregatedResult: aggregated,
      parsedParams: params,
    };
  }

  // Check AI response cache (avoid duplicate calls for same query context)
  const responseCacheKey = buildCacheKey("ai-response", {
    query: latestUserMessage,
    propCount: aggregated.properties.length,
  });
  const cachedResponse = aiResponseCache.get<string>(responseCacheKey);
  if (cachedResponse) {
    return { text: cachedResponse, mode: "gemini", aggregatedResult: aggregated, parsedParams: params };
  }

  // Build prompt with full multi-source context
  const aggregatedContext = formatAggregatedForPrompt(aggregated);
  const systemPrompt = buildSystemPrompt(aggregatedContext, params);
  const geminiPayload = buildGeminiPayload(systemPrompt, messages);
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
      return {
        text: "I encountered an error communicating with the Gemini AI service. Please try again shortly.",
        mode: "gemini",
        aggregatedResult: aggregated,
        parsedParams: params,
      };
    }

    const stream = transformGeminiStream(response.body!, responseCacheKey);
    return { stream, mode: "gemini", aggregatedResult: aggregated, parsedParams: params };
  } catch (error) {
    console.error("Gemini request failed:", error);
    return {
      text: "I encountered a network error while trying to reach the Gemini AI service. Please check your connection and try again.",
      mode: "gemini",
      aggregatedResult: aggregated,
      parsedParams: params,
    };
  }
}

async function handleGreeting(
  messages: ChatMessage[],
  params: QueryParameters,
): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      text: "Welcome to **Aarvasa AI** — India's multi-source real estate intelligence platform. To get started, please configure the `GEMINI_API_KEY` environment variable.",
      mode: "gemini",
      aggregatedResult: EMPTY_AGGREGATION,
      parsedParams: params,
    };
  }

  const systemPrompt = buildGreetingPrompt();
  const geminiPayload = buildGeminiPayload(systemPrompt, messages);
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(geminiPayload),
      }
    );

    if (!response.ok) {
      return {
        text: "Welcome to **Aarvasa AI** — India's multi-source real estate intelligence platform. I combine our verified property database, real-time market signals, and AI-powered analysis to surface investment-grade opportunities. Ask for a city, budget, risk profile, or target ROI to get started.",
        mode: "gemini",
        aggregatedResult: EMPTY_AGGREGATION,
        parsedParams: params,
      };
    }

    const stream = transformGeminiStream(response.body!);
    return { stream, mode: "gemini", aggregatedResult: EMPTY_AGGREGATION, parsedParams: params };
  } catch {
    return {
      text: "Welcome to **Aarvasa AI** — India's multi-source real estate intelligence platform. I combine our verified property database, real-time market signals, and AI-powered analysis to surface investment-grade opportunities. Ask for a city, budget, risk profile, or target ROI to get started.",
      mode: "gemini",
      aggregatedResult: EMPTY_AGGREGATION,
      parsedParams: params,
    };
  }
}

/**
 * Transform Gemini SSE stream into a clean text stream.
 * Optionally caches the full response for dedup.
 */
function transformGeminiStream(
  inputStream: ReadableStream<Uint8Array>,
  cacheKey?: string,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let fullText = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = inputStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (cacheKey && fullText.length > 0) {
              aiResponseCache.set(cacheKey, fullText, 120);
            }
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            try {
              const parsed = JSON.parse(data);
              const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) {
                fullText += content;
                controller.enqueue(encoder.encode(content));
              }
            } catch { /* skip metadata or empty chunks */ }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// Re-exports
export { parseQuery } from "./query-parser";
export { filterProperties } from "./property-filter";
export { aggregateSources } from "./source-aggregator";
export { getProviderStatus } from "./external-sources";
export type { ChatMessage, QueryParameters, NormalizedProperty, AggregatedResult } from "./types";
