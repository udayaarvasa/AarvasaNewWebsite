import { ListingExperience } from "@/components/property/listing-experience";

export default function ListingsPage() {
  return (
    <div className="min-h-screen bg-[#F2F1ED]">
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="heading-serif text-4xl tracking-tight text-[#50080E] sm:text-5xl">
              Curated Listings
            </h1>
            <p className="mt-2 text-sm text-[#72383D]/70">
              Showing 24 properties matching your AI criteria.
            </p>
          </div>
        </div>
        <ListingExperience />
      </section>
    </div>
  );
}
