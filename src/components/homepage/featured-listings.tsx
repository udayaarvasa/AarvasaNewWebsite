import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyCard } from "@/components/property/property-card";
import { SectionHeader } from "./section-header";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { properties } from "@/lib/properties";

export function FeaturedListings() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" id="featured-listings">
      <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <SectionHeader
          badge="Curated Selection"
          title="Featured Luxury Listings"
          description="Hand-picked properties with exceptional investment potential, vetted by our AI analytics engine."
        />
        <Button asChild variant="outline" className="shrink-0 self-start md:self-auto">
          <Link href="/listings">
            View All Listings
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {properties.slice(0, 3).map((property, i) => (
          <MotionReveal key={property.id} delay={i * 0.1}>
            <PropertyCard property={property} />
          </MotionReveal>
        ))}
      </div>
    </section>
  );
}
