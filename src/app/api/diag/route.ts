import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const diag = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    dbConnectionStatus: "untested",
    dbError: null as any
  }

  try {
    // Try a simple raw query to test database connectivity
    await prisma.$queryRaw`SELECT 1`
    diag.dbConnectionStatus = "success"
  } catch (error: any) {
    diag.dbConnectionStatus = "failed"
    diag.dbError = {
      message: error.message,
      code: error.code,
      meta: error.meta
    }
  }

  return NextResponse.json(diag)
}





