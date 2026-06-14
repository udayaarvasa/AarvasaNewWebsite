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

  let testUser: any = null;
  try {
    // Try querying the User table for the specific user
    const dbUser = await prisma.user.findUnique({
      where: { email: "anshdubey47@gmail.com" }
    })
    if (dbUser) {
      testUser = {
        exists: true,
        name: dbUser.name,
        email: dbUser.email,
        hasPassword: !!dbUser.password,
        passwordHashStart: dbUser.password ? dbUser.password.substring(0, 10) : null,
        role: dbUser.role
      }
    } else {
      testUser = { exists: false }
    }
    diag.dbConnectionStatus = "success"
  } catch (error: any) {
    diag.dbConnectionStatus = "failed"
    diag.dbError = {
      message: error.message,
      code: error.code,
      meta: error.meta
    }
  }

  return NextResponse.json({ ...diag, testUser })
}





