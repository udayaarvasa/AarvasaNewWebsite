import { Suspense } from "react";
import { ListingsGrid } from "@/components/property/listings-grid";
import { ProjectCards } from "@/components/property/project-cards";
import { PropertyGridSkeleton } from "@/components/property/property-skeleton";
import { CompareProvider } from "@/components/property/compare-store";
import { SectionHead, Wrap } from "@/components/av/primitives";
import { DraftingGrid, Grain, MeasureRule, SectionIndex } from "@/components/av/graphics";
import { TextReveal } from "@/components/av/motion";
import { CinematicBanner } from "@/components/av/banner";
import { publishedProjects } from "@/lib/projects";

export const metadata = {
  title: "Properties | Aarvasa",
  description:
    "Browse premium homes, plots and offices. Filter on specification, explore what has been captured in 3D and 360°, and compare a shortlist side by side.",
};

/**
 * DISCOVER.
 *
 * The previous hero carried "94% AI accuracy", "Live ROI modeling" and
 * "highest predicted capital appreciation and rental yield". None of those are
 * verifiable, and this system makes no yield claim, so they are gone rather
 * than restyled. What replaces them is the search itself.
 */
export default function ListingsPage() {
  // The lead is whichever published project actually has photography.
  const lead = publishedProjects().find((p) => p.images[0]) ?? null;

  return (
    <div className="pb-[var(--s-24)]">
      <section className="relative isolate overflow-hidden bg-paper-sunken pb-[var(--band-tight)] pt-[var(--s-10)]">
        <DraftingGrid size={40} fade="radial" className="opacity-25" />
        <Grain opacity={0.04} />
        <Wrap className="relative z-[2]">
          <span className="av-label text-gold-ink">Discover</span>
          <TextReveal
            as="h1"
            text="Premium property, examined properly"
            className="av-display mt-2 text-[clamp(32px,4.4vw,52px)] leading-[1.04]"
          />
          <p className="mt-[var(--s-4)] max-w-[52ch] text-[17px] leading-relaxed text-ink-muted">
            Filter on the specification that decides it, open the formats a project has actually
            produced, and put a shortlist of three side by side before you travel.
          </p>
          <div className="mt-[var(--s-6)] max-w-[420px]">
            <MeasureRule />
          </div>
        </Wrap>
      </section>

      {/* A large visual lead: the one project with photography carries the page in */}
      {lead && (
        <CinematicBanner
          src={lead.images[0]}
          alt={`${lead.name}, ${lead.location}`}
          eyebrow={`${lead.location} · ${lead.developer}`}
          title={lead.name}
          body={lead.usps[0] ?? undefined}
          href={`/projects/${lead.slug}`}
          cta="Open the project"
          height="short"
          position="50% 42%"
        />
      )}

      {/* Developer projects — these carry real immersive media, so they lead */}
      <Wrap className="pt-[var(--band)]">
        <SectionIndex n={1} total={2} className="mb-[var(--s-3)]" />
        <SectionHead
          label="Projects"
          title="Developer inventory"
          note="Listed by the developer or their appointed channel partner. Aarvasa holds no inventory and charges buyers nothing."
        />
        <ProjectCards />
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <SectionIndex n={2} total={2} className="mb-[var(--s-3)]" />
        <SectionHead label="All listings" title="Everything on the platform" />
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
