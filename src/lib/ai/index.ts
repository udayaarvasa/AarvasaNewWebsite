// ─── Aarvasa AI — Multi-Source Intelligence Orchestrator ─────────────────────
// Processes queries through: parse → aggregate → prompt → stream/mock.

import type { ChatMessage, QueryParameters, AiResult, AggregatedResult } from "./types";
import { parseQuery } from "./query-parser";
import { aggregateSources, formatAggregatedForPrompt } from "./source-aggregator";
import { buildSystemPrompt, buildGreetingPrompt, buildOpenAIMessages } from "./prompt-builder";
import { generateMockResponse } from "./mock-generator";
import { aiResponseCache, buildCacheKey } from "./cache";
import { isRateLimited, OPENAI_LIMIT } from "./rate-limiter";

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

  const apiKey = process.env.OPENAI_API_KEY;

  // No API key → mock mode
  if (!apiKey) {
    const text = generateMockResponse(aggregated, params);
    return { text, mode: "mock", aggregatedResult: aggregated, parsedParams: params };
  }

  // Rate limiting
  if (isRateLimited("openai:global", OPENAI_LIMIT)) {
    const text = generateMockResponse(aggregated, params);
    return { text, mode: "mock", aggregatedResult: aggregated, parsedParams: params };
  }

  // Check AI response cache (avoid duplicate calls for same query context)
  const responseCacheKey = buildCacheKey("ai-response", {
    query: latestUserMessage,
    propCount: aggregated.properties.length,
  });
  const cachedResponse = aiResponseCache.get<string>(responseCacheKey);
  if (cachedResponse) {
    return { text: cachedResponse, mode: "openai", aggregatedResult: aggregated, parsedParams: params };
  }

  // Build prompt with full multi-source context
  const aggregatedContext = formatAggregatedForPrompt(aggregated);
  const systemPrompt = buildSystemPrompt(aggregatedContext, params);
  const openaiMessages = buildOpenAIMessages(systemPrompt, messages);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: openaiMessages,
        max_tokens: 1500,
        temperature: 0.72,
        stream: true,
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI API error: ${response.status} ${response.statusText}`);
      const text = generateMockResponse(aggregated, params);
      return { text, mode: "mock", aggregatedResult: aggregated, parsedParams: params };
    }

    const stream = transformOpenAIStream(response.body!, responseCacheKey);
    return { stream, mode: "openai", aggregatedResult: aggregated, parsedParams: params };
  } catch (error) {
    console.error("OpenAI request failed:", error);
    const text = generateMockResponse(aggregated, params);
    return { text, mode: "mock", aggregatedResult: aggregated, parsedParams: params };
  }
}

async function handleGreeting(
  messages: ChatMessage[],
  params: QueryParameters,
): Promise<AiResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const text = generateMockResponse(EMPTY_AGGREGATION, params);
    return { text, mode: "mock", aggregatedResult: EMPTY_AGGREGATION, parsedParams: params };
  }

  const systemPrompt = buildGreetingPrompt();
  const openaiMessages = buildOpenAIMessages(systemPrompt, messages);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: openaiMessages,
        max_tokens: 400,
        temperature: 0.8,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = generateMockResponse(EMPTY_AGGREGATION, params);
      return { text, mode: "mock", aggregatedResult: EMPTY_AGGREGATION, parsedParams: params };
    }

    const stream = transformOpenAIStream(response.body!);
    return { stream, mode: "openai", aggregatedResult: EMPTY_AGGREGATION, parsedParams: params };
  } catch {
    const text = generateMockResponse(EMPTY_AGGREGATION, params);
    return { text, mode: "mock", aggregatedResult: EMPTY_AGGREGATION, parsedParams: params };
  }
}

/**
 * Transform OpenAI SSE stream into a clean text stream.
 * Optionally caches the full response for dedup.
 */
function transformOpenAIStream(
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
            if (data === "[DONE]") {
              if (cacheKey && fullText.length > 0) {
                aiResponseCache.set(cacheKey, fullText, 120);
              }
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullText += content;
                controller.enqueue(encoder.encode(content));
              }
            } catch { /* skip malformed chunks */ }
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
