import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth-context"

// GET /api/mobile/auth/me — current user; also serves as a token validity probe
// the app can call on launch to decide between the login and main flows.
export async function GET(req: Request) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        image: true,
        phone: true,
        bio: true,
        createdAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json({ success: true, user })
  } catch (err) {
    console.error("[GET /api/mobile/auth/me]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
