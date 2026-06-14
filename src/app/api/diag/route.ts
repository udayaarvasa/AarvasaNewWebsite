import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function GET(req: Request) {
  const diag = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    dbConnectionStatus: "untested",
    dbError: null as any
  }

  const { searchParams } = new URL(req.url);
  const testPassword = searchParams.get("p") || "";
  const deleteUser = searchParams.get("deleteUser") === "true";

  let testUser: any = null;
  try {
    if (deleteUser) {
      await prisma.user.delete({
        where: { email: "anshdubey47@gmail.com" }
      }).catch(() => {})
    }

    // Try querying the User table for the specific user
    const dbUser = await prisma.user.findUnique({
      where: { email: "anshdubey47@gmail.com" }
    })
    if (dbUser) {
      let passwordMatch = false;
      if (testPassword && dbUser.password) {
        passwordMatch = await bcrypt.compare(testPassword, dbUser.password);
      }
      testUser = {
        exists: true,
        name: dbUser.name,
        email: dbUser.email,
        hasPassword: !!dbUser.password,
        passwordHashStart: dbUser.password ? dbUser.password.substring(0, 10) : null,
        passwordTested: !!testPassword,
        passwordMatch,
        role: dbUser.role
      }
    } else {
      testUser = { exists: false, message: deleteUser ? "User deleted successfully" : "User does not exist" }
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





