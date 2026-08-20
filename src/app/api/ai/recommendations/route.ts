import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getRecommendations } from "@/lib/properties";
import { getAuthUser } from "@/lib/auth-context";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  const url = new URL(request.url);

  const recommendations = getRecommendations({
    budget: Number(url.searchParams.get("budget") || 50000000),
    location: url.searchParams.get("location") || undefined,
    type: url.searchParams.get("type") || undefined,
    risk: url.searchParams.get("risk") || undefined,
  });

  return NextResponse.json(
    {
      user,
      model: "aarvasa-simulated-investment-ranker-v1",
      generatedAt: new Date().toISOString(),
      recommendations,
    },
    {
      headers: {
        "Cache-Control": user
          ? "private, max-age=60"
          : "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
