import { NextResponse } from "next/server";
import { properties } from "@/lib/properties";

export async function GET() {
  return NextResponse.json(
    { properties },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1200",
      },
    },
  );
}
