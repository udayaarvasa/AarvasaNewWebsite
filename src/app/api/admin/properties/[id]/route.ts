import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/properties/[id] — verify/feature/remove property (admin only)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    const { id } = await params
    const body = await req.json()

    // Admin can toggle verified, featured, and status
    const data: Record<string, any> = {}
    if (typeof body.verified === "boolean") data.verified = body.verified
    if (typeof body.featured === "boolean") data.featured = body.featured
    if (body.status) data.status = body.status

    const updated = await prisma.property.update({
      where: { id },
      data,
      select: {
        id: true,
        title: true,
        verified: true,
        featured: true,
        status: true,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error("[PATCH /api/admin/properties/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/admin/properties/[id] — force-remove property (admin only)
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    const { id } = await params
    await prisma.property.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Property removed" })
  } catch (err) {
    console.error("[DELETE /api/admin/properties/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
