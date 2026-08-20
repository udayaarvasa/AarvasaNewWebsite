import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authRateLimited, AUTH_REGISTER_LIMIT } from "@/lib/rate-limit"
import { issueTokens } from "@/lib/mobile-auth"
import { mobileRegisterSchema } from "@/lib/validations/auth"

// POST /api/mobile/auth/register — create an account and return a token pair
//
// Mirrors /api/auth/signup, but signs the user straight in so the app doesn't
// have to make a second round trip after registration.
export async function POST(req: Request) {
  try {
    if (authRateLimited(req, "auth:register", AUTH_REGISTER_LIMIT)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again shortly." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = mobileRegisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { name, email, password, role } = parsed.data

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 12),
        role,
      },
    })

    const tokens = await issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[POST /api/mobile/auth/register]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
