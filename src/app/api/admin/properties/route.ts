import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"

// GET /api/admin/properties — list all properties (admin only)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.response

    const properties = await prisma.property.findMany({
      select: {
        id: true,
        title: true,
        price: true,
        city: true,
        propertyType: true,
        status: true,
        verified: true,
        featured: true,
        createdAt: true,
        owner: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { favorites: true, inquiries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: properties.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error("[GET /api/admin/properties]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
