import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// Reduce the driver error to a coarse cause. This is safe to expose publicly —
// unlike the raw message, which embeds the database hostname.
function classify(error: any): string {
  const code = error?.errorCode ?? error?.code
  const message = String(error?.message ?? "")

  if (code === "P1001" || /can't reach database server/i.test(message)) return "unreachable"
  if (code === "P1000" || /authentication failed/i.test(message)) return "auth_failed"
  if (code === "P1003" || /does not exist on the database server/i.test(message)) return "database_missing"
  if (code === "P1002" || /timed out/i.test(message)) return "timeout"
  if (/self.signed certificate|SSL|TLS/i.test(message)) return "tls_error"
  if (/invalid port|invalid connection string|the provided database string/i.test(message)) return "bad_connection_string"
  return "unknown"
}

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
    dbErrorKind: null as string | null,
    dbError: undefined as unknown,
  }

  try {
    // Try a simple raw query to test database connectivity
    await prisma.$queryRaw`SELECT 1`
    diag.dbConnectionStatus = "success"
  } catch (error: any) {
    diag.dbConnectionStatus = "failed"
    // Connection failures surface as PrismaClientInitializationError, which carries
    // `errorCode` — not the `code` that PrismaClientKnownRequestError uses. Read both.
    diag.dbErrorCode = error?.errorCode ?? error?.code ?? null
    diag.dbErrorKind = classify(error)
    if (detailed) {
      diag.dbError = {
        message: error?.message,
        errorCode: error?.errorCode,
        code: error?.code,
        meta: error?.meta,
      }
    }
  }

  return NextResponse.json(diag, {
    headers: { "Cache-Control": "no-store" },
  })
}
