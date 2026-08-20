import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth-context"

// DELETE /api/mobile/auth/account — permanently delete the caller's account.
//
// Google Play and the App Store both require an in-app deletion path for any
// app that allows account creation.
//
// Related rows are handled by the schema: accounts, sessions, properties and
// favourites cascade; inquiries survive with userId set to null so the
// enquiry history of other parties stays intact.
export async function DELETE(req: Request) {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, password: true },
    })
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // A bearer token alone must not be enough to destroy an account, so
    // password holders have to re-enter it. OAuth and wallet accounts have no
    // password to check and are authorised by the token alone.
    if (user.password) {
      const body = await req.json().catch(() => ({}))
      const password = typeof body?.password === "string" ? body.password : ""

      if (!password) {
        return NextResponse.json(
          { success: false, error: "Enter your password to confirm deletion." },
          { status: 400 }
        )
      }
      if (!(await bcrypt.compare(password, user.password))) {
        return NextResponse.json(
          { success: false, error: "That password is incorrect." },
          { status: 403 }
        )
      }
    }

    await prisma.user.delete({ where: { id: user.id } })

    return NextResponse.json({
      success: true,
      message: "Your account and listings have been permanently deleted.",
    })
  } catch (err) {
    console.error("[DELETE /api/mobile/auth/account]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
