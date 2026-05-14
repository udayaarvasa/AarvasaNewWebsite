"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter,
  Grid3X3,
  LayoutList,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldCheck,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyCard } from "@/components/property/property-card";
import { properties } from "@/lib/properties";

const aiTraits = ["High Yield", "Pre-Market", "Rapid Growth", "Metro Corridor", "Ultra Prime"];

export function ListingExperience() {
  const [location, setLocation] = useState("");
  const [type, setType] = useState("Any");
  const [risk, setRisk] = useState("Any");
  const [price, setPrice] = useState("100000000");
  const [roi, setRoi] = useState("0");
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    return properties.filter((property) => {
      const matchesLocation = property.location
        .toLowerCase()
        .includes(location.toLowerCase());
      const matchesType = type === "Any" || property.type === type;
      const matchesRisk = risk === "Any" || property.risk === risk;
      const matchesPrice = property.price <= Number(price || 0);
      const matchesRoi = property.roi >= Number(roi || 0);
      return matchesLocation && matchesType && matchesRisk && matchesPrice && matchesRoi;
    });
  }, [location, price, roi, type, risk]);

  function toggleTrait(trait: string) {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait],
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      {/* ── LEFT SIDEBAR ── */}
      <aside className="h-fit space-y-6 lg:sticky lg:top-24">
        
        {/* Map Placeholder / Heatmap */}
        <div className="group overflow-hidden rounded-[20px] border border-[#DCCDCE]/40 bg-white shadow-sm transition-all hover:shadow-md relative cursor-pointer">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D4AF37]/10 to-[#7A0019]/5 mix-blend-multiply opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative flex h-48 items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-30 group-hover:scale-105 transition-transform duration-700">
              <svg viewBox="0 0 300 180" className="h-full w-full">
                <path d="M-20,90 Q75,20 150,90 T320,90" stroke="#7A0019" strokeWidth="2" fill="none" opacity="0.4" />
                <path d="M-20,120 Q100,180 200,60 T320,100" stroke="#D4AF37" strokeWidth="1.5" fill="none" opacity="0.3" />
                
                {/* Glowing Heatmap Nodes */}
                <circle cx="120" cy="85" r="4" fill="#7A0019" className="animate-pulse" />
                <circle cx="120" cy="85" r="12" fill="#7A0019" opacity="0.2" className="animate-ping" />
                
                <circle cx="200" cy="70" r="3" fill="#D4AF37" />
                <circle cx="200" cy="70" r="10" fill="#D4AF37" opacity="0.2" className="animate-ping" style={{ animationDelay: '1s'}} />
                
                <circle cx="80" cy="115" r="3" fill="#50080E" />
              </svg>
            </div>
            
            <div className="flex flex-col items-center z-10 p-4 rounded-xl bg-white/60 backdrop-blur-md border border-white shadow-[0_4px_15px_rgba(0,0,0,0.05)]">
              <Activity className="h-5 w-5 text-[#7A0019] mb-1.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4A0012]">AI Market Heatmap</span>
              <span className="text-[9px] text-[#7A5C5C]">Live Demand Analysis</span>
            </div>
          </div>
        </div>

        {/* AI Filters Panel */}
        <div className="rounded-[20px] border border-[#DCCDCE]/40 bg-gradient-to-b from-white/90 to-[#FAF7F4]/90 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] backdrop-blur-xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D4AF37]" />
              <span className="text-sm font-bold text-[#4A0012]">Intelligence Filters</span>
            </div>
            <button className="text-[10px] uppercase tracking-wider font-semibold text-[#7A5C5C] hover:text-[#7A0019] transition">Clear</button>
          </div>

          <div className="space-y-6">
            {/* Region */}
            <div className="space-y-2.5">
              <label className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A5C5C]">
                Search Micro-Markets
              </label>
              <div className="relative">
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="e.g. Gurugram, Goa..."
                  className="pr-8 rounded-xl border-[#DCCDCE]/60 bg-white h-11 text-sm focus:border-[#D4AF37] focus:ring-[#D4AF37]/20 transition-all"
                />
                <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#DCCDCE]" />
              </div>
            </div>

            {/* Property Type & Risk Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A5C5C]">
                  Asset Type
                </label>
                <div className="relative">
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-[#DCCDCE]/60 bg-white px-3.5 text-xs font-medium text-[#4A0012] outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all cursor-pointer"
                  >
                    {["Any", "Villa", "Apartment", "Office", "Land"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A5C5C] pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2.5">
                <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A5C5C]">
                  Risk Profile
                </label>
                <div className="relative">
                  <select
                    value={risk}
                    onChange={(event) => setRisk(event.target.value)}
                    className="h-10 w-full appearance-none rounded-xl border border-[#DCCDCE]/60 bg-white px-3.5 text-xs font-medium text-[#4A0012] outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all cursor-pointer"
                  >
                    {["Any", "Low", "Moderate", "Balanced"].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7A5C5C] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Target ROI */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A5C5C]">
                  <TrendingUp className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Target Yield
                </label>
                <span className="rounded-md bg-[#50080E]/5 px-2 py-0.5 text-[10px] font-bold text-[#7A0019]">
                  {roi}%+
                </span>
              </div>
              <div className="relative pt-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={roi}
                  onChange={(e) => setRoi(e.target.value)}
                  className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[#DCCDCE]/50 [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#D4AF37] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(212,175,55,0.4)] transition-all hover:[&::-webkit-slider-thumb]:scale-110"
                />
              </div>
            </div>

            {/* AI Suggested Traits */}
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7A5C5C]">
                Intelligence Traits
              </label>
              <div className="flex flex-wrap gap-2">
                {aiTraits.map((trait) => (
                  <button
                    key={trait}
                    onClick={() => toggleTrait(trait)}
                    className={`rounded-lg border px-3 py-1.5 text-[10px] font-bold tracking-wide transition-all ${
                      selectedTraits.includes(trait)
                        ? "border-[#D4AF37] bg-gradient-to-br from-[#D4AF37]/10 to-[#D4AF37]/5 text-[#4A0012] shadow-sm"
                        : "border-[#DCCDCE]/50 bg-white/50 text-[#7A5C5C] hover:border-[#DCCDCE] hover:bg-white"
                    }`}
                  >
                    {trait}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full mt-4 h-11 rounded-xl bg-gradient-to-r from-[#50080E] to-[#7A0019] shadow-[0_4px_15px_rgba(80,8,14,0.15)] hover:shadow-[0_6px_20px_rgba(80,8,14,0.25)] transition-all hover:-translate-y-0.5">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Analyze Portfolio Match
            </Button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <section className="flex flex-col">
        {/* Results bar */}
        <div className="mb-6 flex items-center justify-between bg-white/40 p-2 rounded-2xl border border-[#DCCDCE]/30 backdrop-blur-sm">
          <p className="text-xs font-medium text-[#7A5C5C] pl-4">
            Showing{" "}
            <span className="font-bold text-[#4A0012]">{filtered.length}</span>{" "}
            curated assets
          </p>
          <div className="flex items-center gap-1.5 pr-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                viewMode === "grid" ? "bg-white shadow-sm border border-[#DCCDCE]/50 text-[#4A0012]" : "text-[#7A5C5C] hover:bg-white/60"
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
                viewMode === "list" ? "bg-white shadow-sm border border-[#DCCDCE]/50 text-[#4A0012]" : "text-[#7A5C5C] hover:bg-white/60"
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Property Grid with Framer Motion Stagger */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          className={
            viewMode === "grid"
              ? "grid gap-6 md:grid-cols-2"
              : "grid gap-6 md:grid-cols-1"
          }
        >
          <AnimatePresence>
            {filtered.map((property, index) => {
              // Make the first item larger if it's highly scored and in grid mode
              const isFeatured = viewMode === "grid" && index === 0 && property.score >= 90;
              
              return (
                <motion.div
                  key={property.id}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 30 },
                    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
                  }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={isFeatured ? "md:col-span-2" : ""}
                >
                  <PropertyCard property={property} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* Load more */}
        {filtered.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 flex justify-center pb-8"
          >
            <button className="group relative flex items-center gap-3 overflow-hidden rounded-full border border-[#DCCDCE]/60 bg-white/50 px-8 py-3.5 text-xs font-bold uppercase tracking-wider text-[#4A0012] backdrop-blur-md transition-all hover:border-[#D4AF37]/50 hover:bg-white hover:shadow-[0_8px_25px_rgba(212,175,55,0.1)]">
              <span className="relative z-10">Load More Intelligence</span>
              <ArrowRight className="h-4 w-4 relative z-10 transition-transform group-hover:translate-x-1 text-[#D4AF37]" />
              {/* Hover glow effect inside button */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
            </button>
          </motion.div>
        )}
      </section>
    </div>
  );
}
