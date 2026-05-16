import { Suspense } from "react";
import { ListingExperience } from "@/components/property/listing-experience";
import { ListingsGrid } from "@/components/property/listings-grid";
import { PropertyGridSkeleton } from "@/components/property/property-skeleton";
import { Activity, BrainCircuit, Target } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Listings | Aarvasa",
  description: "Browse AI-curated real estate investment opportunities",
};

export default function ListingsPage() {
  return (
    <div className="min-h-screen bg-[#F5F1ED] overflow-x-hidden">
      
      {/* ── CINEMATIC HERO SECTION ── */}
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-24 overflow-hidden rounded-b-[3rem] border-b border-[#DCCDCE]/30 shadow-[0_10px_40px_rgba(80,8,14,0.05)] bg-[#FAF7F4] z-10">
        {/* Soft Ambient Backgrounds */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#F5F1ED] to-[#FAF7F4]" />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[#D4AF37]/5 blur-[80px] pointer-events-none mix-blend-multiply" />
        <div className="absolute top-20 -left-20 w-[500px] h-[500px] rounded-full bg-[#7A0019]/5 blur-[100px] pointer-events-none mix-blend-multiply" />
        
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-white/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] shadow-sm backdrop-blur-md">
                <BrainCircuit className="h-3.5 w-3.5" />
                Intelligence Active
              </div>
              
              <h1 className="heading-serif text-4xl tracking-tight text-[#4A0012] sm:text-5xl lg:text-6xl mb-4">
                Curated <span className="text-[#7A0019]">Intelligence</span>
              </h1>
              <p className="text-sm md:text-base leading-relaxed text-[#7A5C5C]">
                Institutional-grade real estate opportunities filtered by our proprietary AI. 
                Showing properties with highest predicted capital appreciation and rental yield.
              </p>
            </div>

            {/* AI Stats Row */}
            <div className="flex flex-wrap md:flex-nowrap gap-3 md:justify-end">
              <div className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white border border-[#DCCDCE]/40 shadow-sm min-w-[120px]">
                <Target className="h-4 w-4 text-[#D4AF37] mb-2" />
                <span className="text-lg font-black text-[#4A0012]">94%</span>
                <span className="text-[9px] uppercase tracking-wider font-semibold text-[#7A5C5C]">AI Accuracy</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-[#50080E] border border-[#7A0019] shadow-[0_4px_15px_rgba(80,8,14,0.15)] min-w-[120px]">
                <Activity className="h-4 w-4 text-[#D4AF37] mb-2" />
                <span className="text-lg font-black text-white">Live</span>
                <span className="text-[9px] uppercase tracking-wider font-semibold text-[#D4AF37]">ROI Modeling</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DATABASE-DRIVEN LISTINGS ── */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 relative z-0">
        <Suspense fallback={<PropertyGridSkeleton count={6} />}>
          <ListingsGrid />
        </Suspense>
      </section>
    </div>
  );
}
