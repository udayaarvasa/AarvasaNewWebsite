"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save, ArrowLeft } from "lucide-react"
import toast from "react-hot-toast"
import Link from "next/link"
import { updatePropertySchema } from "@/lib/validations/property"
import { ImageUploader } from "@/components/property/image-uploader"
import type { PropertyListing } from "@/types/property"

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

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SOLD", label: "Sold" },
  { value: "RENTED", label: "Rented" },
  { value: "PENDING", label: "Pending" },
]

const AMENITIES_OPTIONS = [
  "Swimming Pool", "Gym", "Parking", "Garden", "Security", "Club House",
  "Power Backup", "Elevator", "Smart Home", "Terrace", "Balcony", "Fireplace",
]

const inputClass = "w-full rounded-xl border border-[#DCCDCE]/50 bg-white px-4 py-3 text-sm text-[#50080E] outline-none transition placeholder:text-[#72383D]/30 focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/10"
const labelClass = "mb-1.5 block text-sm font-medium text-[#50080E]/80"
const errorClass = "mt-1 text-xs text-red-500"

interface EditPropertyFormProps {
  propertyId: string
}

export function EditPropertyForm({ propertyId }: EditPropertyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [images, setImages] = useState<string[]>([])
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(updatePropertySchema),
  })

  // Fetch existing property data
  useEffect(() => {
    async function fetchProperty() {
      try {
        const res = await fetch(`/api/properties/${propertyId}`)
        const data = await res.json()
        if (data.success && data.data) {
          const p: PropertyListing = data.data
          reset({
            title: p.title,
            description: p.description,
            price: p.price,
            location: p.location,
            city: p.city,
            state: p.state,
            country: p.country,
            propertyType: p.propertyType,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
            area: p.area,
            roi: p.roi,
            featured: p.featured,
            riskLevel: p.riskLevel,
            status: p.status,
          })
          setImages(p.images || [])
          setSelectedAmenities(p.amenities || [])
        } else {
          toast.error("Property not found")
          router.push("/dashboard")
        }
      } catch {
        toast.error("Failed to load property")
        router.push("/dashboard")
      } finally {
        setFetching(false)
      }
    }
    fetchProperty()
  }, [propertyId, reset, router])

  const onSubmit = async (data: any) => {
    setLoading(true)
    try {
      const payload = { ...data, images, amenities: selectedAmenities }
      const res = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (result.success) {
        toast.success("Property updated successfully!")
        router.push("/dashboard")
      } else {
        toast.error(typeof result.error === "string" ? result.error : "Update failed")
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

  if (fetching) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm text-[#72383D]/60 transition hover:text-[#50080E]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="heading-serif text-3xl text-[#50080E] sm:text-4xl">
          Edit Property
        </h1>
        <p className="mt-2 text-sm text-[#72383D]/60">
          Update your property listing details.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
          {/* Basic Info */}
          <section className="rounded-2xl border border-[#DCCDCE]/40 bg-white p-6">
            <h3 className="mb-5 text-lg font-bold text-[#50080E]">Basic Information</h3>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Property Title *</label>
                <input {...register("title")} placeholder="e.g. Luxury Villa in Goa" className={inputClass} />
                {errors.title && <p className={errorClass}>{errors.title.message as string}</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Description *</label>
                <textarea {...register("description")} rows={4} placeholder="Describe the property..." className={inputClass + " resize-none"} />
                {errors.description && <p className={errorClass}>{errors.description.message as string}</p>}
              </div>
              <div>
                <label className={labelClass}>Property Type *</label>
                <select {...register("propertyType")} className={inputClass}>
                  {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select {...register("status")} className={inputClass}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Price (₹) *</label>
                <input {...register("price", { valueAsNumber: true })} type="number" placeholder="50000000" className={inputClass} />
                {errors.price && <p className={errorClass}>{errors.price.message as string}</p>}
              </div>
              <div>
                <label className={labelClass}>Area (sq.ft) *</label>
                <input {...register("area", { valueAsNumber: true })} type="number" placeholder="2500" className={inputClass} />
                {errors.area && <p className={errorClass}>{errors.area.message as string}</p>}
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
                {errors.location && <p className={errorClass}>{errors.location.message as string}</p>}
              </div>
              <div>
                <label className={labelClass}>City *</label>
                <input {...register("city")} placeholder="e.g. Gurugram" className={inputClass} />
                {errors.city && <p className={errorClass}>{errors.city.message as string}</p>}
              </div>
              <div>
                <label className={labelClass}>State *</label>
                <input {...register("state")} placeholder="e.g. Haryana" className={inputClass} />
                {errors.state && <p className={errorClass}>{errors.state.message as string}</p>}
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
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {loading ? "Saving Changes..." : "Update Property"}
          </button>
        </form>
      </div>
    </div>
  )
}
