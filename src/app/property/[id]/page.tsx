import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Bath, BedDouble, Brain, Calculator, CalendarClock,
  CheckCircle2, Heart, Map, MapPin, Maximize, Ruler, Share2, ShieldCheck, TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InquiryForm } from "@/components/property/inquiry-form";
import { getPropertyById } from "@/lib/services/property.service";
import { auth } from "@/auth";
import { formatCurrency, getProperty, properties } from "@/lib/properties";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  // Try database first, fall back to static data
  let property: any = await getPropertyById(id, session?.user?.id).catch(() => null);
  let isDbProperty = !!property;

  if (!property) {
    // Fallback to static mock data for backward compatibility
    const staticProp = getProperty(id);
    if (!staticProp) notFound();
    property = {
      ...staticProp,
      description: staticProp.summary,
      city: staticProp.location.split(",").pop()?.trim() || "",
      state: "",
      country: "India",
      propertyType: staticProp.type.toUpperCase(),
      bedrooms: staticProp.beds,
      bathrooms: staticProp.baths,
      area: staticProp.sqft,
      amenities: staticProp.tags,
      featured: staticProp.tags.includes("AI Recommended"),
      verified: true,
      status: "ACTIVE",
      riskLevel: staticProp.risk.toUpperCase(),
      owner: null,
    };
    isDbProperty = false;
  }

  const heroImage = property.images?.[0] ||
    "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1400&q=80";

  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      {/* Full-width cinematic hero */}
      <section className="relative h-[55vh] min-h-[420px] w-full overflow-hidden">
        <Image
          src={heroImage}
          alt={property.title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#50080E]/80 via-[#50080E]/20 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <Button asChild variant="ghost" className="mb-4 text-white/70 hover:text-white hover:bg-white/10">
            <Link href="/listings">
              <ArrowLeft className="h-4 w-4" />
              Back to listings
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {property.featured && (
              <Badge className="bg-[#D4AF37] text-[#1A0006]">Featured</Badge>
            )}
            {property.verified && (
              <Badge variant="success">Verified</Badge>
            )}
            <Badge variant="default">
              {property.propertyType?.charAt(0) + property.propertyType?.slice(1).toLowerCase()}
            </Badge>
          </div>
          <h1 className="heading-serif text-4xl text-white sm:text-5xl lg:text-6xl">
            {property.title}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <MapPin className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-sm text-white/80">
              {property.location}{property.city ? `, ${property.city}` : ""}
            </span>
          </div>
        </div>

        <div className="absolute right-6 top-24 z-10 flex gap-2">
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xl transition hover:bg-white/30">
            <Heart className="h-5 w-5" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-xl transition hover:bg-white/30">
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Stats row */}
      <section className="border-b border-[#DCCDCE]/40 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-8 px-4 py-5 sm:px-6 lg:px-8">
          <div className="border-r border-[#DCCDCE]/40 pr-8">
            <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Price</p>
            <p className="text-2xl font-bold text-[#50080E]">{formatCurrency(property.price)}</p>
          </div>
          {property.roi > 0 && (
            <div className="border-r border-[#DCCDCE]/40 pr-8">
              <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Est. ROI</p>
              <p className="text-2xl font-bold text-[#50080E]">{property.roi}%</p>
            </div>
          )}
          <div className="border-r border-[#DCCDCE]/40 pr-8">
            <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Area</p>
            <p className="text-2xl font-bold text-[#50080E]">
              {property.area?.toLocaleString("en-IN")} <span className="text-sm font-normal text-[#72383D]/60">sq.ft</span>
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[#72383D]/60">Status</p>
            <p className="text-2xl font-bold text-emerald-600">
              {property.status === "ACTIVE" ? "Active" : property.status}
            </p>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left column */}
          <div className="space-y-8">
            {/* Description */}
            <Card className="border-[#DCCDCE]/40 bg-white p-6">
              <h2 className="mb-4 text-xl font-bold text-[#50080E]">About this Property</h2>
              <p className="text-sm leading-relaxed text-[#72383D]/80">
                {property.description}
              </p>
            </Card>

            {/* Specs */}
            <Card className="border-[#DCCDCE]/40 bg-white p-6">
              <h2 className="mb-4 text-xl font-bold text-[#50080E]">Specifications</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {property.bedrooms > 0 && (
                  <div className="rounded-xl bg-[#F5F4F1] p-4 text-center">
                    <BedDouble className="mx-auto mb-2 h-5 w-5 text-[#D4AF37]" />
                    <p className="text-lg font-bold text-[#50080E]">{property.bedrooms}</p>
                    <p className="text-xs text-[#72383D]/50">Bedrooms</p>
                  </div>
                )}
                {property.bathrooms > 0 && (
                  <div className="rounded-xl bg-[#F5F4F1] p-4 text-center">
                    <Bath className="mx-auto mb-2 h-5 w-5 text-[#D4AF37]" />
                    <p className="text-lg font-bold text-[#50080E]">{property.bathrooms}</p>
                    <p className="text-xs text-[#72383D]/50">Bathrooms</p>
                  </div>
                )}
                <div className="rounded-xl bg-[#F5F4F1] p-4 text-center">
                  <Ruler className="mx-auto mb-2 h-5 w-5 text-[#D4AF37]" />
                  <p className="text-lg font-bold text-[#50080E]">{property.area?.toLocaleString("en-IN")}</p>
                  <p className="text-xs text-[#72383D]/50">sq.ft</p>
                </div>
                {property.roi > 0 && (
                  <div className="rounded-xl bg-[#F5F4F1] p-4 text-center">
                    <TrendingUp className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
                    <p className="text-lg font-bold text-emerald-600">{property.roi}%</p>
                    <p className="text-xs text-[#72383D]/50">ROI</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Amenities */}
            {property.amenities?.length > 0 && (
              <Card className="border-[#DCCDCE]/40 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-[#50080E]">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((amenity: string) => (
                    <span key={amenity} className="flex items-center gap-1.5 rounded-full border border-[#DCCDCE]/40 bg-[#F5F4F1] px-3 py-1.5 text-xs font-medium text-[#50080E]">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      {amenity}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Gallery */}
            {property.images?.length > 1 && (
              <Card className="border-[#DCCDCE]/40 bg-white p-6">
                <h2 className="mb-4 text-xl font-bold text-[#50080E]">Gallery</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  {property.images.slice(1).map((src: string, i: number) => (
                    <div key={src} className="group relative aspect-[16/10] overflow-hidden rounded-2xl border border-[#DCCDCE]/30">
                      <Image
                        src={src}
                        alt={`${property.title} - View ${i + 2}`}
                        fill sizes="(max-width: 768px) 100vw, 50vw"
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Owner info */}
            {property.owner && (
              <Card className="border-[#DCCDCE]/40 bg-white p-6">
                <h3 className="mb-4 text-sm font-bold text-[#50080E]">Listed By</h3>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#902941] text-sm font-bold text-white">
                    {property.owner.name?.charAt(0)?.toUpperCase() || "A"}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#50080E]">{property.owner.name}</p>
                    <p className="text-xs text-[#72383D]/50 capitalize">{property.owner.role?.toLowerCase()}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* EMI Calculator */}
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

            {/* Inquiry Form */}
            <Card className="border-[#DCCDCE]/40 bg-white p-6">
              <h3 className="mb-4 text-lg font-bold text-[#50080E]">Interested?</h3>
              <InquiryForm propertyId={property.id} propertyTitle={property.title} />
            </Card>

            {/* Diligence checklist */}
            <Card className="border-[#DCCDCE]/40 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
                <h3 className="text-lg font-bold text-[#50080E]">Diligence</h3>
              </div>
              <div className="grid gap-2">
                {["Title verification", "Rental comparables", "Exit liquidity", "Developer track record", "Tax estimate"].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-[#DCCDCE]/30 bg-[#F5F4F1]/60 p-3 text-sm text-[#50080E]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
