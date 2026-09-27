// ─── Aarvasa AI Chat — Streaming Endpoint ────────────────────────────────────

import { z } from "zod";
import { processAdvisorQuery } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/types";
import { isRateLimited, AI_ENDPOINT_LIMIT, CHAT_GLOBAL_LIMIT } from "@/lib/ai/rate-limiter";

/**
 * Bounds on what a single caller may send.
 *
 * This endpoint is unauthenticated and forwards to a metered third-party model,
 * so an unbounded body is both a memory problem and a direct cost-amplification
 * vector. The schema previously accepted a messages array of any length holding
 * strings of any size.
 */
const MAX_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_TOTAL_CHARS = 24_000;

const ChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES)
    .refine(
      (m) => m.reduce((n, x) => n + x.content.length, 0) <= MAX_TOTAL_CHARS,
      { message: "Conversation too large" },
    ),
});

/**
 * Best-effort client identity for rate limiting.
 *
 * The endpoint previously consumed a single bucket literally keyed
 * "chat:global", so every caller shared one allowance: a single client could
 * drain it and lock the advisor for everyone. Buckets are per-client now, with
 * the global bucket kept as a spend ceiling behind them.
 *
 * x-forwarded-for is client-controllable, so this is an abuse speed bump, not
 * an authorization control — which is why the global ceiling stays.
 */
function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `chat:ip:${ip}`;
}

// Streaming Gemini responses plus source aggregation can exceed the platform's
// short default timeout; the first cold request was returning an empty 500.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const tooMany = () =>
  new Response(
    JSON.stringify({ error: "Too many requests. Please wait a moment." }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": "30" },
    },
  );

export async function POST(request: Request) {
  // Per-client first, so one caller cannot exhaust everyone else's allowance.
  if (isRateLimited(clientKey(request), AI_ENDPOINT_LIMIT)) return tooMany();
  // Then the platform-wide ceiling, which bounds total spend with the provider.
  if (isRateLimited("chat:global", CHAT_GLOBAL_LIMIT)) return tooMany();

  let parsed;
  try {
    parsed = ChatSchema.safeParse(await request.json());
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: "Invalid chat payload" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const messages = parsed.data.messages as ChatMessage[];

  try {
    const result = await processAdvisorQuery(messages);

    const sourceCount = result.aggregatedResult.sourceSummary
      .filter((s) => s.status === "success")
      .length;

    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
      "X-Ai-Mode": result.mode,
      "X-Sources-Used": String(sourceCount),
      "X-Properties-Evaluated": String(result.aggregatedResult.totalCandidates),
    };

    // Streaming response (Gemini)
    if (result.stream) {
      return new Response(result.stream, { headers });
    }

    // Text typing stream — character-by-character for typing effect (for cached responses or error info)
    const textResponse = result.text || "I'm unable to process your request right now.";
    const encoder = new TextEncoder();

    const typingStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const chunkSize = 4;
        for (let i = 0; i < textResponse.length; i += chunkSize) {
          controller.enqueue(encoder.encode(textResponse.slice(i, i + chunkSize)));
          await new Promise((r) => setTimeout(r, 6));
        }
        controller.close();
      },
    });

    return new Response(typingStream, { headers });
  } catch (error) {
    console.error("AI advisor error:", error);
    return new Response(
      JSON.stringify({ error: "AI processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
