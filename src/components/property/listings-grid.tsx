"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Building2 } from "lucide-react"
import { DbPropertyCard } from "@/components/property/db-property-card"
import { PropertyGridSkeleton } from "@/components/property/property-skeleton"
import { PropertyFilters } from "@/components/property/property-filters"
import type { PropertyListing } from "@/types/property"

export function ListingsGrid() {
  const searchParams = useSearchParams()
  const [properties, setProperties] = useState<PropertyListing[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchProperties = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams(searchParams.toString())
      if (!params.has("page")) params.set("page", "1")
      const res = await fetch(`/api/properties?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setProperties(data.properties)
        setTotal(data.total)
        setPage(data.page)
        setTotalPages(data.totalPages)
      }
    } catch (err) {
      console.error("Failed to fetch properties:", err)
    } finally {
      setLoading(false)
    }
  }, [searchParams])

  useEffect(() => {
    fetchProperties()
  }, [fetchProperties])

  return (
    <div className="space-y-8">
      <PropertyFilters />

      {/* Result count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#72383D]/60">
          {loading ? "Loading..." : `${total} ${total === 1 ? "property" : "properties"} found`}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <PropertyGridSkeleton count={6} />
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#DCCDCE]/30 bg-white py-20 text-center">
          <Building2 className="mb-4 h-12 w-12 text-[#DCCDCE]" />
          <h3 className="text-lg font-bold text-[#50080E]">No properties found</h3>
          <p className="mt-2 text-sm text-[#72383D]/50">
            Try adjusting your filters or search criteria.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <DbPropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`?${new URLSearchParams({
                ...Object.fromEntries(searchParams),
                page: p.toString(),
              }).toString()}`}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition ${
                p === page
                  ? "bg-[#D4AF37] text-[#1A0006] shadow"
                  : "border border-[#DCCDCE]/50 text-[#72383D]/60 hover:border-[#D4AF37]/40"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
