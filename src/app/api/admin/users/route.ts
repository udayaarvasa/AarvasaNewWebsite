import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"

// GET /api/admin/users — list all users (admin only)
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) return admin.response

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
        _count: {
          select: { properties: true, favorites: true, inquiries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      success: true,
      data: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    console.error("[GET /api/admin/users]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
