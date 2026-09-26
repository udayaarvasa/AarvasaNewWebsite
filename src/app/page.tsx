import { StatementBanner, TextureBanner } from "@/components/av/banner";
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
 * The page is composed as an alternating rhythm rather than a stack of card
 * grids: dark stage, paper, dark stage, paper, and two full-width breaks that
 * stop the middle of the page from becoming one long cream run.
 *
 *   1 hero              stage
 *   2 featured          paper
 *   3 immersive         stage
 *   4 curated           paper
 *     statement break   stage
 *   5 how it works      paper
 *   6 advisor           paper
 *     texture break     sunken paper
 *   7 trust             paper
 *   8 closing           stage
 */
export default function Home() {
  return (
    <div className="pb-[var(--s-24)]">
      <HomeHero />
      <FeaturedProject />
      <ImmersiveHome />
      <CuratedProjects />

      <div className="mt-[var(--band)]">
        <StatementBanner
          eyebrow="Why we build it this way"
          title="A building is a document before it is a photograph."
          body="Structure, plot, ceiling heights, approvals, payment schedules, handover. Aarvasa publishes what the developer filed and sets it as data you can read across — because the things that decide a purchase are rarely the things a brochure photographs."
          footnote="Filed, not written · Produced, not promised · No forecasts"
        />
      </div>

      <HowAarvasaWorks />
      <AdvisorPanel />

      <div className="mt-[var(--band)]">
        <TextureBanner
          eyebrow="The drawing set"
          title="Read the elevation, not the adjective."
          body="Every project page carries the specification as a drawing schedule: a ledger of what was filed, with the gaps left visible rather than estimated."
          motif="elevation"
        />
      </div>

      <TrustPartners />
      <ClosingCTA />
    </div>
  );
}
