// ─── Aarvasa AI — Multi-Source Intelligence Orchestrator ─────────────────────
// Processes queries through: parse → aggregate → prompt → stream.

import type { ChatMessage, QueryParameters, AiResult, AggregatedResult } from "./types";
import { parseQuery } from "./query-parser";
import { aggregateSources, formatAggregatedForPrompt } from "./source-aggregator";
import { buildSystemPrompt, buildGreetingPrompt, buildGeminiPayload } from "./prompt-builder";
import { aiResponseCache, buildCacheKey } from "./cache";
import { isRateLimited, GEMINI_LIMIT } from "./rate-limiter";

/** Upstream call bounds. The provider has its own limits; these make ours
 *  explicit so a slow or verbose response cannot dictate our cost or latency. */
const GEMINI_TIMEOUT_MS = 30_000;
const GEMINI_MAX_OUTPUT_TOKENS = 2_048;

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

  /* Bound the reply. Relying on the provider default leaves output size — and
     therefore cost and response time — outside our control. */
  const bounded = {
    ...geminiPayload,
    generationConfig: {
      ...((geminiPayload as Record<string, unknown>).generationConfig as object ?? {}),
      maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
    },
  };

  /* A hung upstream connection would otherwise occupy the function until the
     route's own maxDuration expired. */
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header rather than a ?key= query parameter: URLs get written to
          // proxy and platform access logs, request bodies and headers do not.
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(bounded),
        signal: abort.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
      /* Distinguish "the provider is throttling us" from a general fault, so
         the user is told to wait rather than to retry immediately — retrying
         into a 429 only deepens the backlog. */
      const throttled = response.status === 429 || response.status === 503;
      return {
        text: throttled
          ? "The advisor is handling more requests than usual right now. Please try again in a minute."
          : "I encountered an error communicating with the Gemini AI service. Please try again shortly.",
        mode: "gemini",
        aggregatedResult: aggregated,
        parsedParams: params,
      };
    }

    const stream = transformGeminiStream(response.body!, responseCacheKey);
    return { stream, mode: "gemini", aggregatedResult: aggregated, parsedParams: params };
  } catch (error) {
    const timedOut = (error as Error)?.name === "AbortError";
    console.error(timedOut ? "Gemini request timed out" : "Gemini request failed:", error);
    return {
      text: timedOut
        ? "The advisor took too long to respond. Please try again."
        : "I encountered a network error while trying to reach the Gemini AI service. Please check your connection and try again.",
      mode: "gemini",
      aggregatedResult: aggregated,
      parsedParams: params,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function handleGreeting(
  messages: ChatMessage[],
  params: QueryParameters,
): Promise<AiResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      text: "The Aarvasa advisor is not configured in this environment.",
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
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Header rather than ?key=: URLs reach access logs, headers do not.
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(geminiPayload),
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      return {
        text: "Welcome to **Aarvasa AI**. I can search what developers have filed with us — location, configuration, area, price and completion — and put options side by side. Tell me a city, a budget or the number of bedrooms to start.",
        mode: "gemini",
        aggregatedResult: EMPTY_AGGREGATION,
        parsedParams: params,
      };
    }

    const stream = transformGeminiStream(response.body!);
    return { stream, mode: "gemini", aggregatedResult: EMPTY_AGGREGATION, parsedParams: params };
  } catch {
    return {
      text: "Welcome to **Aarvasa AI**. I can search what developers have filed with us — location, configuration, area, price and completion — and put options side by side. Tell me a city, a budget or the number of bedrooms to start.",
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
