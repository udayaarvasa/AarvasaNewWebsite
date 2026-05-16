import { NextResponse } from "next/server"
import { auth } from "@/auth"

// POST /api/upload — Cloudinary upload
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll("files") as File[]

    if (!files || files.length === 0)
      return NextResponse.json({ success: false, error: "No files provided" }, { status: 400 })

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        { success: false, error: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET in .env" },
        { status: 500 }
      )
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString("base64")
      const dataUri = `data:${file.type};base64,${base64}`

      const uploadData = new FormData()
      uploadData.append("file", dataUri)
      uploadData.append("upload_preset", uploadPreset)
      uploadData.append("folder", "aarvasa/properties")

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: uploadData }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || "Upload failed")
      }

      const data = await response.json()
      uploadedUrls.push(data.secure_url)
    }

    return NextResponse.json({ success: true, urls: uploadedUrls })
  } catch (err: any) {
    console.error("[POST /api/upload]", err)
    return NextResponse.json(
      { success: false, error: err.message || "Upload failed" },
      { status: 500 }
    )
  }
}
