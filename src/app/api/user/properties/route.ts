import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getUserProperties, getPropertyStats } from "@/lib/services/property.service"

// GET /api/user/properties — authenticated user's listings + stats
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const [properties, stats] = await Promise.all([
      getUserProperties(session.user.id),
      getPropertyStats(session.user.id),
    ])

    return NextResponse.json({ success: true, data: { properties, stats } })
  } catch (err) {
    console.error("[GET /api/user/properties]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
