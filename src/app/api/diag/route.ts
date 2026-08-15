import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Detailed output (raw driver errors, which include the database hostname) is only
// returned when the caller supplies ?key=<AUTH_DIAG_KEY>. Without it the endpoint
// still reports whether each piece of config is present and whether the database is
// reachable, but leaks no infrastructure details.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key")
  const detailed = !!process.env.AUTH_DIAG_KEY && key === process.env.AUTH_DIAG_KEY

  const diag = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasGoogleClientId: !!process.env.AUTH_GOOGLE_ID,
    hasGoogleClientSecret: !!process.env.AUTH_GOOGLE_SECRET,
    nodeEnv: process.env.NODE_ENV,
    hasAuthUrl: !!process.env.AUTH_URL,
    dbConnectionStatus: "untested",
    dbErrorCode: null as string | null,
    dbError: undefined as unknown,
  }

  try {
    // Try a simple raw query to test database connectivity
    await prisma.$queryRaw`SELECT 1`
    diag.dbConnectionStatus = "success"
  } catch (error: any) {
    diag.dbConnectionStatus = "failed"
    // Prisma codes are safe to expose: P1001 = unreachable, P1000 = bad credentials.
    diag.dbErrorCode = error?.code ?? null
    if (detailed) {
      diag.dbError = { message: error?.message, code: error?.code, meta: error?.meta }
    }
  }

  return NextResponse.json(diag, {
    headers: { "Cache-Control": "no-store" },
  })
}
