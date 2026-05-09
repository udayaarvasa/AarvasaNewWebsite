import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Bath, BedDouble, Heart, MapPin, Ruler, Sparkles, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type Property, formatCurrency } from "@/lib/properties";

export function PropertyCard({ property }: { property: Property }) {
  return (
    <Link href={`/property/${property.id}`} className="group block">
      <article className="overflow-hidden rounded-2xl border border-[#DCCDCE]/40 bg-white shadow-luxury-sm transition duration-300 hover:-translate-y-1 hover:shadow-luxury">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={property.images[0]}
            alt={property.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/60 via-[#50080E]/10 to-transparent" />

          {/* Tags */}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {property.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-xl ${
                  tag.includes("AI")
                    ? "bg-[#D4AF37]/90 text-[#50080E]"
                    : "bg-white/80 text-[#50080E]"
                }`}
              >
                {tag.includes("AI") && "✦ "}
                {tag}
              </span>
            ))}
          </div>

          {/* Favorite button */}
          <button className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xl transition hover:bg-white/40">
            <Heart className="h-4 w-4" />
          </button>

          {/* ROI + Price overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-emerald-300/30 bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-100 backdrop-blur-xl">
                ROI: {property.roi}%
              </span>
              <span className="rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/20 px-2 py-1 text-[10px] font-bold text-[#F5D27A] backdrop-blur-xl">
                Score: {property.score}/100
              </span>
            </div>
            <p className="text-xl font-bold text-white drop-shadow-lg">
              {formatCurrency(property.price)}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#50080E]">
                {property.title}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#72383D]/60">
                <MapPin className="h-3 w-3 text-[#D4AF37]" />
                {property.location}
              </p>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-[#72383D]/30 transition group-hover:text-[#D4AF37]" />
          </div>

          {/* Stats row */}
          <div className="mt-3 flex items-center gap-4 border-t border-[#DCCDCE]/30 pt-3 text-[11px] text-[#72383D]/60">
            {property.beds > 0 && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 text-[#72383D]/40" />
                {property.beds} Beds
              </span>
            )}
            {property.baths > 0 && (
              <span className="flex items-center gap-1">
                <Bath className="h-3.5 w-3.5 text-[#72383D]/40" />
                {property.baths} Baths
              </span>
            )}
            <span className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5 text-[#72383D]/40" />
              {property.sqft.toLocaleString("en-IN")} sq.ft
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
