import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updateUserSchema = z.object({
  role: z.enum(["USER", "AGENT", "BUILDER", "ADMIN"]).optional(),
})

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/users/[id] — update user role (admin only)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await req.json()
    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ success: false, error: "Invalid data" }, { status: 400 })

    const updated = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] — delete user (admin only)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    const { id } = await params

    // Prevent self-deletion
    if (id === session.user.id)
      return NextResponse.json({ success: false, error: "Cannot delete your own account" }, { status: 400 })

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "User deleted" })
  } catch (err) {
    console.error("[DELETE /api/admin/users/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
