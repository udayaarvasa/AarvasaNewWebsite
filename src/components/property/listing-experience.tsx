"use client";

import { useMemo, useState } from "react";
import {
  Filter,
  Grid3X3,
  LayoutList,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PropertyCard } from "@/components/property/property-card";
import { properties } from "@/lib/properties";

const aiTraits = ["High Yield", "Pre-Market", "Rapid Growth Zone", "Historic Heritage"];

export function ListingExperience() {
  const [location, setLocation] = useState("");
  const [type, setType] = useState("Any");
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
      const matchesPrice = property.price <= Number(price || 0);
      const matchesRoi = property.roi >= Number(roi || 0);
      return matchesLocation && matchesType && matchesPrice && matchesRoi;
    });
  }, [location, price, roi, type]);

  function toggleTrait(trait: string) {
    setSelectedTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait],
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
      {/* Left sidebar */}
      <aside className="h-fit space-y-6 lg:sticky lg:top-24">
        {/* Map placeholder */}
        <div className="overflow-hidden rounded-2xl border border-[#DCCDCE]/40 bg-[#F5F4F1]">
          <div className="relative flex h-44 items-center justify-center bg-gradient-to-br from-[#DCCDCE]/30 via-[#F5F4F1] to-[#DCCDCE]/20">
            <div className="absolute inset-0 opacity-20">
              <svg viewBox="0 0 300 180" className="h-full w-full">
                <path d="M0,90 Q75,30 150,90 T300,90" stroke="#72383D" strokeWidth="1.5" fill="none" opacity="0.3" />
                <path d="M0,60 Q100,120 200,60 T300,60" stroke="#72383D" strokeWidth="1" fill="none" opacity="0.2" />
                <circle cx="120" cy="85" r="3" fill="#50080E" opacity="0.5" />
                <circle cx="200" cy="70" r="3" fill="#50080E" opacity="0.5" />
                <circle cx="80" cy="95" r="2" fill="#D4AF37" opacity="0.6" />
              </svg>
            </div>
            <MapPin className="h-6 w-6 text-[#50080E]/40" />
          </div>
          <button className="flex w-full items-center justify-center gap-2 border-t border-[#DCCDCE]/30 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#72383D] transition hover:bg-[#DCCDCE]/15">
            Expand Map
          </button>
        </div>

        {/* AI Filters panel */}
        <div className="rounded-2xl border border-[#DCCDCE]/40 bg-[#F5F4F1]/80 p-5 shadow-luxury-sm">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-sm font-bold text-[#50080E]">AI Filters</span>
          </div>

          <div className="space-y-4">
            {/* Region */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#72383D]/70">
                Region · Neighborhood
              </label>
              <div className="relative">
                <Input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Search areas..."
                  className="pr-8"
                />
                <MapPin className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#72383D]/40" />
              </div>
            </div>

            {/* Property Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#72383D]/70">
                Property Type
              </label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#DCCDCE]/50 bg-white px-3 text-sm text-[#50080E] outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
              >
                {["Any", "Villa", "Apartment", "Office", "Land"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            {/* Target ROI */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#72383D]/70">
                <TrendingUp className="h-3 w-3" />
                Target ROI
              </label>
              <div className="flex items-center gap-2 text-xs text-[#72383D]/60">
                <span>{roi}%</span>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={roi}
                  onChange={(e) => setRoi(e.target.value)}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[#DCCDCE]/50 accent-[#D4AF37]"
                />
                <span>18%+</span>
              </div>
            </div>

            {/* AI Suggested Traits */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#72383D]/70">
                AI Suggested Traits
              </label>
              <div className="flex flex-wrap gap-2">
                {aiTraits.map((trait) => (
                  <button
                    key={trait}
                    onClick={() => toggleTrait(trait)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                      selectedTraits.includes(trait)
                        ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#50080E]"
                        : "border-[#DCCDCE]/50 text-[#72383D]/70 hover:border-[#72383D]/30"
                    }`}
                  >
                    {trait}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" size="sm">
              <Filter className="h-3.5 w-3.5" />
              Apply Filters
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <section>
        {/* Results bar */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-[#72383D]/70">
            Showing{" "}
            <span className="font-semibold text-[#50080E]">{filtered.length}</span>{" "}
            properties matching your AI criteria.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-2 transition ${
                viewMode === "grid" ? "bg-[#50080E] text-white" : "text-[#72383D]/50 hover:bg-[#DCCDCE]/20"
              }`}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-2 transition ${
                viewMode === "list" ? "bg-[#50080E] text-white" : "text-[#72383D]/50 hover:bg-[#DCCDCE]/20"
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Property grid */}
        <div
          className={
            viewMode === "grid"
              ? "grid gap-6 md:grid-cols-2"
              : "grid gap-4 md:grid-cols-1"
          }
        >
          {filtered.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>

        {/* Load more */}
        {filtered.length > 0 && (
          <div className="mt-10 flex justify-center">
            <Button variant="outline" className="rounded-full border-[#50080E] px-8 text-xs font-bold uppercase tracking-wider text-[#50080E]">
              Load More Properties
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
