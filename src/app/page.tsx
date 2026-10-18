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

export const metadata = {
  title: "Aarvasa | Luxury real estate, examined properly",
  description:
    "Premium residences and plots in Dubai and India, set out exactly as their developers filed them — specification, approvals, payment plans and imagery.",
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
