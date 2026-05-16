import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

// GET /api/admin/stats — platform-wide statistics (admin only)
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    if ((session.user as any).role !== "ADMIN")
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })

    const [
      totalUsers,
      totalProperties,
      activeProperties,
      totalInquiries,
      totalFavorites,
      verifiedProperties,
      featuredProperties,
      usersByRole,
      recentProperties,
      recentUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.property.count({ where: { status: "ACTIVE" } }),
      prisma.inquiry.count(),
      prisma.favorite.count(),
      prisma.property.count({ where: { verified: true } }),
      prisma.property.count({ where: { featured: true } }),
      prisma.user.groupBy({ by: ["role"], _count: true }),
      prisma.property.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, city: true, price: true, createdAt: true },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
    ])

    // Calculate total portfolio value
    const portfolioAgg = await prisma.property.aggregate({
      _sum: { price: true },
      where: { status: "ACTIVE" },
    })

    return NextResponse.json({
      success: true,
      data: {
        totalUsers,
        totalProperties,
        activeProperties,
        totalInquiries,
        totalFavorites,
        verifiedProperties,
        featuredProperties,
        portfolioValue: portfolioAgg._sum.price || 0,
        usersByRole: Object.fromEntries(
          usersByRole.map((r) => [r.role, r._count])
        ),
        recentProperties: recentProperties.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        })),
        recentUsers: recentUsers.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
        })),
      },
    })
  } catch (err) {
    console.error("[GET /api/admin/stats]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
