import { NextResponse } from "next/server";
import { getProperty } from "@/lib/properties";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const property = getProperty(id);

  if (!property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 });
  }

  return NextResponse.json(
    { property },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1200",
      },
    },
  );
}
