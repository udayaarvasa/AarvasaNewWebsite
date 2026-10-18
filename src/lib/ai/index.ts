// ─── Aarvasa AI — Multi-Source Intelligence Orchestrator ─────────────────────
// Processes queries through: parse → aggregate → prompt → stream.

import type { ChatMessage, QueryParameters, AiResult, AggregatedResult } from "./types";
import { parseQuery } from "./query-parser";
import { aggregateSources, formatAggregatedForPrompt } from "./source-aggregator";
import { buildSystemPrompt, buildGreetingPrompt, buildGeminiPayload } from "./prompt-builder";
import { aiResponseCache, buildCacheKey } from "./cache";
import { isRateLimited, GEMINI_LIMIT } from "./rate-limiter";
import { publishedProjects } from "@/lib/projects";
import { formatCompact } from "@/lib/currency";

/** Upstream call bounds. The provider has its own limits; these make ours
 *  explicit so a slow or verbose response cannot dictate our cost or latency. */
const GEMINI_TIMEOUT_MS = 30_000;
const GEMINI_MAX_OUTPUT_TOKENS = 2_048;


/* ── Resilience ───────────────────────────────────────────────────────────
   The provider's flagship model regularly answers 503 "high demand". One
   failed call used to end the conversation with an apology. Now a throttled
   call is retried briefly, then lighter models are tried in turn, and only
   when all of them are unavailable does the advisor fall back to answering
   from the project records it already holds. */

const RETRYABLE = new Set([429, 500, 503, 504]);

function geminiModels(): string[] {
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || "gemini-3.5-flash-lite,gemini-2.5-flash,gemini-2.5-flash-lite")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

/** The first successful streaming response across models and retries, or the last status seen. */
async function callGemini(
  apiKey: string,
  body: unknown,
  signal: AbortSignal,
): Promise<{ response: Response | null; lastStatus: number | null }> {
  let lastStatus: number | null = null;
  for (const model of geminiModels()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal.aborted) return { response: null, lastStatus };
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            // Header rather than ?key=: URLs reach access logs, headers do not.
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify(body),
            signal,
          },
        );
        if (response.ok) return { response, lastStatus: response.status };
        lastStatus = response.status;
        const detail = await response.text().catch(() => "");
        console.error(`Gemini ${model} attempt ${attempt + 1}: ${response.status} ${detail.slice(0, 160)}`);
        // A model that does not exist or rejects the request will not recover on retry.
        if (!RETRYABLE.has(response.status)) break;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return { response: null, lastStatus };
        console.error(`Gemini ${model} attempt ${attempt + 1} failed:`, error);
      }
    }
  }
  return { response: null, lastStatus };
}

/** An answer built from the project records alone, for when no model is reachable. */
export function recordsAnswer(query: string): string {
  const projects = publishedProjects();
  const q = query.toLowerCase();
  const matches = projects.filter((p) =>
    [p.name, p.city, p.location, p.developer, p.kind === "plots" ? "plot plots land" : "apartment residence flat"]
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .some((word) => word.length > 2 && q.includes(word)),
  );
  const list = (matches.length > 0 ? matches : projects).slice(0, 5);
  const lines = list.map((p) => {
    const price =
      p.fromPrice > 0
        ? `from ${formatCompact(p.fromPrice, p.currency)}`
        : p.ratePerSqft
          ? `${formatCompact(p.ratePerSqft, p.currency)}/sq.ft`
          : "price on request";
    const when = p.kind === "plots" ? "plots" : p.completion ? `handover ${p.completion}` : "residences";
    return `- **${p.name}** — ${p.location}, ${p.city} · ${price} · ${when}`;
  });
  const lead =
    matches.length > 0
      ? "Here is what matches on the platform right now:"
      : "I could not tie that question to a listing, so here is everything currently listed:";
  return `${lead}\n\n${lines.join("\n")}\n\nAsk about any of these by name — configurations, payment plans or completion — or open **Properties** to filter by city, type and budget.`;
}

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
      text: recordsAnswer(latestUserMessage),
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
    const { response } = await callGemini(apiKey, bounded, abort.signal);
    if (!response) {
      // Every model is busy or unreachable: answer from the records instead.
      return { text: recordsAnswer(latestUserMessage), mode: "gemini", aggregatedResult: aggregated, parsedParams: params };
    }
    const stream = transformGeminiStream(response.body!, responseCacheKey);
    return { stream, mode: "gemini", aggregatedResult: aggregated, parsedParams: params };
  } catch (error) {
    console.error("Gemini request failed:", error);
    return { text: recordsAnswer(latestUserMessage), mode: "gemini", aggregatedResult: aggregated, parsedParams: params };
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

  try {
    const { response } = await callGemini(apiKey, geminiPayload, AbortSignal.timeout(GEMINI_TIMEOUT_MS));

    if (!response) {
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
