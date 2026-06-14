import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  let passwordDiagnostics = "none";
  let rawUrlDiagnostics = "none";

  if (dbUrl) {
    try {
      // Check the raw env string details
      const rawMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@/);
      if (rawMatch) {
        const rawPass = rawMatch[2];
        rawUrlDiagnostics = `length: ${rawPass.length}, contains $: ${rawPass.includes('$')}, contains %24: ${rawPass.includes('%24')}, contains %: ${rawPass.includes('%')}`;
      } else {
        rawUrlDiagnostics = "regex mismatch for password";
      }

      // Check the parsed URL password details
      const urlObj = new URL(dbUrl);
      const pass = urlObj.password;
      passwordDiagnostics = `length: ${pass.length}, contains $: ${pass.includes('$')}, contains %24: ${pass.includes('%24')}, contains %: ${pass.includes('%')}`;
    } catch (e: any) {
      passwordDiagnostics = `error parsing URL: ${e.message}`;
    }
  }

  const diag = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    databaseUrlLength: dbUrl.length,
    rawUrlDiagnostics,
    passwordDiagnostics,
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

