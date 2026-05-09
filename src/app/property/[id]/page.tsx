import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Brain,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Heart,
  Map,
  MapPin,
  Maximize,
  Ruler,
  Share2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RoiChart } from "@/components/roi-chart";
import { formatCurrency, getProperty, properties } from "@/lib/properties";

export function generateStaticParams() {
  return properties.map((property) => ({ id: property.id }));
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const property = getProperty(id);

  if (!property) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      {/* Full-width cinematic hero */}
      <section className="relative h-[55vh] min-h-[420px] w-full overflow-hidden">
        <Image
          src={property.images[0]}
          alt={property.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/80 via-[#50080E]/20 to-transparent" />

        {/* Hero content */}
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" className="mb-4 text-white/70 hover:text-white hover:bg-white/10">
            <Link href="/listings">
              <ArrowLeft className="h-4 w-4" />
              Back to listings
            </Link>
          </Button>
          <h1 className="heading-serif text-4xl text-white sm:text-5xl lg:text-6xl">
            {property.title}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <MapPin className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-sm text-white/80">{property.location}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="absolute right-6 top-24 z-10 flex gap-2">
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xl transition hover:bg-white/30">
            <Heart className="h-5 w-5" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xl transition hover:bg-white/30">
            <Share2 className="h-5 w-5" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xl transition hover:bg-white/30">
            <Maximize className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Stats row + Quick actions */}
      <section className="border-b border-[#DCCDCE]/40 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-8 px-4 py-5 sm:px-6 lg:px-8">
          <div className="border-r border-[#DCCDCE]/40 pr-8">
            <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Price</p>
            <p className="text-2xl font-bold text-[#50080E]">{formatCurrency(property.price)}</p>
          </div>
          <div className="border-r border-[#DCCDCE]/40 pr-8">
            <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Est. ROI</p>
            <p className="text-2xl font-bold text-[#50080E]">{property.roi}%</p>
          </div>
          <div className="border-r border-[#DCCDCE]/40 pr-8">
            <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Area</p>
            <p className="text-2xl font-bold text-[#50080E]">{property.sqft.toLocaleString("en-IN")} <span className="text-sm font-normal text-[#72383D]/60">sq.ft</span></p>
          </div>
          <div className="pr-8">
            <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Status</p>
            <p className="text-2xl font-bold text-emerald-600">Active</p>
          </div>

          {/* Right-side action card */}
          <div className="ml-auto flex items-center gap-4 rounded-2xl border border-[#DCCDCE]/40 bg-[#F5F4F1] p-4">
            <div>
              <p className="text-xl font-bold text-[#50080E]">
                {formatCurrency(Math.round(property.price / 12))}
              </p>
              <p className="text-xs text-[#72383D]/60">per month · EMI estimate</p>
            </div>
            <Button variant="gold" size="sm" className="rounded-lg">
              <Calculator className="h-4 w-4" />
              Calculate
            </Button>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Immersive Experience */}
        <section className="mb-14">
          <h2 className="heading-serif mb-6 text-3xl text-[#50080E]">
            Immersive Experience
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {property.images.slice(1).map((src, i) => (
              <div
                key={src}
                className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#DCCDCE]/30"
              >
                <Image
                  src={src}
                  alt={`${property.title} - View ${i + 2}`}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/30 to-transparent opacity-0 transition group-hover:opacity-100" />
              </div>
            ))}
          </div>
        </section>

        {/* Investment Intelligence */}
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="heading-serif mb-6 text-3xl text-[#50080E]">
              Investment Intelligence
            </h2>
            <Card className="border-[#DCCDCE]/40 bg-white p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Annual Return Projection</p>
                  <div className="mt-1 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-600">{property.growth}</span>
                  </div>
                </div>
                <Badge variant="success">{property.growth}</Badge>
              </div>
              <RoiChart data={property.roiSeries} />
              <p className="mt-4 text-xs leading-relaxed text-[#72383D]/70">
                {property.summary}
              </p>
            </Card>
          </div>

          {/* AI Insight panel */}
          <div className="space-y-6">
            <Card className="border-[#DCCDCE]/40 bg-white p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="gold-gradient flex h-10 w-10 items-center justify-center rounded-xl text-white">
                  <Brain className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#50080E]">AI Insight</h3>
              </div>
              <div className="space-y-3">
                {[
                  "Demand signal is above the local 12-month median.",
                  "Comparable resale inventory remains tight in the target ticket size.",
                  "Projected rental yield supports downside protection under conservative occupancy.",
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-relaxed text-[#72383D]/80">{item}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* EMI Calculator card */}
            <Card className="border-[#DCCDCE]/40 bg-white p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#50080E]">
                <Calculator className="h-5 w-5 text-[#D4AF37]" />
                EMI Calculator
              </h3>
              <div className="space-y-3">
                {[
                  ["Loan Amount", formatCurrency(Math.round(property.price * 0.8))],
                  ["Interest Rate", "8.5%"],
                  ["Tenure", "20 years"],
                  ["Monthly EMI", formatCurrency(Math.round(property.price * 0.8 * 0.0085))],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-[#DCCDCE]/20 pb-2 last:border-0">
                    <span className="text-xs text-[#72383D]/60">{label}</span>
                    <span className="text-sm font-semibold text-[#50080E]">{value}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Button className="w-full" size="lg">
              <CalendarClock className="h-4 w-4" />
              Book Consultation
            </Button>
          </div>
        </section>

        {/* Diligence section */}
        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <Card className="min-h-[280px] overflow-hidden border-[#DCCDCE]/40">
            <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-[#50080E]/10 via-[#DCCDCE]/10 to-[#D4AF37]/5 p-8 text-center">
              <Map className="mb-4 h-8 w-8 text-[#50080E]" />
              <h3 className="text-xl font-bold text-[#50080E]">Map Intelligence</h3>
              <p className="mt-2 max-w-sm text-sm text-[#72383D]/70">
                Coordinates: {property.coordinates.lat}, {property.coordinates.lng}.
                Connect Mapbox for live neighborhood analysis.
              </p>
            </div>
          </Card>
          <Card className="border-[#DCCDCE]/40 bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
              <h3 className="text-xl font-bold text-[#50080E]">Diligence Checklist</h3>
            </div>
            <div className="grid gap-2">
              {["Title verification", "Rental comps", "Exit liquidity", "Developer track record", "Tax and fee estimate"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-[#DCCDCE]/30 bg-[#F5F4F1]/60 p-3.5 text-sm text-[#50080E]">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
