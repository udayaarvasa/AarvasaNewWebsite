import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRecommendations } from "@/lib/properties";
import { verifyToken } from "@/lib/auth";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const session = verifyToken(cookieStore.get("aarvasa_token")?.value);
  const url = new URL(request.url);

  const recommendations = getRecommendations({
    budget: Number(url.searchParams.get("budget") || 50000000),
    location: url.searchParams.get("location") || undefined,
    type: url.searchParams.get("type") || undefined,
    risk: url.searchParams.get("risk") || undefined,
  });

  return NextResponse.json(
    {
      user: session,
      model: "aarvasa-simulated-investment-ranker-v1",
      generatedAt: new Date().toISOString(),
      recommendations,
    },
    {
      headers: {
        "Cache-Control": session
          ? "private, max-age=60"
          : "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
