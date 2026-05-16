import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  getProperties,
  createProperty,
} from "@/lib/services/property.service"
import {
  createPropertySchema,
  propertyFiltersSchema,
} from "@/lib/validations/property"

// GET /api/properties — list with filters & pagination
export async function GET(req: Request) {
  try {
    const session = await auth()
    const { searchParams } = new URL(req.url)
    const raw = Object.fromEntries(searchParams)

    const parsed = propertyFiltersSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const result = await getProperties(parsed.data, session?.user?.id)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error("[GET /api/properties]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

// POST /api/properties — create (auth required)
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = createPropertySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const property = await createProperty(parsed.data, session.user.id)
    return NextResponse.json({ success: true, data: property }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/properties]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
