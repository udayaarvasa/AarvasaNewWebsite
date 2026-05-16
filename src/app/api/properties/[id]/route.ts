import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  getPropertyById,
  updateProperty,
  deleteProperty,
} from "@/lib/services/property.service"
import { updatePropertySchema } from "@/lib/validations/property"

type Params = { params: Promise<{ id: string }> }

// GET /api/properties/[id]
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth()
    const { id } = await params
    const property = await getPropertyById(id, session?.user?.id)

    if (!property)
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 })

    return NextResponse.json({ success: true, data: property })
  } catch (err) {
    console.error("[GET /api/properties/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

// PATCH /api/properties/[id]
export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await req.json()
    const parsed = updatePropertySchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )

    const result = await updateProperty(id, parsed.data, session.user.id, session.user.role)
    if ("error" in result)
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })

    return NextResponse.json({ success: true, data: result.data })
  } catch (err) {
    console.error("[PATCH /api/properties/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/properties/[id]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const result = await deleteProperty(id, session.user.id, session.user.role)
    if ("error" in result)
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })

    return NextResponse.json({ success: true, message: "Property deleted" })
  } catch (err) {
    console.error("[DELETE /api/properties/[id]]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
