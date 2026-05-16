"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"

const PROPERTY_TYPES = [
  { value: "", label: "All Types" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "OFFICE", label: "Office" },
  { value: "LAND", label: "Land" },
  { value: "STUDIO", label: "Studio" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "PLOT", label: "Plot" },
  { value: "COMMERCIAL", label: "Commercial" },
]

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "roi_desc", label: "ROI: Highest" },
  { value: "featured", label: "Featured" },
]

const CITIES = [
  "", "Mumbai", "Delhi", "Bengaluru", "Pune", "Gurugram", "Goa", "Hyderabad", "Chennai",
]

export function PropertyFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const current = {
    search: searchParams.get("search") || "",
    city: searchParams.get("city") || "",
    propertyType: searchParams.get("propertyType") || "",
    sortBy: searchParams.get("sortBy") || "newest",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
    bedrooms: searchParams.get("bedrooms") || "",
    verified: searchParams.get("verified") || "",
  }

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete("page") // reset pagination on filter change
      router.push(`/listings?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearAll = () => router.push("/listings")

  const hasFilters = Object.values(current).some((v) => v && v !== "newest")

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#D4AF37]" />
          <input
            type="text"
            placeholder="Search city, location, property name..."
            defaultValue={current.search}
            onKeyDown={(e) => {
              if (e.key === "Enter") update("search", (e.target as HTMLInputElement).value)
            }}
            className="w-full rounded-xl border border-[#DCCDCE]/50 bg-white py-3 pl-11 pr-4 text-sm text-[#50080E] outline-none transition-all placeholder:text-[#72383D]/40 focus:border-[#D4AF37]/50 focus:ring-2 focus:ring-[#D4AF37]/10"
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-xl border border-[#DCCDCE]/50 bg-white px-4 text-xs font-medium text-[#72383D]/70 transition hover:border-red-300 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#72383D]/50">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
        </div>

        <select
          value={current.city}
          onChange={(e) => update("city", e.target.value)}
          className="rounded-lg border border-[#DCCDCE]/50 bg-white px-3 py-2 text-xs text-[#50080E] outline-none focus:border-[#D4AF37]/50"
        >
          <option value="">All Cities</option>
          {CITIES.filter(Boolean).map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <select
          value={current.propertyType}
          onChange={(e) => update("propertyType", e.target.value)}
          className="rounded-lg border border-[#DCCDCE]/50 bg-white px-3 py-2 text-xs text-[#50080E] outline-none focus:border-[#D4AF37]/50"
        >
          {PROPERTY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>

        <select
          value={current.sortBy}
          onChange={(e) => update("sortBy", e.target.value)}
          className="rounded-lg border border-[#DCCDCE]/50 bg-white px-3 py-2 text-xs text-[#50080E] outline-none focus:border-[#D4AF37]/50"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={current.bedrooms}
          onChange={(e) => update("bedrooms", e.target.value)}
          className="rounded-lg border border-[#DCCDCE]/50 bg-white px-3 py-2 text-xs text-[#50080E] outline-none focus:border-[#D4AF37]/50"
        >
          <option value="">Any Beds</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}+ Beds</option>
          ))}
        </select>

        <label className="flex items-center gap-2 rounded-lg border border-[#DCCDCE]/50 bg-white px-3 py-2 text-xs text-[#50080E] cursor-pointer">
          <input
            type="checkbox"
            checked={current.verified === "true"}
            onChange={(e) => update("verified", e.target.checked ? "true" : "")}
            className="accent-[#D4AF37]"
          />
          Verified only
        </label>
      </div>
    </div>
  )
}
