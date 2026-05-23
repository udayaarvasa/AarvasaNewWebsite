import { handlers } from "@/auth"
import { NextRequest } from "next/server"

export const runtime = "nodejs"

const { GET: authGET, POST: authPOST } = handlers

export async function GET(req: NextRequest) {
  try {
    const res = await authGET(req)
    return res
  } catch (error) {
    console.error("NextAuth GET Route Handler Error:", error)
    return new Response(
      JSON.stringify({ 
        error: "Internal Server Error", 
        message: error instanceof Error ? error.message : "Authentication route crashed",
        code: "NEXTAUTH_GET_CRASH",
        stack: error instanceof Error ? error.stack : undefined
      }), 
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const res = await authPOST(req)
    return res
  } catch (error) {
    console.error("NextAuth POST Route Handler Error:", error)
    return new Response(
      JSON.stringify({ 
        error: "Internal Server Error", 
        message: error instanceof Error ? error.message : "Authentication route crashed",
        code: "NEXTAUTH_POST_CRASH",
        stack: error instanceof Error ? error.stack : undefined
      }), 
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    )
  }
}
