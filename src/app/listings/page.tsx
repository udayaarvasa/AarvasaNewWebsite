import { Suspense } from "react";
import { ListingsGrid } from "@/components/property/listings-grid";
import { ProjectCards } from "@/components/property/project-cards";
import { PropertyGridSkeleton } from "@/components/property/property-skeleton";
import { CompareProvider } from "@/components/property/compare-store";
import { SectionHead, Wrap } from "@/components/av/primitives";

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
  return (
    <div className="pb-[var(--s-24)]">
      <Wrap className="pt-[var(--s-10)]">
          <span className="av-label text-gold-ink">Discover</span>
          <h1 className="av-display mt-2 text-[clamp(32px,4.4vw,52px)] leading-[1.04]">
            Premium property, examined properly
          </h1>
          <p className="mt-[var(--s-4)] max-w-[52ch] text-[17px] leading-relaxed text-ink-muted">
            Filter on the specification that decides it, open the formats a project has actually
            produced, and put a shortlist of three side by side before you travel.
          </p>
        </Wrap>

      {/* Developer projects — these carry real immersive media, so they lead */}
      <Wrap className="pt-[var(--band)]">
          <SectionHead
            label="Projects"
            title="Developer inventory"
            note="Listed by the developer or their appointed channel partner. Aarvasa holds no inventory and charges buyers nothing."
          />
          <ProjectCards />
        </Wrap>

      <Wrap className="pt-[var(--band)]">
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
