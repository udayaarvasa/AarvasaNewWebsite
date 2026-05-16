import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import bcrypt from "bcryptjs"

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  bio: z.string().max(500).optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

// GET /api/user/profile — get current user profile
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        phone: true,
        bio: true,
        createdAt: true,
        _count: {
          select: {
            properties: true,
            favorites: true,
            inquiries: true,
          },
        },
      },
    })

    if (!user)
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        createdAt: user.createdAt.toISOString(),
      },
    })
  } catch (err) {
    console.error("[GET /api/user/profile]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

// PATCH /api/user/profile — update profile details
export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json()

    // Handle password change separately
    if (body.currentPassword && body.newPassword) {
      const parsed = changePasswordSchema.safeParse(body)
      if (!parsed.success)
        return NextResponse.json(
          { success: false, error: parsed.error.flatten().fieldErrors },
          { status: 400 }
        )

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
      })

      if (!user?.password)
        return NextResponse.json(
          { success: false, error: "Cannot change password for OAuth accounts" },
          { status: 400 }
        )

      const isValid = await bcrypt.compare(parsed.data.currentPassword, user.password)
      if (!isValid)
        return NextResponse.json(
          { success: false, error: "Current password is incorrect" },
          { status: 400 }
        )

      const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 12)
      await prisma.user.update({
        where: { id: session.user.id },
        data: { password: hashedPassword },
      })

      return NextResponse.json({ success: true, message: "Password updated" })
    }

    // Handle profile update
    const parsed = updateProfileSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        phone: true,
        bio: true,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error("[PATCH /api/user/profile]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
