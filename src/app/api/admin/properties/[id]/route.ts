import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { adminListingReviewSchema } from "@/lib/validations/property"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/properties/[id] — approve/verify/feature a property (admin only)
export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.response

    const { id } = await params
    // The only place a listing's status, verification or featuring changes —
    // including approving a PENDING listing by setting it ACTIVE.
    const parsed = adminListingReviewSchema.safeParse(await req.json())
    if (!parsed.success)
      return NextResponse.json({ success: false, error: "Invalid data" }, { status: 400 })

    const updated = await prisma.property.update({
      where: { id },
      data: parsed.data,
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
    const admin = await requireAdmin()
    if (!admin.ok) return admin.response

    const { id } = await params
    await prisma.property.delete({ where: { id } })
    return NextResponse.json({ success: true, message: "Property removed" })
  } catch (err) {
    console.error("[DELETE /api/admin/properties/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
