import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authRateLimited, AUTH_REFRESH_LIMIT } from "@/lib/rate-limit"
import { issueTokens, verifyMobileToken } from "@/lib/mobile-auth"
import { mobileRefreshSchema } from "@/lib/validations/auth"

// POST /api/mobile/auth/refresh — trade a refresh token for a fresh pair
export async function POST(req: Request) {
  try {
    if (authRateLimited(req, "auth:refresh", AUTH_REFRESH_LIMIT)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again shortly." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = mobileRefreshSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const claims = await verifyMobileToken(parsed.data.refreshToken, "refresh")
    if (!claims) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired refresh token" },
        { status: 401 }
      )
    }

    // Re-read the user rather than trusting the claims: this is the point where
    // a deleted account or a changed role takes effect on a long-lived session.
    const user = await prisma.user.findUnique({ where: { id: claims.sub } })
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired refresh token" },
        { status: 401 }
      )
    }

    const tokens = await issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    return NextResponse.json({
      success: true,
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        image: user.image,
        phone: user.phone,
      },
    })
  } catch (err) {
    console.error("[POST /api/mobile/auth/refresh]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
