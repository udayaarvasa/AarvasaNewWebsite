import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/admin/properties — list all properties (admin only)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

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
