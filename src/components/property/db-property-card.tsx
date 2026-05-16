"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { motion } from "framer-motion"
import {
  Bath, BedDouble, Heart, MapPin, Ruler, ShieldCheck, TrendingUp, Sparkles,
} from "lucide-react"
import type { PropertyListing } from "@/types/property"
import { formatCurrency } from "@/lib/properties"
import toast from "react-hot-toast"

interface PropertyCardProps {
  property: PropertyListing
  showOwner?: boolean
}

export function DbPropertyCard({ property, showOwner = false }: PropertyCardProps) {
  const [isFav, setIsFav] = useState(property.isFavorited ?? false)
  const [favLoading, setFavLoading] = useState(false)

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFavLoading(true)
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id }),
      })
      if (res.status === 401) { toast.error("Sign in to save properties"); return }
      const data = await res.json()
      if (data.success) {
        setIsFav(data.isFavorited)
        toast.success(data.isFavorited ? "Saved to favorites" : "Removed from favorites")
      }
    } catch {
      toast.error("Something went wrong")
    } finally {
      setFavLoading(false)
    }
  }

  const heroImage = property.images[0] ||
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80"

  const typeLabel: Record<string, string> = {
    APARTMENT: "Apartment", VILLA: "Villa", OFFICE: "Office", LAND: "Land",
    STUDIO: "Studio", PENTHOUSE: "Penthouse", PLOT: "Plot", COMMERCIAL: "Commercial",
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={`/property/${property.id}`} className="group block">
        <div className="overflow-hidden rounded-2xl border border-[#DCCDCE]/40 bg-white shadow-sm transition-all duration-300 hover:shadow-xl hover:border-[#D4AF37]/30">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={heroImage}
              alt={property.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/50 via-transparent to-transparent" />

            {/* Badges */}
            <div className="absolute left-3 top-3 flex gap-2">
              {property.featured && (
                <span className="flex items-center gap-1 rounded-full bg-[#D4AF37] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#1A0006]">
                  <Sparkles className="h-2.5 w-2.5" /> Featured
                </span>
              )}
              {property.verified && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  <ShieldCheck className="h-2.5 w-2.5" /> Verified
                </span>
              )}
            </div>

            {/* Type badge */}
            <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              {typeLabel[property.propertyType] ?? property.propertyType}
            </span>

            {/* Favorite */}
            <button
              onClick={handleFavorite}
              disabled={favLoading}
              className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
                isFav ? "bg-red-500 text-white" : "bg-white/20 text-white hover:bg-white/40"
              }`}
              aria-label="Toggle favorite"
            >
              <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
            </button>

            {/* Price overlay */}
            <div className="absolute bottom-3 left-3">
              <p className="text-lg font-bold text-white">{formatCurrency(property.price)}</p>
            </div>
          </div>

          {/* Info */}
          <div className="p-4">
            <h3 className="line-clamp-1 font-serif text-base font-bold text-[#50080E]">
              {property.title}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#72383D]/70">
              <MapPin className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span className="line-clamp-1">{property.location}</span>
            </div>

            <div className="mt-3 flex items-center gap-4 border-t border-[#DCCDCE]/30 pt-3 text-xs text-[#72383D]/60">
              {property.bedrooms > 0 && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" />{property.bedrooms} Beds
                </span>
              )}
              {property.bathrooms > 0 && (
                <span className="flex items-center gap-1">
                  <Bath className="h-3.5 w-3.5" />{property.bathrooms} Baths
                </span>
              )}
              <span className="flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />{property.area.toLocaleString("en-IN")} sq.ft
              </span>
              {property.roi > 0 && (
                <span className="ml-auto flex items-center gap-1 font-semibold text-emerald-600">
                  <TrendingUp className="h-3.5 w-3.5" />{property.roi}% ROI
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
