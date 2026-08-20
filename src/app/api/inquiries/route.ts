import { NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth-context"
import { createInquiry } from "@/lib/services/property.service"
import { inquirySchema } from "@/lib/validations/property"

// POST /api/inquiries
export async function POST(req: Request) {
  try {
    const user = await getAuthUser(req)
    const body = await req.json()

    const parsed = inquirySchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )

    const inquiry = await createInquiry({
      ...parsed.data,
      userId: user?.id,
    })

    return NextResponse.json({ success: true, data: inquiry }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/inquiries]", err)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}
