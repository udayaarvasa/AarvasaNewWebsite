import {
  AdvisorSection,
  ClosingInvitation,
  CollectionRail,
  FeaturedShowcase,
  FiguresBand,
  LedgerSection,
  LuxHero,
  PartnersBand,
  Pillars,
  PlacesMarquee,
} from "@/components/lux/home";
import { jsonLdScript, siteJsonLd } from "@/lib/project-structured-data";

export const metadata = {
  title: "Aarvasa | Luxury real estate, examined properly",
  alternates: { canonical: "/" },
  description:
    "Off-plan apartments in Dubai — REEF 996, 997, 998, 999 and 1000 — and residential plots in Bhopal, set out as their developers filed them: sizes, prices, payment plans and approvals.",
};

/**
 * The 2026 homepage.
 *
 *   hero (cinematic carousel, search) · marquee · featured project ·
 *   the collection (pinned rail) · how it works · the ledger ·
 *   figures · advisor · partners · closing invitation
 *
 * Every figure, frame and project here is derived from the project records.
 */
export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd()) }} />
      <LuxHero />
      <PlacesMarquee />
      <FeaturedShowcase />
      <CollectionRail />
      <Pillars />
      <LedgerSection />
      <FiguresBand />
      <AdvisorSection />
      <PartnersBand />
      <ClosingInvitation />
    </>
  );
}
