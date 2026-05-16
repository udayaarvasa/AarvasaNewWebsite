"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Send } from "lucide-react"
import toast from "react-hot-toast"
import { inquirySchema, type InquiryInput } from "@/lib/validations/property"

const inputClass = "w-full rounded-xl border border-[#DCCDCE]/50 bg-white px-4 py-3 text-sm text-[#50080E] outline-none transition placeholder:text-[#72383D]/30 focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/10"

export function InquiryForm({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { propertyId },
  })

  const onSubmit = async (data: InquiryInput) => {
    setLoading(true)
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (result.success) {
        toast.success("Inquiry sent successfully!")
        setSubmitted(true)
        reset()
      } else {
        toast.error("Failed to send inquiry")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <Send className="h-6 w-6 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-emerald-800">Inquiry Sent!</h3>
        <p className="mt-2 text-sm text-emerald-600">
          We'll get back to you about <strong>{propertyTitle}</strong> shortly.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm font-medium text-emerald-700 underline"
        >
          Send another inquiry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("propertyId")} />
      <div>
        <input {...register("name")} placeholder="Your Name" className={inputClass} />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
      </div>
      <div>
        <input {...register("email")} type="email" placeholder="Your Email" className={inputClass} />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
      </div>
      <div>
        <input {...register("phone")} type="tel" placeholder="Phone (optional)" className={inputClass} />
      </div>
      <div>
        <textarea
          {...register("message")}
          rows={4}
          placeholder={`I'm interested in ${propertyTitle}. Please share more details...`}
          className={inputClass + " resize-none"}
        />
        {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message.message}</p>}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A028] py-3 text-sm font-bold text-[#50080E] shadow-lg shadow-[#D4AF37]/20 transition hover:shadow-xl disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {loading ? "Sending..." : "Send Inquiry"}
      </button>
    </form>
  )
}
