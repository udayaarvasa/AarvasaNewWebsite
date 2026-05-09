import { NextResponse } from "next/server";
import { z } from "zod";
import { getRecommendations } from "@/lib/properties";

const ChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

function mockResponse(prompt: string) {
  const budgetMatch = prompt.match(/(\d+)\s*(l|lac|lakh|cr|crore)?/i);
  const numeric = budgetMatch ? Number(budgetMatch[1]) : 50;
  const multiplier = /cr|crore/i.test(budgetMatch?.[2] || "") ? 10000000 : 100000;
  const budget = numeric * multiplier;
  const location = /bangalore|bengaluru/i.test(prompt)
    ? "Bengaluru"
    : /goa/i.test(prompt)
      ? "Goa"
      : /mumbai/i.test(prompt)
        ? "Mumbai"
        : undefined;

  const recommendations = getRecommendations({ budget, location }).slice(0, 3);

  return [
    `Based on your query, I would shortlist ${recommendations.map((item) => item.title).join(", ")}.`,
    recommendations
      .map(
        (item, index) =>
          `${index + 1}. ${item.title} in ${item.location}: ${item.roi}% projected ROI, ${item.risk.toLowerCase()} risk, ${item.growth.toLowerCase()}.`,
      )
      .join("\n"),
    "Next step: compare rental comps and exit liquidity before booking a consultation.",
  ].join("\n\n");
}

function extractText(data: unknown) {
  const response = data as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  return (
    response.output_text ||
    response.output?.flatMap((item) => item.content || []).find((part) => part.text)?.text
  );
}

export async function POST(request: Request) {
  const parsed = ChatSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat payload" }, { status: 400 });
  }

  const latest = parsed.data.messages.at(-1)?.content || "";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ message: mockResponse(latest), mode: "mock" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.2",
        instructions:
          "You are Aarvasa AI, a concise real estate investment advisor for Indian property. Suggest properties, ROI logic, risks, and next diligence steps. Never claim guaranteed returns.",
        input: parsed.data.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        max_output_tokens: 420,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ message: mockResponse(latest), mode: "mock" });
    }

    const data = await response.json();
    return NextResponse.json({
      message: extractText(data) || mockResponse(latest),
      mode: "openai",
    });
  } catch {
    return NextResponse.json({ message: mockResponse(latest), mode: "mock" });
  }
}
