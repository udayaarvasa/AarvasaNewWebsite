import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

function replacePassword(url: string, newPasswordEncoded: string): string {
  return url.replace(/(postgresql:\/\/[^:]+:)[^@]+(@)/, `$1${newPasswordEncoded}$2`);
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  let rawUrlDiagnostics = "none";

  if (dbUrl) {
    const rawMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@/);
    if (rawMatch) {
      const rawPass = rawMatch[2];
      rawUrlDiagnostics = `length: ${rawPass.length}, contains $: ${rawPass.includes('$')}, contains %24: ${rawPass.includes('%24')}, contains %: ${rawPass.includes('%')}`;
    } else {
      rawUrlDiagnostics = "regex mismatch for password";
    }
  }

  const testCases = [
    { name: "default_env_url", url: dbUrl },
    { name: "password_no_special_char_Aarvasa2104", url: replacePassword(dbUrl, "Aarvasa2104") },
    { name: "password_double_encoded_Aarvasa2104%2524", url: replacePassword(dbUrl, "Aarvasa2104%2524") },
    { name: "password_literal_dollar_Aarvasa2104$", url: replacePassword(dbUrl, "Aarvasa2104$") },
    { name: "password_escaped_dollar_Aarvasa2104\\$", url: replacePassword(dbUrl, "Aarvasa2104\\$") }
  ];

  const results: any[] = [];
  let workingCase = "none";

  for (const testCase of testCases) {
    if (!testCase.url) {
      results.push({ name: testCase.name, status: "skipped (empty URL)" });
      continue;
    }

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
      results.push({
        name: testCase.name,
        status: "failed",
        error: error.message
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



