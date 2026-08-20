import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { getUserProperties, getPropertyStats } from "@/lib/services/property.service"

// GET /api/user/properties — authenticated user's listings + stats
export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const [properties, stats] = await Promise.all([
      getUserProperties(user.id),
      getPropertyStats(user.id),
    ])

    return NextResponse.json({ success: true, data: { properties, stats } })
  } catch (err) {
    console.error("[GET /api/user/properties]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
