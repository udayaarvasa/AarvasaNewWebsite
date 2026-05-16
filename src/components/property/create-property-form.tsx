"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus } from "lucide-react"
import toast from "react-hot-toast"
import { createPropertySchema, type CreatePropertyInput } from "@/lib/validations/property"
import { ImageUploader } from "@/components/property/image-uploader"

const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "OFFICE", label: "Office" },
  { value: "LAND", label: "Land" },
  { value: "STUDIO", label: "Studio" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "PLOT", label: "Plot" },
  { value: "COMMERCIAL", label: "Commercial" },
]

const RISK_LEVELS = [
  { value: "LOW", label: "Low" },
  { value: "MODERATE", label: "Moderate" },
  { value: "BALANCED", label: "Balanced" },
  { value: "HIGH", label: "High" },
]

const AMENITIES_OPTIONS = [
  "Swimming Pool", "Gym", "Parking", "Garden", "Security", "Club House",
  "Power Backup", "Elevator", "Smart Home", "Terrace", "Balcony", "Fireplace",
]

const inputClass = "w-full rounded-xl border border-[#DCCDCE]/50 bg-white px-4 py-3 text-sm text-[#50080E] outline-none transition placeholder:text-[#72383D]/30 focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/10"
const labelClass = "mb-1.5 block text-sm font-medium text-[#50080E]/80"
const errorClass = "mt-1 text-xs text-red-500"

export function CreatePropertyForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePropertyInput>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: {
      country: "India",
      propertyType: "APARTMENT",
      bedrooms: 0,
      bathrooms: 0,
      roi: 0,
      featured: false,
      riskLevel: "MODERATE",
    },
  })

  const onSubmit = async (data: CreatePropertyInput) => {
    setLoading(true)
    try {
      const payload = { ...data, images, amenities: selectedAmenities }
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (result.success) {
        toast.success("Property created successfully!")
        router.push("/dashboard")
      } else {
        toast.error(typeof result.error === "string" ? result.error : "Validation error")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Basic Info */}
      <section className="rounded-2xl border border-[#DCCDCE]/40 bg-white p-6">
        <h3 className="mb-5 text-lg font-bold text-[#50080E]">Basic Information</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Property Title *</label>
            <input {...register("title")} placeholder="e.g. Luxury Villa in Goa" className={inputClass} />
            {errors.title && <p className={errorClass}>{errors.title.message}</p>}
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Description *</label>
            <textarea {...register("description")} rows={4} placeholder="Describe the property..." className={inputClass + " resize-none"} />
            {errors.description && <p className={errorClass}>{errors.description.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Property Type *</label>
            <select {...register("propertyType")} className={inputClass}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Price (₹) *</label>
            <input {...register("price", { valueAsNumber: true })} type="number" placeholder="50000000" className={inputClass} />
            {errors.price && <p className={errorClass}>{errors.price.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Area (sq.ft) *</label>
            <input {...register("area", { valueAsNumber: true })} type="number" placeholder="2500" className={inputClass} />
            {errors.area && <p className={errorClass}>{errors.area.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Expected ROI (%)</label>
            <input {...register("roi", { valueAsNumber: true })} type="number" step="0.1" placeholder="12.5" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bedrooms</label>
            <input {...register("bedrooms", { valueAsNumber: true })} type="number" placeholder="3" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Bathrooms</label>
            <input {...register("bathrooms", { valueAsNumber: true })} type="number" placeholder="2" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Risk Level</label>
            <select {...register("riskLevel")} className={inputClass}>
              {RISK_LEVELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="rounded-2xl border border-[#DCCDCE]/40 bg-white p-6">
        <h3 className="mb-5 text-lg font-bold text-[#50080E]">Location</h3>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Full Address / Location *</label>
            <input {...register("location")} placeholder="e.g. Sector 72, Cyber City" className={inputClass} />
            {errors.location && <p className={errorClass}>{errors.location.message}</p>}
          </div>
          <div>
            <label className={labelClass}>City *</label>
            <input {...register("city")} placeholder="e.g. Gurugram" className={inputClass} />
            {errors.city && <p className={errorClass}>{errors.city.message}</p>}
          </div>
          <div>
            <label className={labelClass}>State *</label>
            <input {...register("state")} placeholder="e.g. Haryana" className={inputClass} />
            {errors.state && <p className={errorClass}>{errors.state.message}</p>}
          </div>
        </div>
      </section>

      {/* Images */}
      <section className="rounded-2xl border border-[#DCCDCE]/40 bg-white p-6">
        <h3 className="mb-5 text-lg font-bold text-[#50080E]">Property Images</h3>
        <ImageUploader images={images} onChange={setImages} maxFiles={6} />
      </section>

      {/* Amenities */}
      <section className="rounded-2xl border border-[#DCCDCE]/40 bg-white p-6">
        <h3 className="mb-5 text-lg font-bold text-[#50080E]">Amenities</h3>
        <div className="flex flex-wrap gap-2">
          {AMENITIES_OPTIONS.map((amenity) => (
            <button
              key={amenity}
              type="button"
              onClick={() => toggleAmenity(amenity)}
              className={`rounded-full border px-4 py-2 text-xs font-medium transition ${
                selectedAmenities.includes(amenity)
                  ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#50080E]"
                  : "border-[#DCCDCE]/50 text-[#72383D]/60 hover:border-[#D4AF37]/40"
              }`}
            >
              {amenity}
            </button>
          ))}
        </div>
      </section>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#C5A028] py-4 text-sm font-bold text-[#50080E] shadow-lg shadow-[#D4AF37]/20 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        {loading ? "Creating Property..." : "Create Property Listing"}
      </button>
    </form>
  )
}
