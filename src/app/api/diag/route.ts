import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

function buildDbUrl(username: string, passwordEncoded: string, hostPortDb: string, ssl: string): string {
  return `postgresql://${username}:${passwordEncoded}@${hostPortDb}${ssl}`;
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  let rawUrlDiagnostics = "none";
  let hostPortDb = "database-1.cqpc8oe8w8lz.us-east-1.rds.amazonaws.com:5432/postgres";
  let ssl = "?sslmode=require";

  if (dbUrl) {
    const rawMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^?]+)(.*)/);
    if (rawMatch) {
      const rawUser = rawMatch[1];
      const rawPass = rawMatch[2];
      hostPortDb = rawMatch[3];
      ssl = rawMatch[4];
      rawUrlDiagnostics = `username: ${rawUser}, passLength: ${rawPass.length}, contains $: ${rawPass.includes('$')}, contains %24: ${rawPass.includes('%24')}`;
    } else {
      rawUrlDiagnostics = "regex mismatch for raw URL";
    }
  }

  const usernames = ["postgres", "aarvasa", "udayaarvasa", "admin", "ansh"];
  const passwordsEncoded = ["Aarvasa2104%24", "Aarvasa2104"];

  const testCases: any[] = [];
  for (const username of usernames) {
    for (const passEncoded of passwordsEncoded) {
      testCases.push({
        name: `${username} + password:${passEncoded === "Aarvasa2104%24" ? "Aarvasa2104$" : "Aarvasa2104"}`,
        url: buildDbUrl(username, passEncoded, hostPortDb, ssl)
      });
    }
  }

  const results: any[] = [];
  let workingCase = "none";

  for (const testCase of testCases) {
    const testClient = new PrismaClient({
      datasources: {
        db: {
          url: testCase.url
        }
      }
    });

    try {
      await testClient.$queryRaw`SELECT 1`;
      results.push({ name: testCase.name, status: "success" });
      workingCase = testCase.name;
    } catch (error: any) {
      // Keep error message short and descriptive
      const msg = error.message;
      let shortError = "Unknown error";
      if (msg.includes("Authentication failed")) {
        shortError = "Authentication failed (invalid credentials)";
      } else if (msg.includes("invalid port number")) {
        shortError = "Connection string error (invalid port/characters)";
      } else if (msg.includes("Can't reach database server")) {
        shortError = "Can't reach database server";
      } else {
        shortError = msg.split("\n").filter((l: string) => l.trim().length > 0)[0] || msg;
      }
      results.push({
        name: testCase.name,
        status: "failed",
        error: shortError
      });
    } finally {
      await testClient.$disconnect();
    }
  }

  return NextResponse.json({
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    rawUrlDiagnostics,
    workingCase,
    results
  });
}




