import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Compass,
  FileText,
  MapPin,
  MapPinned,
  Scale,
  ScanSearch,
  Search,
  Sparkles,
} from "lucide-react";
import { StageHero } from "@/components/layout/nav-overlay";
import { CountUp } from "@/components/av/count-up";
import { HeroCarousel, type HeroSlide } from "./hero-carousel";
import { LedgerChain } from "./ledger-chain";
import { FadeUp, LuxHeading, ParallaxLayer, Stagger, StaggerItem, Tilt } from "./motion";
import { Aurora, Container, GhostButton, GoldButton, Marquee, Noise, SectionTitle } from "./primitives";
import { ProjectRail } from "./project-rail";
import { Showcase, type ShowcaseFrame } from "./showcase";
import { projectImageSrc } from "@/lib/project-types";
import { publishedProjects } from "@/lib/projects";
import { featuredProject, platformFigures, priceOf, railProjects } from "@/lib/lux-data";
import { formatCurrency } from "@/lib/currency";
import { STOCK } from "@/lib/stock-imagery";

/* Stock photography of Dubai, captioned as such (src/lib/stock-imagery.ts).
   The REEF renders that were here are withheld until permission is on record. */
const HERO_SLIDES: HeroSlide[] = [
  STOCK.dubaiSunset,
  { ...STOCK.dubaiDusk, position: "50% 40%" },
  STOCK.downtownDubai,
  { ...STOCK.towerDetail, position: "50% 30%" },
];

/* ── 1 · Hero ─────────────────────────────────────────────────────────── */

export function LuxHero() {
  const figures = platformFigures();
  return (
    <StageHero className="relative isolate min-h-[100svh] overflow-hidden">
      <HeroCarousel slides={HERO_SLIDES} />
      <Container className="relative z-[3] flex min-h-[100svh] flex-col justify-end pb-[clamp(88px,12vh,140px)] pt-[140px]">
        <FadeUp immediate delay={0.2} y={14}>
          <span className="lux-eyebrow">Aarvasa · Luxury real estate</span>
        </FadeUp>
        <LuxHeading
          as="h1"
          immediate
          delay={0.35}
          text="Know the *building* before you own the *address.*"
          className="av-display mt-5 max-w-[15ch] text-[clamp(48px,8.2vw,124px)] font-light leading-[0.92] text-stage-ink"
        />
        <FadeUp immediate delay={0.9} className="mt-6 max-w-[52ch] text-[clamp(15px,1.3vw,18px)] leading-relaxed text-stage-muted">
          Premium residences and plots, set out exactly as their developers filed them — the specification,
          the approvals, the payment plans — and a 3D model wherever one has been captured.
        </FadeUp>

        {/* Search: posts straight into the listings filters */}
        <FadeUp immediate delay={1.05} className="mt-8 w-full max-w-[860px]">
          <form action="/listings" className="lux-glass-strong flex flex-col gap-2 rounded-[26px] p-2 sm:flex-row sm:items-center sm:rounded-full">
            <label className="flex flex-1 items-center gap-3 rounded-full px-5 py-3">
              <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <span className="sr-only">City, project or developer</span>
              <input
                name="search"
                placeholder="City, project or developer"
                className="w-full bg-transparent text-[15px] text-stage-ink outline-none placeholder:text-stage-muted"
              />
            </label>
            <span aria-hidden="true" className="hidden h-8 w-px bg-white/15 sm:block" />
            <label className="flex items-center gap-2 rounded-full px-5 py-3">
              <Building2 className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
              <span className="sr-only">Property type</span>
              <select name="propertyType" defaultValue="" className="bg-transparent text-[14px] text-stage-ink outline-none">
                <option value="">Any type</option>
                <option value="APARTMENT">Apartment</option>
                <option value="VILLA">Villa</option>
                <option value="PENTHOUSE">Penthouse</option>
                <option value="PLOT">Plot</option>
                <option value="OFFICE">Office</option>
              </select>
            </label>
            <button
              type="submit"
              className="av-gold flex items-center justify-center gap-2 rounded-full px-7 py-[14px] text-[13px] font-semibold uppercase tracking-[0.14em]"
            >
              <Search className="h-4 w-4" aria-hidden="true" /> Search
            </button>
          </form>
        </FadeUp>

        <FadeUp immediate delay={1.25} className="mt-8 hidden gap-3 md:flex">
          {figures.map((f) => (
            <div key={f.label} className="lux-glass rounded-2xl px-5 py-3">
              <div className="av-display text-[30px] leading-none text-stage-ink">
                <CountUp value={f.value} />
                {f.suffix && <span className="text-gold">{f.suffix}</span>}
              </div>
              <div className="av-meta mt-1.5 text-[9.5px] text-stage-muted">{f.label}</div>
            </div>
          ))}
        </FadeUp>
      </Container>

      <div aria-hidden="true" className="lux-scroll-cue absolute bottom-8 left-1/2 z-[3] hidden h-12 w-px -translate-x-1/2 overflow-hidden bg-white/15 md:block">
        <span className="block h-1/2 w-full bg-gold" />
      </div>
    </StageHero>
  );
}

/* ── 2 · Marquee ──────────────────────────────────────────────────────── */

export function PlacesMarquee() {
  const items = publishedProjects().map((p) => (
    <span key={p.slug} className="av-display whitespace-nowrap text-[clamp(28px,3.4vw,46px)] font-light text-ink/80">
      {p.name} <em className="lux-gold-text not-italic">·</em>{" "}
      <span className="italic text-ink-muted">{p.city}</span>
    </span>
  ));
  return (
    <section className="border-y border-rule py-8">
      <Marquee items={items} />
    </section>
  );
}

/* ── 3 · Featured project ─────────────────────────────────────────────── */

export function FeaturedShowcase() {
  const p = featuredProject();
  if (!p) return null;
  const { price, note } = priceOf(p);
  const frames: ShowcaseFrame[] = p.imagery
    ? [p.imagery.hero, ...p.imagery.gallery].slice(0, 4).map((img) => ({
        src: projectImageSrc(img, "4x5"),
        thumb: projectImageSrc(img, "1x1"),
        alt: img.alt,
        caption: img.origin === "render" && !/render/i.test(img.caption) ? `${img.caption} · Developer render` : img.caption,
      }))
    : p.images.slice(0, 4).map((src) => ({ src, thumb: src, alt: p.name, caption: p.name }));

  return (
    <section className="relative isolate overflow-hidden py-[clamp(80px,12vw,160px)]">
      <Aurora />
      <Container>
        <SectionTitle
          /* "Exclusive to Aarvasa" was removed: no exclusivity agreement is on
             record. Restore it only with that agreement in hand. */
          eyebrow="Featured"
          title={`${p.name} *${p.city}*`}
          note="One project takes the full spread. Inventory, prices and plans come from the developer's own release."
        />
        <div className="mt-[var(--s-14)] grid items-start gap-[var(--s-14)] lg:grid-cols-[1fr_1.05fr]">
          <FadeUp>
            <Showcase frames={frames} />
          </FadeUp>

          <div className="lux-glass lux-gold-border rounded-[30px] p-[clamp(24px,3vw,44px)]">
            <span className="av-meta flex items-center gap-2 text-[11px] text-gold">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {p.location}
            </span>
            <p className="mt-5 text-[17px] leading-relaxed text-ink-muted">
              {p.usps[0] ?? `${p.kind === "plots" ? "Plots" : "Residences"} by ${p.developer}.`}
            </p>

            <div className="mt-8">
              <div className="av-meta text-[10px] text-ink-muted">Starting from</div>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="av-display lux-gold-text text-[clamp(44px,5vw,64px)] font-normal leading-none">{price}</span>
                {note && <span className="text-[15px] text-ink-muted">{note}</span>}
              </div>
            </div>

            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Completion", p.completion ?? "—"],
                [p.kind === "plots" ? "Plots" : "Residences", p.totalUnits ? String(p.totalUnits) : "—"],
                ["Sizes", p.minSqft ? `${p.minSqft.toLocaleString()}–${p.maxSqft.toLocaleString()} sq.ft` : "—"],
                ["City", p.city],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-rule bg-white/[0.02] px-4 py-3">
                  <dt className="av-meta text-[9.5px] text-ink-muted">{k}</dt>
                  <dd className="mt-1.5 text-[14px] font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            {p.unitTypes.length > 0 && (
              <div className="mt-8">
                <div className="av-meta text-[10px] text-ink-muted">Available configurations</div>
                <Stagger className="mt-3 grid gap-2 sm:grid-cols-2" gap={0.06}>
                  {p.unitTypes.map((u) => (
                    <StaggerItem key={u.type}>
                      <div className="flex items-center justify-between rounded-full border border-rule px-4 py-2.5 text-[13.5px] transition-colors hover:border-gold/60">
                        <span className="font-semibold text-ink">{u.label}</span>
                        <span className="text-ink-muted">{u.fromPrice > 0 ? `from ${formatCurrency(u.fromPrice, p.currency)}` : "price on request"}</span>
                      </div>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            )}

            <div className="mt-10 flex flex-wrap gap-3">
              <GoldButton href={`/projects/${p.slug}`}>View {p.name}</GoldButton>
              <GhostButton href={`/contact?project=${encodeURIComponent(p.name)}`}>Request inventory</GhostButton>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ── 4 · The collection rail ──────────────────────────────────────────── */

export function CollectionRail() {
  return (
    <section className="relative isolate bg-paper-sunken pt-[clamp(80px,10vw,140px)]">
      <Noise />
      <Container>
        <SectionTitle
          eyebrow="The collection"
          title="Addresses worth *the journey.*"
          note={
            <>
              Every listed project, from Dubai to Bhopal.{" "}
              <Link href="/listings" className="text-gold underline-offset-4 hover:underline">
                See all properties
              </Link>
            </>
          }
        />
      </Container>
      <div className="mt-[var(--s-10)]">
        <ProjectRail projects={railProjects()} />
      </div>
      <div className="h-[clamp(64px,8vw,120px)]" />
    </section>
  );
}

/* ── 5 · Pillars ──────────────────────────────────────────────────────── */

const PILLARS = [
  {
    icon: ScanSearch,
    title: "Discover",
    body: "Search on city, budget, configuration and specification. Filters that hold, and a link you can share.",
    image: STOCK.glassTowers.src,
  },
  {
    icon: Compass,
    title: "Explore",
    body: "Measured plans and the developer's specification — and 3D or 360° wherever a building has been captured.",
    image: STOCK.openPlan.src,
  },
  {
    icon: Scale,
    title: "Evaluate",
    body: "Three properties side by side on price, specification and locality. Then one enquiry, by email.",
    image: STOCK.staircase.src,
  },
];

export function Pillars() {
  return (
    <section className="relative isolate overflow-hidden py-[clamp(80px,12vw,160px)]">
      <Aurora className="opacity-70" />
      <Container>
        <SectionTitle
          eyebrow="How Aarvasa works"
          title="Three steps to *certainty.*"
          align="center"
          note="Investment and digital ownership are on the roadmap, and shown only as that."
        />
        <Stagger className="mt-[var(--s-14)] grid gap-6 md:grid-cols-3" gap={0.14}>
          {PILLARS.map(({ icon: Icon, title, body, image }, i) => (
            <StaggerItem key={title}>
              <Tilt className="h-full rounded-[28px]">
                <div className="group lux-gold-border flex h-full flex-col overflow-hidden rounded-[28px] bg-paper-raised">
                  <div className="relative aspect-[3/2] overflow-hidden">
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,var(--paper-raised))]" />
                    <span className="av-display absolute right-5 top-3 text-[64px] font-light text-white/25">0{i + 1}</span>
                  </div>
                  <div className="relative -mt-8 flex flex-1 flex-col px-7 pb-8">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4f060c,#7a0f19)] text-gold-pale shadow-[0_12px_30px_rgba(122,15,25,0.45)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <h3 className="av-display mt-6 text-[38px] font-normal leading-none text-ink">{title}</h3>
                    <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">{body}</p>
                  </div>
                </div>
              </Tilt>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}

/* ── 6 · The ledger (blockchain) ──────────────────────────────────────── */

export function LedgerSection() {
  return (
    <section data-surface="stage" className="relative isolate overflow-hidden bg-[radial-gradient(120%_90%_at_50%_0%,#4f060c_0%,#12070a_62%)] py-[clamp(80px,12vw,160px)]">
      {/* A hex lattice, faint, like a ledger's grid */}
      <svg aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full opacity-[0.07]">
        <defs>
          <pattern id="hex" width="56" height="48.5" patternUnits="userSpaceOnUse" patternTransform="scale(1.2)">
            <path d="M14 0h28l14 24.25L42 48.5H14L0 24.25z" fill="none" stroke="#dcc6a0" strokeWidth="0.8" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)" />
      </svg>
      <Noise />
      <Container>
        <SectionTitle
          eyebrow="The Aarvasa ledger"
          title="Built on the *record.* Ready for the *chain.*"
          note="Every listing is traceable to what its developer filed. The on-chain title registry and escrow are in development — shown here as the roadmap they are, never as a live service."
        />
        <div className="mt-[var(--s-14)]">
          <LedgerChain />
        </div>
        <FadeUp delay={0.3} className="mt-[var(--s-10)] flex flex-wrap items-center gap-4">
          <GhostButton href="/blockchain">Read the roadmap</GhostButton>
          <span className="av-meta text-[10px] text-ink-muted">No token sale · No yield · No investment product</span>
        </FadeUp>
      </Container>
    </section>
  );
}

/* ── 7 · Figures ──────────────────────────────────────────────────────── */

export function FiguresBand() {
  const figures = platformFigures();
  return (
    <section data-surface="stage" className="relative isolate overflow-hidden">
      <ParallaxLayer className="absolute inset-0 -z-10" speed={0.15}>
        <Image src={STOCK.dubaiSunset.src} alt="" fill sizes="100vw" className="object-cover opacity-35" />
      </ParallaxLayer>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(12,9,9,0.95),rgba(79,6,12,0.75),rgba(12,9,9,0.95))]" />
      <Container className="py-[clamp(64px,9vw,120px)]">
        <dl className="grid grid-cols-2 gap-y-12 lg:grid-cols-4">
          {figures.map((f, i) => (
            <FadeUp key={f.label} delay={i * 0.1} className={`flex flex-col ${i > 0 ? "lg:border-l lg:border-rule lg:pl-10" : ""}`}>
              <dd className="av-display lux-gold-text order-1 pt-[0.12em] text-[clamp(56px,7vw,104px)] font-light leading-[1.05]">
                <CountUp value={f.value} />
                {f.suffix}
              </dd>
              <dt className="av-meta order-2 mt-3 text-[11px] text-ink-muted">{f.label}</dt>
            </FadeUp>
          ))}
        </dl>
      </Container>
    </section>
  );
}

/* ── 8 · Advisor ──────────────────────────────────────────────────────── */

export function AdvisorSection() {
  return (
    <section className="relative isolate overflow-hidden py-[clamp(80px,12vw,160px)]">
      <Aurora className="opacity-60" />
      <Container className="grid items-center gap-[var(--s-14)] lg:grid-cols-[1fr_1fr]">
        <div>
          <SectionTitle eyebrow="Property intelligence" title="Ask in a *sentence.*" />
          <FadeUp delay={0.2} className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-ink-muted">
            Describe the home you want. The advisor reads the specification sheets and developer filings behind every
            listing and answers in plain language, with its sources beside each claim. It will not forecast a price or
            quote a yield.
          </FadeUp>
          <FadeUp delay={0.3} className="mt-8">
            <GoldButton href="/ai-chat">Open the advisor</GoldButton>
          </FadeUp>
        </div>

        <FadeUp delay={0.15}>
          <Tilt className="rounded-[30px]" max={5}>
            <div className="lux-glass-strong lux-gold-border rounded-[30px] p-6">
              <div className="flex items-center gap-3 border-b border-rule pb-4">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#4f060c,#7a0f19)] text-gold-pale lux-pulse">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-ink">Aarvasa advisor</div>
                  <div className="av-meta text-[9.5px] text-ink-muted">Illustration</div>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                <p className="max-w-[80%] rounded-[20px] rounded-br-md [background:var(--gold-sheen)] px-4 py-3 text-[14px] font-medium leading-relaxed text-[var(--action-ink)]">
                  A two-bedroom in Dubai, ready by 2028, with outdoor space I can actually use in summer?
                </p>
              </div>
              <div className="mt-4 max-w-[88%] rounded-[20px] rounded-bl-md border border-rule bg-white/[0.03] px-4 py-4">
                <span className="flex items-center gap-2 text-[13.5px] text-ink-muted">
                  Reading the developer filings
                  <span className="av-dots inline-flex gap-1" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    [FileText, "Specification sheet"],
                    [BadgeCheck, "Approvals"],
                    [MapPinned, "Locality"],
                  ].map(([Icon, label]) => {
                    const I = Icon as typeof FileText;
                    return (
                      <span key={label as string} className="av-meta inline-flex items-center gap-1.5 rounded-full border border-gold/35 px-3 py-1.5 text-[10px] text-gold">
                        <I className="h-3 w-3" aria-hidden="true" /> {label as string}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </Tilt>
        </FadeUp>
      </Container>
    </section>
  );
}

/* ── 9 · Partners ─────────────────────────────────────────────────────── */

const PARTNERS = [
  { name: "VIT TBI", image: "/images/partners/vit-tbi.jpg" },
  { name: "GSEA", image: "/images/partners/gsea.png" },
  { name: "build3", image: "/images/partners/build3.png" },
  { name: "Startup India", image: "/images/partners/startupindia.png" },
  { name: "AU Bank", image: "/images/partners/au-bank.png" },
  { name: "NVIDIA", image: "/images/partners/nvidia.png" },
  { name: "PS Associates", image: "/images/partners/ps-associates.jpg" },
  { name: "AWS", image: "/images/partners/aws.png" },
];

export function PartnersBand() {
  const developers = Array.from(new Set(publishedProjects().map((p) => p.developer)));
  return (
    <section className="py-[clamp(64px,9vw,120px)]">
      <Container>
        <div className="flex flex-col items-center text-center">
          <span className="lux-eyebrow">Who we work with</span>
          <div className="mt-6 flex flex-wrap justify-center gap-x-12 gap-y-3">
            {developers.map((d) => (
              <span key={d} className="av-display text-[clamp(26px,3vw,40px)] font-light italic text-ink">
                {d}
              </span>
            ))}
          </div>
          <p className="mt-4 max-w-[52ch] text-[14px] text-ink-muted">
            Listings come from the developer or their appointed channel partner. Aarvasa holds no inventory and takes no
            fee from buyers.
          </p>
        </div>
      </Container>
      <div className="mt-12">
        <Marquee
          items={PARTNERS.map((p) => (
            <span key={p.name} className="relative block h-12 w-[140px] rounded-xl bg-white/90 px-4 py-2">
              <Image src={p.image} alt="" fill sizes="140px" className="object-contain p-2" />
            </span>
          ))}
        />
        <p className="av-meta mt-4 text-center text-[10px] text-ink-muted">Programmes and partners</p>
      </div>
    </section>
  );
}

/* ── 10 · Closing ─────────────────────────────────────────────────────── */

export function ClosingInvitation() {
  return (
    <section data-surface="stage" className="relative isolate overflow-hidden">
      <ParallaxLayer className="absolute inset-0 -z-10" speed={0.18}>
        <Image src={STOCK.dubaiDusk.src} alt="" fill sizes="100vw" className="object-cover" />
      </ParallaxLayer>
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(80%_80%_at_50%_50%,rgba(7,5,5,0.55),rgba(7,5,5,0.95))]" />
      <Container className="flex min-h-[80vh] flex-col items-center justify-center py-28 text-center">
        <span className="lux-eyebrow">Your next address</span>
        <LuxHeading
          text="Begin with *one* building."
          className="av-display mt-5 max-w-[14ch] text-[clamp(48px,7.4vw,112px)] font-light leading-[0.95] text-stage-ink"
        />
        <FadeUp delay={0.3} className="mt-6 max-w-[46ch] text-[16px] leading-relaxed text-stage-muted">
          Open a project, read what its developer filed, and send one enquiry when you are ready. Nothing to sign up for
          first.
        </FadeUp>
        <FadeUp delay={0.45} className="mt-10 flex flex-wrap justify-center gap-3">
          <GoldButton href="/listings">Explore properties</GoldButton>
          <GhostButton href="/contact">
            Talk to the desk <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </GhostButton>
        </FadeUp>
      </Container>
    </section>
  );
}
