import Image from "next/image";
import Link from "next/link";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { StageHero } from "@/components/layout/nav-overlay";
import {
  Ledger,
  Plate,
  SectionHead,
  StageBand,
  Status,
  Wrap,
} from "@/components/av/primitives";
import { ProjectCards } from "@/components/property/project-cards";
import { publishedProjects } from "@/lib/projects";
import { formatCompact, inrEstimate } from "@/lib/currency";
import { projectViewerConfig } from "@/lib/viewer/project-media";

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
  const cover = feature?.images[0] ?? null;

  const copy = (
    <>
      <span className="av-meta text-gold">Discover · Explore · Evaluate</span>
      <h1 className="av-display mt-3 max-w-[13ch] text-[clamp(38px,6.6vw,84px)] leading-[0.98] text-stage-ink">
        Know the building before you stand in it.
      </h1>
      <p className="mt-[var(--s-4)] max-w-[46ch] text-[16px] leading-relaxed text-stage-muted md:text-[17px]">
        Premium homes, plots and offices — photographed, measured and, where they have been
        captured, walkable in three dimensions.
      </p>
      <div className="mt-[var(--s-6)] flex flex-wrap gap-[var(--s-3)]">
        <Link
          href="/listings"
          className="av-label rounded-xs border border-gold bg-gold px-6 py-[14px] text-stage transition-colors hover:bg-transparent hover:text-gold"
        >
          Browse properties
        </Link>
        {feature && (
          <Link
            href={`/projects/${feature.slug}`}
            className="av-label rounded-xs border border-stage-ink/35 px-6 py-[14px] text-stage-ink transition-colors hover:border-stage-ink"
          >
            Open {feature.name}
          </Link>
        )}
      </div>
    </>
  );

  return (
    <StageHero className="relative bg-stage">
      {/* Mobile: a portrait plate with the copy on solid stage beneath it. A
          scrim heavy enough to carry type over a bright render would bury the
          photograph on a narrow screen, so the two are separated instead. */}
      <div className="md:hidden">
        <Plate ratio="plate" className="bg-stage">
          {cover && (
            <Image
              src={cover}
              alt={`${feature.name}, ${feature.location}`}
              fill
              sizes="100vw"
              className="object-cover object-[50%_35%]"
              priority
            />
          )}
        </Plate>
        <Wrap className="py-[var(--s-10)]">{copy}</Wrap>
      </div>

      {/* Desktop: one cinematic frame, copy over the scrim. */}
      <div className="hidden md:block">
        <Plate ratio="auto" scrim={Boolean(cover)} className="h-[78vh] min-h-[520px] bg-stage">
          {cover && (
            <Image
              src={cover}
              alt={`${feature.name}, ${feature.location}`}
              fill
              sizes="100vw"
              className="object-cover object-[50%_28%]"
              priority
            />
          )}
          <div className="absolute inset-x-0 bottom-0 z-[2] pb-[var(--s-14)]">
            <Wrap>{copy}</Wrap>
          </div>
        </Plate>
      </div>
    </StageHero>
  );
}

/* ── 2 · Featured project ─────────────────────────────────────────────── */

export function FeaturedProject() {
  const project = publishedProjects().find((p) => p.images.length > 1) ?? publishedProjects()[0];
  if (!project) return null;

  const plate = project.images[1] ?? project.images[0] ?? null;
  const price =
    project.fromPrice > 0 ? formatCompact(project.fromPrice, project.currency) : "On request";
  const inr = inrEstimate(project.fromPrice, project.currency);

  return (
    <Wrap className="pt-[var(--band)]">
      <SectionHead
        label="Featured project"
        note="One project takes the full spread. Inventory and pricing are sourced from the developer."
      />
      <div className="grid grid-cols-1 items-start gap-[var(--s-14)] lg:grid-cols-[0.9fr_1.1fr]">
        <MotionReveal>
          <Link href={`/projects/${project.slug}`} data-hov className="block">
            <Plate ratio="plate">
              {plate ? (
                <Image
                  src={plate}
                  alt={`${project.name}, ${project.location}`}
                  fill
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-enter)] hover:scale-[1.03]"
                />
              ) : (
                <div className="absolute inset-0 flex items-end bg-paper-sunken p-4">
                  <span className="av-meta text-ink-disabled">Not yet photographed</span>
                </div>
              )}
            </Plate>
          </Link>
        </MotionReveal>

        <MotionReveal delay={0.09}>
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
        </MotionReveal>
      </div>
    </Wrap>
  );
}

/* ── 3 · Immersive ────────────────────────────────────────────────────── */

export function ImmersiveHome() {
  const projects = publishedProjects();
  const withModel = projects.filter((p) => projectViewerConfig(p));
  const feature = withModel[0] ?? null;

  // No published immersive media in this environment: the section is absent
  // rather than an empty shell with dead controls.
  if (!feature) return null;

  const cover = feature.images[0] ?? null;

  return (
    <StageBand className="mt-[var(--band)] py-[var(--band)]">
      <Wrap>
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
            <span aria-hidden="true" className="pointer-events-none absolute inset-[14px] z-[2]">
              {["top-0 left-0 border-r-0 border-b-0", "top-0 right-0 border-l-0 border-b-0", "bottom-0 left-0 border-r-0 border-t-0", "bottom-0 right-0 border-l-0 border-t-0"].map((pos) => (
                <i key={pos} className={`absolute h-4 w-4 border border-gold opacity-90 ${pos}`} />
              ))}
            </span>
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
      <SectionHead
        label="How Aarvasa works"
        title="Three steps today, five eventually"
        note="The last two are in development. They are drawn as roadmap here and appear nowhere else on the site."
      />
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
        <div className="mt-[var(--s-5)] grid grid-cols-2 items-center gap-[var(--s-8)] sm:grid-cols-4">
          {PARTNERS.map((partner) => (
            <div key={partner.name} className="relative h-10">
              <Image
                src={partner.image}
                alt={partner.name}
                fill
                sizes="140px"
                className="object-contain object-left opacity-70 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
              />
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/* ── 8 · Closing ──────────────────────────────────────────────────────── */

export function ClosingCTA() {
  const project = publishedProjects().find((p) => p.images[0]);
  const cover = project?.images[0] ?? null;

  return (
    <StageBand className="mt-[var(--band)]">
      <Plate ratio="auto" scrim={Boolean(cover)} className="min-h-[420px] bg-stage">
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[50%_35%]"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 z-[2] pb-[var(--s-14)] pt-[var(--s-24)]">
          <Wrap>
            <h2 className="av-display max-w-[16ch] text-[clamp(28px,4.4vw,56px)] leading-[1.02] text-stage-ink">
              Start with one building.
            </h2>
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
