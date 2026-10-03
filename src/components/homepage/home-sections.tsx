import Image from "next/image";
import Link from "next/link";
import { StageHero } from "@/components/layout/nav-overlay";
import {
  Ledger,
  Plate,
  SectionHead,
  StageBand,
  Status,
  Wrap,
} from "@/components/av/primitives";
import {
  ContourField,
  CoordinateMarks,
  CornerBrackets,
  DraftingGrid,
  Grain,
  MeasureRule,
  SectionIndex,
} from "@/components/av/graphics";
import { ImageReveal, Parallax, Reveal, RevealGroup, RevealItem, TextReveal } from "@/components/av/motion";
import { ProjectCards } from "@/components/property/project-cards";
import { projectImageSrc } from "@/lib/project-types";
import { publishedProjects } from "@/lib/projects";
import { formatCompact, inrEstimate } from "@/lib/currency";
import { projectsWithModel } from "@/lib/services/project-models";

/**
 * The homepage, composed from real project data only.
 *
 * Deliberately absent: the animated counters (2,500+ properties, ₹12B+
 * portfolio value, 98% investor satisfaction, 15% avg annual ROI), the
 * "94% AI accuracy" tile and the blockchain, tokenisation and investment
 * sections. None of those figures are verifiable and none of those products
 * exist yet, so they are omitted rather than restyled.
 */

/* ── 1 · Hero ─────────────────────────────────────────────────────────── */

export function HomeHero() {
  const feature = publishedProjects().find((p) => p.images[0]) ?? publishedProjects()[0];
  /* Each homepage band that shows this project picks a DIFFERENT frame from the
     curated library, so the page does not open, restate and close on one
     picture. Hero: the balcony bands. Immersive: the night crown. Closing: the
     full elevation. */
  const heroImage = feature?.imagery?.gallery[0] ?? null;
  const cover = heroImage ? projectImageSrc(heroImage, "4x5") : (feature?.images[0] ?? null);

  /* One DOM tree, two compositions.
     Below md the copy sits on solid stage beneath a portrait plate; from md it
     lifts over the frame. Rendering it once keeps a single h1 on the page —
     two branches meant the heading existed twice, once hidden. */
  return (
    <StageHero className="relative bg-stage">
      <div className="relative">
        <Plate
          ratio="auto"
          className="aspect-[4/5] bg-stage md:aspect-auto md:h-[82vh] md:min-h-[560px]"
        >
          {cover && (
            <Parallax distance={34} className="absolute inset-0">
              <Image
                src={cover}
                alt={`${feature.name}, ${feature.location}`}
                fill
                sizes="100vw"
                className="object-cover object-[50%_35%] md:object-[50%_28%]"
                priority
              />
            </Parallax>
          )}

          {/* Scrim only where type lands on the media */}
          <div aria-hidden="true" className="av-scrim pointer-events-none absolute inset-0 z-[1] hidden md:block" />
          <DraftingGrid tone="stage" size={72} fade="top" className="z-[1] opacity-25" />
          <Grain opacity={0.06} className="z-[1]" />
          <CoordinateMarks tone="stage" className="z-[2] max-md:hidden" />

          {feature && (
            <span className="av-meta absolute left-[var(--gutter)] top-[calc(var(--nav-h)+var(--s-5))] z-[3] hidden text-stage-muted md:block">
              {feature.location} · {feature.city}
            </span>
          )}
        </Plate>

        <Wrap className="relative z-[3] py-[var(--s-10)] md:absolute md:inset-x-0 md:bottom-0 md:py-0 md:pb-[var(--s-14)]">
          <span className="av-meta text-gold">Discover · Explore · Evaluate</span>
          <TextReveal
            as="h1"
            text="Know the building before you stand in it."
            className="av-display mt-3 max-w-[13ch] text-[clamp(38px,6.6vw,84px)] leading-[0.98] text-stage-ink"
          />
          <p className="mt-[var(--s-4)] max-w-[46ch] text-[16px] leading-relaxed text-stage-muted md:text-[17px]">
            Premium homes, plots and offices — photographed, measured and, where they have been
            captured, walkable in three dimensions.
          </p>
          <div className="mt-[var(--s-6)] flex flex-wrap gap-[var(--s-3)]">
            <Link
              href="/listings"
              className="av-label rounded-xs border border-gold bg-gold px-6 py-[14px] text-stage transition-colors duration-300 hover:bg-transparent hover:text-gold"
            >
              Browse properties
            </Link>
            {feature && (
              <Link
                href={`/projects/${feature.slug}`}
                className="av-label rounded-xs border border-stage-ink/35 px-6 py-[14px] text-stage-ink transition-colors duration-300 hover:border-stage-ink"
              >
                Open {feature.name}
              </Link>
            )}
          </div>
        </Wrap>
      </div>
    </StageHero>
  );
}

/* ── 2 · Featured project ─────────────────────────────────────────────── */

export function FeaturedProject() {
  const project = publishedProjects().find((p) => p.images.length > 1) ?? publishedProjects()[0];
  if (!project) return null;

  /* A different frame from the one the project page leads with, so the two
     pages do not open on the same picture. Falls back to the flat list for
     projects with no curated library. */
  const plateImage = project.imagery?.cards[0] ?? null;
  const plate = plateImage
    ? projectImageSrc(plateImage, "4x5")
    : (project.images[1] ?? project.images[0] ?? null);
  const plateAlt = plateImage?.alt ?? `${project.name}, ${project.location}`;
  const plateNote = plateImage?.origin === "render" ? "Developer render" : null;
  const price =
    project.fromPrice > 0 ? formatCompact(project.fromPrice, project.currency) : "On request";
  const inr = inrEstimate(project.fromPrice, project.currency);

  return (
    <Wrap className="pt-[var(--band)]">
      <SectionIndex n={1} total={8} className="mb-[var(--s-3)]" />
      <SectionHead
        label="Featured project"
        note="One project takes the full spread. Inventory and pricing are sourced from the developer."
      />
      <div className="grid grid-cols-1 items-start gap-[var(--s-14)] lg:grid-cols-[0.9fr_1.1fr]">
        <ImageReveal>
          <Link href={`/projects/${project.slug}`} data-hov className="block">
            <Plate ratio="plate">
              {plate ? (
                <>
                  <Image
                    src={plate}
                    alt={plateAlt}
                    fill
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-enter)] hover:scale-[1.03]"
                  />
                  {plateNote && (
                    <span className="av-meta absolute right-3 top-3 z-[3] rounded-xs bg-[rgba(12,11,10,0.72)] px-2 py-1 text-stage-ink backdrop-blur-sm">
                      {plateNote}
                    </span>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-end bg-paper-sunken p-4">
                  <span className="av-meta text-ink-disabled">Not yet photographed</span>
                </div>
              )}
            </Plate>
          </Link>
          <div className="mt-[var(--s-4)] max-w-[320px]">
            <MeasureRule />
          </div>
        </ImageReveal>

        <Reveal delay={0.09}>
          <span className="av-meta text-ink-muted">
            {project.location} · {project.developer}
          </span>
          <h3 className="av-display mt-2 text-[clamp(30px,3.6vw,52px)] leading-[1.02]">
            {project.name}
          </h3>
          <p className="mt-[var(--s-4)] max-w-[46ch] text-[17px] leading-relaxed text-ink-muted">
            {project.usps[0] ??
              `${project.kind === "plots" ? "Plots" : "Residences"} by ${project.developer} in ${project.city}.`}
          </p>

          <Ledger
            className="mt-[var(--s-6)]"
            rows={[
              { term: project.fromPrice > 0 ? "Starting from" : "Rate", value: inr ? `${price} · ${inr}` : price },
              ...(project.completion ? [{ term: "Completion", value: project.completion }] : []),
              ...(project.totalUnits
                ? [{ term: project.kind === "plots" ? "Plots" : "Residences", value: String(project.totalUnits) }]
                : []),
              ...(project.approvals.length > 0
                ? [{ term: "Approvals", value: project.approvals.join(" · ") }]
                : []),
            ]}
          />

          <div className="mt-[var(--s-6)] flex flex-wrap gap-[var(--s-3)]">
            <Link
              href={`/projects/${project.slug}`}
              className="av-label rounded-xs bg-burgundy px-6 py-[13px] text-paper transition-colors hover:bg-burgundy-deep"
            >
              Open the project
            </Link>
            <Link
              href="/listings"
              className="av-label self-center border-b border-rule-firm pb-1 text-ink transition-colors hover:border-burgundy hover:text-burgundy"
            >
              All properties
            </Link>
          </div>
        </Reveal>
      </div>
    </Wrap>
  );
}

/* ── 3 · Immersive ────────────────────────────────────────────────────── */

export async function ImmersiveHome() {
  const projects = publishedProjects();
  const withModel = await projectsWithModel(projects);
  const feature = projects.find((p) => withModel.has(p.slug)) ?? null;

  // No published immersive media in this environment: the section is absent
  // rather than an empty shell with dead controls.
  if (!feature) return null;

  const coverImage = feature.imagery?.banners[0] ?? null;
  const cover = coverImage ? projectImageSrc(coverImage, "16x9") : (feature.images[0] ?? null);

  return (
    <StageBand className="relative isolate mt-[var(--band)] overflow-hidden py-[var(--band)]">
      <ContourField tone="stage" seed={3} className="opacity-45" />
      <DraftingGrid tone="stage" size={56} fade="radial" className="opacity-30" />
      <Grain opacity={0.05} />
      <Wrap className="relative z-[2]">
        <SectionIndex n={3} total={8} tone="stage" className="mb-[var(--s-3)]" />
        <SectionHead
          label="Explore"
          title="Walk it from where you are"
          note="A format appears only where the asset has been produced. There are no empty controls on this site."
        />
        <Link href={`/projects/${feature.slug}`} className="block" data-hov>
          <Plate ratio="viewer" className="border border-stage-rule">
            {cover && (
              <Image
                src={cover}
                alt={`${feature.name} — open the immersive experience`}
                fill
                sizes="100vw"
                className="object-cover opacity-90 transition-transform duration-[1200ms] ease-[var(--ease-enter)] hover:scale-[1.02]"
              />
            )}
            {/* The reticle means navigable media, and only that */}
            <CornerBrackets tone="stage" />
            <span className="av-meta absolute left-6 top-5 z-[2] text-stage-muted">
              3D model · {feature.name}
            </span>
          </Plate>
        </Link>
        <p className="mt-[var(--s-4)] max-w-[62ch] text-[13.5px] leading-relaxed text-stage-muted">
          Nothing downloads until you open it. Where a model is a development pilot rather than the
          building itself, the project page says so plainly.
        </p>
      </Wrap>
    </StageBand>
  );
}

/* ── 4 · Curated ──────────────────────────────────────────────────────── */

export function CuratedProjects() {
  return (
    <Wrap className="pt-[var(--band)]">
      <SectionIndex n={4} total={8} className="mb-[var(--s-3)]" />
      <SectionHead
        label="Curated"
        title="Developer inventory"
        note="Projects Aarvasa represents directly. Aarvasa holds no inventory and charges buyers nothing."
      />
      <ProjectCards />
    </Wrap>
  );
}

/* ── 5 · How Aarvasa works ────────────────────────────────────────────── */

const JOURNEY = [
  {
    name: "Discover",
    live: true,
    body: "Search on city, budget, configuration and specification — filters that hold, and a URL you can share.",
  },
  {
    name: "Explore",
    live: true,
    body: "Walk the building in 3D, stand inside a 360° capture and open the measured plans, wherever those assets exist.",
  },
  {
    name: "Evaluate",
    live: true,
    body: "Put a shortlist of three side by side on price, specification and locality, then send one enquiry.",
  },
  {
    name: "Invest",
    live: false,
    body: "Fractional participation and digital records of title. In development — not available today.",
  },
  {
    name: "Own",
    live: false,
    body: "Ownership, documents and resale in one place. In development — not available today.",
  },
];

export function HowAarvasaWorks() {
  return (
    <Wrap className="pt-[var(--band)]">
      <SectionIndex n={5} total={8} className="mb-[var(--s-3)]" />
      <SectionHead
        label="How Aarvasa works"
        title="Three steps today, five eventually"
        note="The last two are in development. They are drawn as roadmap here and appear nowhere else on the site."
      />
      <div className="mb-[var(--s-5)]">
        <MeasureRule ticks={60} />
      </div>
      <div className="grid border-t border-rule-firm md:grid-cols-3 lg:grid-cols-5">
        {JOURNEY.map((step, i) => (
          <div
            key={step.name}
            className={`border-b border-rule py-[var(--s-5)] pr-[var(--s-5)] lg:border-b-0 lg:border-r lg:last:border-r-0 ${
              step.live ? "" : "bg-[repeating-linear-gradient(-45deg,transparent_0_7px,rgba(80,8,14,0.04)_7px_8px)]"
            }`}
          >
            <span className={`av-meta ${step.live ? "text-gold-ink" : "text-ink-disabled"}`}>
              {String(i + 1).padStart(2, "0")} / 05
            </span>
            <h3
              className={`av-display mt-2 text-[26px] ${step.live ? "" : "text-ink-disabled"}`}
            >
              {step.name}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{step.body}</p>
            {!step.live && (
              <span className="av-meta mt-3 inline-block rounded-xs border border-dashed border-rule-firm px-2 py-1 text-ink-muted">
                In development
              </span>
            )}
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/* ── 6 · Property intelligence ────────────────────────────────────────── */

export function AdvisorPanel() {
  return (
    <Wrap className="pt-[var(--band)]">
      <SectionIndex n={6} total={8} className="mb-[var(--s-3)]" />
      <SectionHead
        label="Property intelligence"
        note="The advisor sits in the margin of the page, where a good editor sits."
      />
      <div className="grid grid-cols-1 items-start gap-[var(--s-14)] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <p className="av-display max-w-[24ch] text-[clamp(24px,2.8vw,34px)] italic leading-[1.26] text-burgundy">
            “A two-bedroom near a metro line in Gurugram, ready to move, under ₹4 Cr.”
          </p>
          <p className="mt-[var(--s-6)] max-w-[var(--measure)] text-[17px] leading-relaxed">
            Describe what you want in a sentence. The advisor reads the specification sheets and
            developer filings behind every listing and answers in plain language, with the source
            beside each claim.
          </p>
          <Link
            href="/ai-chat"
            className="av-label mt-[var(--s-6)] inline-block border-b border-rule-firm pb-1 text-ink transition-colors hover:border-burgundy hover:text-burgundy"
          >
            Open the advisor
          </Link>
        </div>
        <div className="border-t border-rule-firm">
          {[
            ["Reads", "Specification sheets, developer filings, locality data"],
            ["Answers", "In plain sentences, with its sources shown"],
            ["Will not", "Forecast a price, quote a yield, or give investment advice"],
          ].map(([term, value]) => (
            <div key={term} className="border-b border-rule py-[9px]">
              <span className="av-meta block text-gold-ink">{term}</span>
              <span className="text-[13px] text-ink-muted">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/* ── 7 · Trust ────────────────────────────────────────────────────────── */

const PARTNERS = [
  { name: "VITTBI", image: "/images/partners/vit-tbi.jpg" },
  { name: "GSEA", image: "/images/partners/gsea.png" },
  { name: "build3", image: "/images/partners/build3.png" },
  { name: "Startupindia", image: "/images/partners/startupindia.png" },
  { name: "AU Bank", image: "/images/partners/au-bank.png" },
  { name: "NVIDIA", image: "/images/partners/nvidia.png" },
  { name: "PS Associates", image: "/images/partners/ps-associates.jpg" },
  { name: "AWS", image: "/images/partners/aws.png" },
];

export function TrustPartners() {
  const developers = Array.from(new Set(publishedProjects().map((p) => p.developer)));

  return (
    <Wrap className="pt-[var(--band)]">
      <SectionIndex n={7} total={8} className="mb-[var(--s-3)]" />
      <SectionHead
        label="Who we work with"
        note="Listings come from the developer or their appointed channel partner. Aarvasa holds no inventory and takes no fee from buyers."
      />

      {developers.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-[var(--s-10)] gap-y-2 border-y border-rule-firm py-[var(--s-6)]">
          {developers.map((d) => (
            <span key={d} className="av-display text-[clamp(18px,2vw,26px)] text-ink/75">
              {d}
            </span>
          ))}
        </div>
      )}

      <div className="mt-[var(--s-8)]">
        <span className="av-label text-ink-muted">Partners and programmes</span>
        <RevealGroup className="mt-[var(--s-5)] grid grid-cols-2 items-center gap-[var(--s-8)] sm:grid-cols-4">
          {PARTNERS.map((partner) => (
            <RevealItem key={partner.name} className="relative h-10">
              <Image
                src={partner.image}
                alt={partner.name}
                fill
                sizes="140px"
                className="object-contain object-left opacity-70 grayscale transition duration-500 hover:opacity-100 hover:grayscale-0"
              />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </Wrap>
  );
}

/* ── 8 · Closing ──────────────────────────────────────────────────────── */

export function ClosingCTA() {
  const project = publishedProjects().find((p) => p.images[0]);
  const closingImage = project?.imagery?.banners[1] ?? null;
  const cover = closingImage
    ? projectImageSrc(closingImage, "16x9")
    : (project?.images[0] ?? null);

  return (
    <StageBand className="mt-[var(--band)]">
      <Plate ratio="auto" scrim={Boolean(cover)} className="min-h-[460px] bg-stage">
        {cover && (
          <Parallax distance={30} className="absolute inset-0">
            <Image src={cover} alt="" fill sizes="100vw" className="object-cover object-[50%_35%]" />
          </Parallax>
        )}
        <DraftingGrid tone="stage" size={64} fade="bottom" className="z-[1] opacity-25" />
        <Grain opacity={0.06} className="z-[1]" />
        <CoordinateMarks tone="stage" className="z-[2] max-md:hidden" />
        <div className="absolute inset-x-0 bottom-0 z-[3] pb-[var(--s-14)] pt-[var(--s-24)]">
          <Wrap>
            <SectionIndex n={8} total={8} tone="stage" className="mb-[var(--s-3)]" />
            <TextReveal
              as="h2"
              text="Start with one building."
              className="av-display max-w-[16ch] text-[clamp(28px,4.4vw,56px)] leading-[1.02] text-stage-ink"
            />
            <p className="mt-[var(--s-3)] max-w-[48ch] text-[15px] leading-relaxed text-stage-muted">
              Search, walk it, compare it. Enquiries go straight to the developer — there is nothing
              to sign up for first.
            </p>
            <div className="mt-[var(--s-5)] flex flex-wrap gap-[var(--s-3)]">
              <Link
                href="/listings"
                className="av-label rounded-xs border border-gold bg-gold px-6 py-[14px] text-stage transition-colors hover:bg-transparent hover:text-gold"
              >
                Browse properties
              </Link>
              <Link
                href="/contact"
                className="av-label rounded-xs border border-stage-ink/35 px-6 py-[14px] text-stage-ink transition-colors hover:border-stage-ink"
              >
                Talk to the desk
              </Link>
            </div>
          </Wrap>
        </div>
      </Plate>
    </StageBand>
  );
}

export { Status };
