"use client"

import { useCallback, useState } from "react"
import Image from "next/image"
import { Upload, X, Loader2 } from "lucide-react"
import toast from "react-hot-toast"

interface ImageUploaderProps {
  images: string[]
  onChange: (urls: string[]) => void
  maxFiles?: number
}

export function ImageUploader({ images, onChange, maxFiles = 6 }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const uploadFiles = useCallback(async (files: File[]) => {
    if (images.length + files.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} images allowed`)
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`)
          continue
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 5MB)`)
          continue
        }
        formData.append("files", file)
      }

      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()

      if (data.success && data.urls) {
        onChange([...images, ...data.urls])
        toast.success(`${data.urls.length} image(s) uploaded`)
      } else {
        toast.error(data.error || "Upload failed")
      }
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }, [images, maxFiles, onChange])

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) uploadFiles(files)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all cursor-pointer ${
          dragActive
            ? "border-[#D4AF37] bg-[#D4AF37]/5"
            : "border-[#DCCDCE]/50 hover:border-[#D4AF37]/40 hover:bg-[#F5F4F1]"
        }`}
        onClick={() => {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = "image/*"
          input.multiple = true
          input.onchange = (e) => {
            const files = Array.from((e.target as HTMLInputElement).files || [])
            if (files.length) uploadFiles(files)
          }
          input.click()
        }}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
        ) : (
          <Upload className="h-8 w-8 text-[#D4AF37]/60" />
        )}
        <p className="mt-3 text-sm font-medium text-[#50080E]">
          {uploading ? "Uploading..." : "Click or drag images here"}
        </p>
        <p className="mt-1 text-xs text-[#72383D]/50">
          {images.length}/{maxFiles} images · Max 5MB each · JPG, PNG, WebP
        </p>
      </div>

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {images.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-[#DCCDCE]/30">
              <Image src={url} alt={`Upload ${i + 1}`} fill className="object-cover" sizes="120px" />
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(i) }}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
