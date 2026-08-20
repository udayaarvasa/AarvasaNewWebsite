import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { toggleFavorite, getUserFavorites } from "@/lib/services/property.service"
import { z } from "zod"

const bodySchema = z.object({ propertyId: z.string().min(1) })

// GET /api/favorites — get user's saved properties
export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const favorites = await getUserFavorites(user.id)
    return NextResponse.json({ success: true, data: favorites })
  } catch (err) {
    console.error("[GET /api/favorites]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

// POST /api/favorites — toggle favorite
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    if (!user)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = bodySchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ success: false, error: "Invalid property ID" }, { status: 400 })

    const result = await toggleFavorite(user.id, parsed.data.propertyId)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[POST /api/favorites]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
