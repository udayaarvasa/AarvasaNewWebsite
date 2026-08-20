import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authRateLimited, AUTH_LOGIN_LIMIT } from "@/lib/rate-limit"
import { issueTokens } from "@/lib/mobile-auth"
import { mobileLoginSchema } from "@/lib/validations/auth"

// POST /api/mobile/auth/login — exchange credentials for a token pair
export async function POST(req: Request) {
  try {
    if (authRateLimited(req, "auth:login", AUTH_LOGIN_LIMIT)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again shortly." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = mobileLoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })

    // `password` is null for Google and wallet accounts — those cannot log in
    // through this endpoint. Fold that into the same generic failure so the
    // response never reveals whether an email is registered.
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password" },
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
    console.error("[POST /api/mobile/auth/login]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
