import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Bath, BedDouble, Heart, MapPin, Ruler, Sparkles, TrendingUp, ShieldCheck, Activity, BarChart3, BrainCircuit, CheckCircle2 } from "lucide-react";
import { type Property, formatCurrency } from "@/lib/properties";

export function PropertyCard({ property }: { property: Property }) {
  const liquidityScore = Math.min(99, Math.round(property.score * 0.8 + property.roi * 1.5));
  const rentalDemand = property.roi > 15 ? "High" : "Stable";
  const aiConfidence = property.score;

  return (
    <Link href={`/property/${property.id}`} className="group block h-full">
      <article className="flex flex-col h-full overflow-hidden rounded-[24px] border border-[#DCCDCE]/40 bg-[#FAF7F4] shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(80,8,14,0.08)] hover:border-[#D4AF37]/30">
        
        {/* ── IMAGE SECTION ── */}
        <div className="relative aspect-[4/3] overflow-hidden shrink-0">
          <Image
            src={property.images[0]}
            alt={property.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.07]"
          />
          {/* Cinematic Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#2a040b]/90 via-[#50080E]/20 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent opacity-60" />

          {/* Tags */}
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {property.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm ${
                  tag.includes("AI")
                    ? "bg-gradient-to-r from-[#D4AF37] to-[#F5D27A] text-[#2a040b] shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                    : "bg-white/80 text-[#50080E]"
                }`}
              >
                {tag.includes("AI") && <BrainCircuit className="h-3 w-3" />}
                {tag}
              </span>
            ))}
          </div>

          {/* Favorite button */}
          <button className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md transition-all hover:bg-white/40 hover:scale-110">
            <Heart className="h-4.5 w-4.5" />
          </button>

          {/* Price Overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#DCCDCE] mb-0.5 opacity-80 drop-shadow-md">Est. Value</p>
              <p className="text-2xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
                {formatCurrency(property.price)}
              </p>
            </div>
          </div>
        </div>

        {/* ── CONTENT SECTION ── */}
        <div className="flex flex-col flex-1 p-5 lg:p-6 bg-gradient-to-b from-[#FAF7F4] to-[#F5F1ED]">
          
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-[1.15rem] font-bold text-[#4A0012] leading-tight group-hover:text-[#7A0019] transition-colors">
                {property.title}
              </h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-[#7A5C5C]">
                <MapPin className="h-3 w-3 text-[#D4AF37]" />
                {property.location}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#50080E]/5 text-[#50080E] transition-all duration-300 group-hover:bg-[#50080E] group-hover:text-[#D4AF37] group-hover:shadow-[0_4px_12px_rgba(80,8,14,0.2)]">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          {/* ── AI INTELLIGENCE LAYER ── */}
          <div className="grid grid-cols-2 gap-3 mb-5 p-3.5 rounded-xl bg-white border border-[#DCCDCE]/40 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#50080E]/5">
                <BrainCircuit className="h-3.5 w-3.5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#7A5C5C] font-semibold">AI Match</p>
                <p className="text-xs font-bold text-[#4A0012]">{aiConfidence}% Confidence</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#50080E]/5">
                <TrendingUp className="h-3.5 w-3.5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#7A5C5C] font-semibold">Growth</p>
                <p className="text-xs font-bold text-[#4A0012]">{property.growth.split(' ')[0]}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#50080E]/5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#7A5C5C] font-semibold">Risk Level</p>
                <p className="text-xs font-bold text-[#4A0012]">{property.risk}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#50080E]/5">
                <Activity className="h-3.5 w-3.5 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#7A5C5C] font-semibold">Liquidity</p>
                <p className="text-xs font-bold text-[#4A0012]">{liquidityScore}/100</p>
              </div>
            </div>
          </div>

          {/* ── AI EXPLAINABILITY ── */}
          <div className="mb-5 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Why this property?
            </p>
            <ul className="space-y-1.5">
              <li className="text-[11px] text-[#7A5C5C] flex items-start gap-1.5 leading-snug">
                <CheckCircle2 className="h-3 w-3 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{rentalDemand} rental demand in {property.location.split(',')[0]}</span>
              </li>
              <li className="text-[11px] text-[#7A5C5C] flex items-start gap-1.5 leading-snug">
                <CheckCircle2 className="h-3 w-3 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{property.roi}% projected annualized ROI</span>
              </li>
              <li className="text-[11px] text-[#7A5C5C] flex items-start gap-1.5 leading-snug">
                <CheckCircle2 className="h-3 w-3 text-[#D4AF37] shrink-0 mt-0.5" />
                <span>{property.growth}</span>
              </li>
            </ul>
          </div>

          {/* Stats row */}
          <div className="mt-auto flex items-center gap-4 border-t border-[#DCCDCE]/40 pt-4 text-[11px] font-semibold text-[#7A5C5C]">
            {property.beds > 0 && (
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-3.5 w-3.5 text-[#D4AF37]" />
                {property.beds} Beds
              </span>
            )}
            {property.baths > 0 && (
              <span className="flex items-center gap-1.5">
                <Bath className="h-3.5 w-3.5 text-[#D4AF37]" />
                {property.baths} Baths
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-[#D4AF37]" />
              {property.sqft.toLocaleString("en-IN")} sq.ft
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
