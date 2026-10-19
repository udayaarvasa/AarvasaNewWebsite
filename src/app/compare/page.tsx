import { Suspense } from "react";
import { Wrap } from "@/components/av/primitives";
import { CompareView } from "./compare-view";

export const metadata = {
  title: "Compare | Aarvasa",
  alternates: { canonical: "/compare" },
  description:
    "Put up to three properties side by side on price, specification and locality. No scores, no forecasts.",
};

/**
 * EVALUATE gets its own route so a shortlist is shareable and printable —
 * comparison is a surface, not a modal.
 */
export default function ComparePage() {
  return (
    <div className="pb-[var(--s-24)]">
      <Wrap className="pt-[var(--s-10)]">
        <span className="av-label text-gold-ink">Evaluate</span>
        <h1 className="av-display mt-2 text-[clamp(32px,4.4vw,52px)] leading-[1.04]">Comparison</h1>
        <p className="mt-[var(--s-4)] max-w-[56ch] text-[17px] leading-relaxed text-ink-muted">
          Three properties, one table. Everything the developer has filed, lined up so the
          differences are the thing you see first.
        </p>
      </Wrap>

      <Wrap className="pt-[var(--band-tight)]">
        <Suspense fallback={<p className="text-[13.5px] text-ink-muted">Loading comparison…</p>}>
          <CompareView />
        </Suspense>
      </Wrap>
    </div>
  );
}
