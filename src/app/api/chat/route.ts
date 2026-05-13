// ─── Aarvasa AI Chat — Streaming Endpoint ────────────────────────────────────

import { z } from "zod";
import { processAdvisorQuery } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/types";
import { isRateLimited, AI_ENDPOINT_LIMIT } from "@/lib/ai/rate-limiter";

const ChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

export async function POST(request: Request) {
  // Rate limiting
  if (isRateLimited("chat:global", AI_ENDPOINT_LIMIT)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please wait a moment." }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

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

    // Streaming response (OpenAI)
    if (result.stream) {
      return new Response(result.stream, { headers });
    }

    // Mock streaming — character-by-character for typing effect
    const mockText = result.text || "I'm unable to process your request right now.";
    const encoder = new TextEncoder();

    const mockStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const chunkSize = 4;
        for (let i = 0; i < mockText.length; i += chunkSize) {
          controller.enqueue(encoder.encode(mockText.slice(i, i + chunkSize)));
          await new Promise((r) => setTimeout(r, 6));
        }
        controller.close();
      },
    });

    return new Response(mockStream, { headers });
  } catch (error) {
    console.error("AI advisor error:", error);
    return new Response(
      JSON.stringify({ error: "AI processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
