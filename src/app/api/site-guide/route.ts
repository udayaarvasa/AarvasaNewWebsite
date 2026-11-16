import { z } from "zod";
import { selectSiteGuideHint } from "@/lib/ai";
import { isRateLimited } from "@/lib/ai/rate-limiter";
import { GUIDE_CONTEXTS, GUIDE_HINTS } from "@/lib/site-guide";

const guideRequest = z.object({
  context: z.enum(Object.keys(GUIDE_CONTEXTS) as (keyof typeof GUIDE_CONTEXTS)[]),
  question: z.string().trim().min(1).max(300),
});

const GUIDE_LIMIT = { maxTokens: 6, refillRatePerSecond: 0.1 };
const GUIDE_GLOBAL_LIMIT = { maxTokens: 8, refillRatePerSecond: 0.125 };

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown").slice(0, 64);
  if (isRateLimited(`guide:ip:${ip}`, GUIDE_LIMIT) || isRateLimited("guide:global", GUIDE_GLOBAL_LIMIT)) {
    return Response.json({ hint: null }, { status: 429 });
  }

  const parsed = guideRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ hint: null }, { status: 400 });

  const { context, question } = parsed.data;
  const allowed = GUIDE_CONTEXTS[context];
  const choices = allowed.map((id) => `${id}: ${GUIDE_HINTS[id].label}. ${GUIDE_HINTS[id].text}`);
  const hint = await selectSiteGuideHint(choices, question, request.signal);
  return Response.json({ hint: allowed.find((id) => id === hint) ?? null });
}
