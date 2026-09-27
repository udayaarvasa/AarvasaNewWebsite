import { Suspense } from "react";
import Link from "next/link";
import { ListingsGrid } from "@/components/property/listings-grid";
import { ProjectCards } from "@/components/property/project-cards";
import { PropertyGridSkeleton } from "@/components/property/property-skeleton";
import { CompareProvider } from "@/components/property/compare-store";
import { SectionHead, Wrap } from "@/components/av/primitives";
import { DraftingGrid, Grain, MeasureRule, SectionIndex } from "@/components/av/graphics";
import { TextReveal } from "@/components/av/motion";
import { CinematicBanner } from "@/components/av/banner";
import { projectImageSrc } from "@/lib/project-types";
import { publishedProjects } from "@/lib/projects";

export const metadata = {
  title: "Properties | Aarvasa",
  description:
    "Browse premium homes, plots and offices. Filter on specification, explore what has been captured in 3D and 360°, and compare a shortlist side by side.",
};

/** Filters that change WHICH results are asked for. `sortBy` only reorders the
 *  same set, so it does not count as a search intent. */
const RESULT_FILTERS = [
  "search",
  "city",
  "propertyType",
  "minPrice",
  "maxPrice",
  "bedrooms",
  "verified",
] as const;

type Query = Partial<Record<(typeof RESULT_FILTERS)[number] | "sortBy" | "page", string>>;

/**
 * DISCOVER.
 *
 * The previous hero carried "94% AI accuracy", "Live ROI modeling" and
 * "highest predicted capital appreciation and rental yield". None of those are
 * verifiable, and this system makes no yield claim, so they are gone rather
 * than restyled. What replaces them is the search itself.
 *
 * The page reads its own URL. That matters: it used to render a fixed
 * editorial lead and the full developer list regardless of the query, so
 * /listings?city=Mumbai put a Dubai project and two Bhopal projects above the
 * real Mumbai results, where they read as Mumbai matches. Under a filter,
 * search intent leads and promotional content stands down.
 */
export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const q = await searchParams;
  const city = q.city?.trim() ?? "";
  const isFiltered = RESULT_FILTERS.some((k) => q[k]);

  // The lead is whichever published project actually has photography.
  const lead = publishedProjects().find((p) => p.images[0]) ?? null;
  /* Whether the Projects band has anything to show under this query. Rendering
     its heading and note above an empty grid read as "we have inventory here"
     when we have none. */
  const matchingProjects = city
    ? publishedProjects().filter((p) => p.city.toLowerCase() === city.toLowerCase())
    : publishedProjects();
  /* The amenity frame, so the listings lead, the card below it and the project
     page each open on a different picture. */
  const leadImage = lead?.imagery?.gallery[1] ?? null;
  const leadSrc = leadImage ? projectImageSrc(leadImage, "16x9") : (lead?.images[0] ?? null);
  const leadNote = leadImage?.origin === "render" ? "Developer render" : undefined;

  /* Unfiltered browse only. Under a query this sits above the results as an
     unrelated location, which is exactly the misreading being fixed. */
  const showEditorialLead = !isFiltered && lead && leadSrc;

  return (
    <div className="pb-[var(--s-24)]">
      <section className="relative isolate overflow-hidden bg-paper-sunken pb-[var(--band-tight)] pt-[var(--s-10)]">
        <DraftingGrid size={40} fade="radial" className="opacity-25" />
        <Grain opacity={0.04} />
        <Wrap className="relative z-[2]">
          <span className="av-label text-gold-ink">Discover</span>
          <TextReveal
            as="h1"
            text={city ? `Properties in ${city}` : "Premium property, examined properly"}
            className="av-display mt-2 text-[clamp(32px,4.4vw,52px)] leading-[1.04]"
          />
          {isFiltered ? (
            <div className="mt-[var(--s-4)] flex flex-wrap items-center gap-[var(--s-3)]">
              <p className="text-[15px] text-ink-muted">
                Showing filtered results{city ? ` for ${city}` : ""}.
              </p>
              <Link
                href="/listings"
                className="av-label rounded-xs border border-rule-firm bg-paper-raised px-3 py-[6px] text-ink transition-colors hover:border-burgundy hover:text-burgundy"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <p className="mt-[var(--s-4)] max-w-[52ch] text-[17px] leading-relaxed text-ink-muted">
              Filter on the specification that decides it, open the formats a project has actually
              produced, and put a shortlist of three side by side before you travel.
            </p>
          )}
          <div className="mt-[var(--s-6)] max-w-[420px]">
            <MeasureRule />
          </div>
        </Wrap>
      </section>

      {/* A large visual lead, on an unfiltered browse only. The frame differs
          from the project page hero, and says whether it is a photograph or a
          render. */}
      {showEditorialLead && (
        <CinematicBanner
          src={leadSrc}
          alt={leadImage?.alt ?? `${lead.name}, ${lead.location}`}
          note={leadNote}
          eyebrow={`${lead.location} · ${lead.developer}`}
          title={lead.name}
          body={lead.usps[0] ?? undefined}
          href={`/projects/${lead.slug}`}
          cta="Open the project"
          height="short"
          position="50% 42%"
        />
      )}

      {/* Developer projects — these carry real immersive media, so they lead.
          Under a city filter they are filtered too, and the section disappears
          when none match rather than standing in for results. */}
      {matchingProjects.length > 0 && (
        <Wrap className="pt-[var(--band)]">
          <SectionIndex n={1} total={2} className="mb-[var(--s-3)]" />
          <SectionHead
            label="Projects"
            title={city ? `Developer inventory in ${city}` : "Developer inventory"}
            note="Listed by the developer or their appointed channel partner. Aarvasa holds no inventory and charges buyers nothing."
          />
          <ProjectCards city={city || undefined} />
        </Wrap>
      )}

      <Wrap className="pt-[var(--band)]">
        <SectionIndex n={matchingProjects.length > 0 ? 2 : 1} total={matchingProjects.length > 0 ? 2 : 1} className="mb-[var(--s-3)]" />
        <SectionHead
          label="All listings"
          title={city ? `Listings in ${city}` : "Everything on the platform"}
        />
        {/* The shortlist context wraps only the grid and its tray; the static
            header and project plates above stay outside the client boundary. */}
        <CompareProvider>
          <Suspense fallback={<PropertyGridSkeleton count={6} />}>
            <ListingsGrid />
          </Suspense>
        </CompareProvider>
      </Wrap>
    </div>
  );
}
