import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/admin/users — list all users (admin only)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

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
