import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { authRateLimited, AUTH_LOGIN_LIMIT } from "@/lib/rate-limit"
import { issueTokens } from "@/lib/mobile-auth"
import { verifyGoogleIdToken } from "@/lib/google-token"
import { mobileGoogleSchema } from "@/lib/validations/auth"

// POST /api/mobile/auth/google — sign in with a Google ID token
//
// The client sends the token Google issued, never an email it decoded itself.
// The signature, issuer, audience and expiry are all checked here before any
// account is touched.
export async function POST(req: Request) {
  try {
    if (authRateLimited(req, "auth:google", AUTH_LOGIN_LIMIT)) {
      return NextResponse.json(
        { success: false, error: "Too many attempts. Please try again shortly." },
        { status: 429 }
      )
    }

    const body = await req.json()
    const parsed = mobileGoogleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const identity = await verifyGoogleIdToken(parsed.data.idToken)
    if (!identity) {
      return NextResponse.json(
        { success: false, error: "Google sign-in could not be verified." },
        { status: 401 }
      )
    }

    let user = await prisma.user.findUnique({ where: { email: identity.email } })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: identity.email,
          name: identity.name,
          image: identity.picture,
          // Google has confirmed the address, so treat it as verified. There
          // is no password: this account can only be reached through Google.
          emailVerified: new Date(),
          role: parsed.data.role,
        },
      })
    } else if (!user.image && identity.picture) {
      // Fill in a missing avatar, but never overwrite a name or role the user
      // has already set on their own account.
      user = await prisma.user.update({
        where: { id: user.id },
        data: { image: identity.picture },
      })
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
    console.error("[POST /api/mobile/auth/google]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
