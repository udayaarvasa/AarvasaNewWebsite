import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { changeListingStatus } from "@/lib/services/property.service"
import { ownerListingActionSchema } from "@/lib/validations/property"

type Params = { params: Promise<{ id: string }> }

// POST /api/properties/[id]/status — owner's own status change (withdraw, sold, rented, resubmit)
export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getAuthUser(req)
    if (!user)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const parsed = ownerListingActionSchema.safeParse(await req.json())
    if (!parsed.success)
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })

    const { id } = await params
    const result = await changeListingStatus(id, parsed.data.action, user.id)
    if ("error" in result)
      return NextResponse.json({ success: false, error: result.error }, { status: result.status })

    return NextResponse.json({ success: true, data: result.data })
  } catch (err) {
    console.error("[POST /api/properties/[id]/status]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
