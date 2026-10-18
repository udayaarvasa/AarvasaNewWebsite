import Link from "next/link";
import { Compass, ScanSearch, Scale, ArrowRight, PieChart, FileCheck2, Landmark } from "lucide-react";
import { FramedImage } from "@/components/av/framed-image";
import { Ledger, Note, SectionHead, Wrap } from "@/components/av/primitives";
import {
  ContourField,
  DraftingGrid,
  ElevationMotif,
  Grain,
  MeasureRule,
  PlanMotif,
  SectionIndex,
} from "@/components/av/graphics";
import { Reveal, RevealGroup, RevealItem, TextReveal } from "@/components/av/motion";
import { StatementBanner } from "@/components/av/banner";

export const metadata = {
  title: "Services | Aarvasa",
  description:
    "What Aarvasa does for buyers, owners, builders and channel partners — and what is still in development.",
};

/**
 * Rewritten around what the platform actually does.
 *
 * The previous page listed "Predictive ROI Analytics", "Blockchain
 * Verification", "Smart Contract Escrow", "Flexible Investment Models" and a
 * process ending in "instant ownership transfer" and "yield optimisation".
 * None of those exist, and they were presented as services on offer. They are
 * either dropped or moved into the roadmap section, which says plainly that
 * they are not available.
 *
 * The "₹70+ Cr listings value" and "100% verified network" hero tiles are not
 * carried over: neither is verifiable from the platform's own data.
 */

type Motif = "elevation" | "plan" | "contour";

const audiences: {
  label: string;
  title: string;
  body: string;
  includes: [string, string][];
  motif: Motif;
  image: { src: string; alt: string; caption: string };
}[] = [
  {
    label: "For buyers",
    title: "Find it, read it, compare it",
    body: "Search the platform on city, budget, configuration and specification, open the immersive formats a project has actually produced, and put a shortlist of three side by side before you travel. Enquiries go straight to the developer; you pay Aarvasa nothing.",
    includes: [
      ["Search and filters", "City, budget, configuration, type and verified-only, held in the URL"],
      ["Immersive exploration", "3D models, 360° tours and scans, wherever they have been captured"],
      ["Side-by-side comparison", "Up to three properties on price, specification and locality"],
      ["Direct enquiry", "Routed to the developer or their appointed channel partner"],
    ],
    motif: "elevation",
    image: { src: "/images/reef-996/gallery/showapt-living-3x2.jpg", alt: "A furnished show apartment living room at REEF 996", caption: "Show apartment · REEF 996" },
  },
  {
    label: "For owners and occupiers",
    title: "Information that survives scrutiny",
    body: "Specification as filed, approval status, areas, payment schedules and handover dates — the things a lawyer and a lender will ask about, gathered in one place before you need them.",
    includes: [
      ["Filed specification", "Structure, plot, areas and ceiling heights as the developer filed them"],
      ["Approvals and status", "What has been sanctioned, and where the project currently stands"],
      ["Payment schedules", "Published plans, with the currency the developer contracts in"],
      ["Layout drawings", "Published as drawings and labelled as such, never as photography"],
    ],
    motif: "plan",
    image: { src: "/images/reef-996/architecture/reef-996-facade-detail-3x2.jpg", alt: "Facade detail of REEF 996", caption: "Developer render · REEF 996" },
  },
  {
    label: "For builders",
    title: "Show the building properly",
    body: "We photograph, model and capture a project once and publish it across the platform — the cinematic hero, the navigable model, the 360° tour and the measured plans, all from the same production.",
    includes: [
      ["Capture and production", "Photography, 3D models, 360° panoramas and Gaussian splat scans"],
      ["Project page", "A full specification page with your inventory and payment plans"],
      ["Review and publishing", "Assets go live only once reviewed and published"],
      ["Enquiry routing", "Enquiries delivered with the context the buyer already gave"],
    ],
    motif: "contour",
    image: { src: "/images/reef-996/architecture/reef-996-tower-elevation-day-3x2.jpg", alt: "REEF 996 tower elevation in daylight", caption: "Developer render · REEF 996" },
  },
  {
    label: "For channel partners",
    title: "One place to send a serious buyer",
    body: "Listings stay accurate because they come from the filing rather than a brochure. Enquiries arrive with the buyer's shortlist and the questions they have already asked.",
    includes: [
      ["Verified listings", "Published from developer-filed data"],
      ["Qualified enquiries", "With the buyer's stated city, budget and configuration"],
      ["Shortlist context", "What else the buyer is comparing this against"],
      ["Agent network", "A listed presence on the Aarvasa agents directory"],
    ],
    motif: "plan",
    image: { src: "/images/reef-996/amenities/reef-996-pool-cabanas-3x2.jpg", alt: "Pool cabanas at REEF 996", caption: "Developer render · REEF 996" },
  },
];

function Motif({ kind, tone }: { kind: Motif; tone: "paper" | "stage" }) {
  if (kind === "elevation") return <ElevationMotif tone={tone} storeys={15} accentRow={4} />;
  if (kind === "plan") return <PlanMotif tone={tone} />;
  return (
    <div className="relative h-full w-full">
      <ContourField tone={tone} seed={9} />
    </div>
  );
}

const PROCESS_ICONS = [ScanSearch, Compass, Scale];

const process = [
  ["Discover", "Search the platform on the specification that decides it, or describe what you want to the advisor."],
  ["Explore", "Open the developer's imagery and measured plans. 3D and 360° captures appear wherever they have been produced."],
  ["Evaluate", "Compare a shortlist of three, then send one enquiry to the developer."],
];

export default function ServicesPage() {
  return (
    <div className="pb-[var(--s-24)]">
      <section className="relative isolate overflow-hidden bg-paper-sunken pb-[var(--band)] pt-[var(--s-10)]">
        <DraftingGrid size={44} fade="radial" className="opacity-25" />
        <Grain opacity={0.04} />
        <Wrap className="relative z-[2] grid items-center gap-[var(--s-14)] lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="av-label text-gold-ink">Services</span>
            <TextReveal
              as="h1"
              text="Four people use Aarvasa. It is built for all four."
              className="av-display mt-2 max-w-[20ch] text-[clamp(32px,4.6vw,56px)] leading-[1.02]"
            />
            <p className="mt-[var(--s-4)] max-w-[54ch] text-[17px] leading-relaxed text-ink-muted">
              Buyers and occupiers on one side, builders and their channel partners on the other. The
              same captured project serves both.
            </p>
            <div className="mt-[var(--s-6)] max-w-[440px]">
              <MeasureRule />
            </div>
            <div className="mt-[var(--s-8)] flex flex-wrap gap-[var(--s-3)]">
              <Link href="/listings" className="av-gold av-label inline-flex items-center gap-2 px-6 py-[13px]">
                Browse properties <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="av-label rounded-xs border border-rule-firm px-6 py-[13px] text-ink transition-colors hover:bg-paper"
              >
                Talk to the desk
              </Link>
            </div>
          </div>

          {/* Two frames of one real project: the tower, and a room inside it. */}
          <div className="relative mx-auto h-[380px] w-full max-w-[520px] sm:h-[460px]">
            <FramedImage
              src="/images/reef-996/hero/reef-996-tower-aerial-4x5.jpg"
              alt="REEF 996 from the air"
              caption="Developer render · REEF 996"
              sizes="(min-width: 1024px) 340px, 70vw"
              priority
              captionAt="top"
              className="absolute right-0 top-0 h-[78%] w-[66%]"
            />
            <FramedImage
              src="/images/reef-996/gallery/showapt-bedroom-4x5.jpg"
              alt="Bedroom of the REEF 996 show apartment"
              caption="Show apartment"
              sizes="(min-width: 1024px) 240px, 50vw"
              offset="tl"
              className="av-float absolute bottom-0 left-0 h-[56%] w-[48%] shadow-[0_24px_60px_rgba(31,27,23,0.22)]"
            />
          </div>
        </Wrap>
      </section>

      {/* How it works — on wine, the brand's own ground */}
      <section data-surface="wine" className="relative isolate overflow-hidden py-[var(--band)]">
        <ContourField tone="stage" seed={5} className="opacity-25" />
        <Wrap className="relative z-[2]">
          <span className="av-label text-gold">How it works</span>
          <h2 className="av-display mt-2 text-[clamp(28px,3.6vw,44px)] leading-[1.05] text-wine-ink">
            Discover, explore, evaluate
          </h2>
          <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-wine-muted">
            Three steps that exist today. Investment and ownership are in development and are not offered.
          </p>
          <ol className="mt-[var(--s-10)] grid gap-px overflow-hidden border border-wine-rule bg-wine-rule md:grid-cols-3">
            {process.map(([t, d], i) => {
              const Icon = PROCESS_ICONS[i];
              return (
                <li key={t} className="group bg-wine p-[var(--s-8)] transition-colors duration-300 hover:bg-wine-raised">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 text-gold transition-transform duration-500 group-hover:rotate-[8deg] group-hover:scale-105">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="av-display text-[44px] leading-none text-gold/35">0{i + 1}</span>
                  </div>
                  <h3 className="av-display mt-[var(--s-6)] text-[26px] text-wine-ink">{t}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-wine-muted">{d}</p>
                </li>
              );
            })}
          </ol>
        </Wrap>
      </section>

      {audiences.map((a, i) => (
        <section
          key={a.label}
          className={
            i % 2 === 1
              ? "relative isolate mt-[var(--band)] overflow-hidden bg-paper-sunken py-[var(--band-tight)]"
              : "mt-[var(--band)]"
          }
        >
          {i % 2 === 1 && <DraftingGrid size={40} fade="radial" className="opacity-20" />}
          <Wrap className="relative z-[2]">
            <Reveal>
              <SectionIndex n={i + 1} total={audiences.length} className="mb-[var(--s-3)]" />
              <SectionHead label={a.label} title={a.title} />
              <div className="-mt-[var(--s-6)] grid grid-cols-1 items-center gap-[var(--s-10)] lg:grid-cols-[1fr_0.85fr]">
                <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
                  <p className="max-w-[var(--measure)] text-[17px] leading-[1.75]">{a.body}</p>
                  <div className="mt-[var(--s-6)]">
                    <Ledger rows={a.includes.map(([t, d]) => ({ term: t, value: d }))} />
                  </div>
                </div>
                <div className={`relative h-[300px] md:h-[400px] ${i % 2 === 1 ? "lg:order-1" : ""}`}>
                  <FramedImage
                    src={a.image.src}
                    alt={a.image.alt}
                    caption={a.image.caption}
                    sizes="(min-width: 1024px) 45vw, 100vw"
                    offset={i % 2 === 1 ? "bl" : "br"}
                    className="h-full w-full"
                  />
                  {/* The drawing behind the picture: the site's own line work */}
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute -bottom-8 hidden h-[46%] w-[40%] opacity-70 md:block ${i % 2 === 1 ? "-right-10" : "-left-10"}`}
                  >
                    <Motif kind={a.motif} tone="paper" />
                  </div>
                </div>
              </div>
            </Reveal>
          </Wrap>
        </section>
      ))}

      <div className="mt-[var(--band)]">
        <StatementBanner
          eyebrow="What we do not do"
          title="No yields. No forecasts. No ownership claims."
          body="Aarvasa is a property discovery and marketing platform. Everything below is in development and is not offered today."
          image={{
            backdrop: "/images/reef-996/banners/reef-996-tower-facade-night-16x9.jpg",
            inset: "/images/reef-997/interiors/reef-997-bedroom-4x5.jpg",
            alt: "A REEF 997 bedroom",
            caption: "Developer render · REEF 997",
          }}
        />
      </div>

      <Wrap className="pt-[var(--band)]">
        <SectionHead
          label="In development"
          title="Not offered today"
          note="Listed here so the roadmap is visible without being sold anywhere else on the site."
        />
        {/* Roadmap as cards, each plainly marked as not yet offered */}
        <RevealGroup className="-mt-[var(--s-6)] grid gap-[var(--s-5)] md:grid-cols-3">
          {[
            { icon: PieChart, title: "Fractional participation", body: "A way to take a share in a property rather than the whole of it." },
            { icon: FileCheck2, title: "Digital records of title", body: "Verifiable ownership records and transfer history." },
            { icon: Landmark, title: "Escrow automation", body: "Automated, milestone-linked release of funds." },
          ].map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <div className="group relative h-full overflow-hidden rounded-sm border border-rule bg-paper-raised p-[var(--s-6)] transition-all duration-500 hover:-translate-y-1 hover:border-gold-ink/40 hover:shadow-[var(--e-over)]">
                <div aria-hidden="true" className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-burgundy-wash transition-transform duration-700 group-hover:scale-150" />
                <div className="relative flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-wine text-gold">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="av-meta rounded-xs border border-rule-firm px-2 py-[3px] text-ink-muted">In development</span>
                </div>
                <h3 className="relative mt-[var(--s-5)] text-[17px] font-semibold">{title}</h3>
                <p className="relative mt-1 text-[14px] leading-relaxed text-ink-muted">{body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
        <Note className="mt-[var(--s-5)] max-w-none">
          Aarvasa is a property discovery and marketing platform. It does not offer investment
          products, fractional ownership, tokenised title or any financial service, and it does not
          give investment advice. These layers are in development and will carry their own
          disclosures if and when they launch.
        </Note>
      </Wrap>

    </div>
  );
}
