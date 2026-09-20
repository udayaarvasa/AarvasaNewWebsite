import {
  AdvisorPanel,
  ClosingCTA,
  CuratedProjects,
  FeaturedProject,
  HomeHero,
  HowAarvasaWorks,
  ImmersiveHome,
  TrustPartners,
} from "@/components/homepage/home-sections";

export const metadata = {
  title: "Aarvasa | Premium property, examined properly",
  description:
    "Find premium homes, plots and offices, explore what has been captured in 3D and 360°, and compare a shortlist on the specification that decides it.",
};

/**
 * DISCOVER → EXPLORE → EVALUATE.
 *
 * Retired from the previous homepage: the blockchain security section, the
 * tokenised-investment CTA, the ROI/dashboard analytics previews and the
 * animated marketing counters. Those products do not exist yet and those
 * figures are not verifiable.
 */
export default function Home() {
  return (
    <div className="pb-[var(--s-24)]">
      <HomeHero />
      <FeaturedProject />
      <ImmersiveHome />
      <CuratedProjects />
      <HowAarvasaWorks />
      <AdvisorPanel />
      <TrustPartners />
      <ClosingCTA />
    </div>
  );
}
