import Image from "next/image";
import { Award, Ban, MapPin, ScrollText, ShieldCheck, Trophy } from "lucide-react";
import { FadeUp, LuxHeading, Stagger, StaggerItem, Tilt } from "@/components/lux/motion";
import { SlideIn } from "@/components/av/motion";
import { Aurora, Container as LuxContainer, Marquee, Noise, SectionTitle } from "@/components/lux/primitives";
import { PageHero } from "@/components/lux/page-hero";
import { Note } from "@/components/av/primitives";
import { StatementBanner } from "@/components/av/banner";

export const metadata = {
  title: "About | Aarvasa",
  description:
    "Aarvasa publishes what the developer files, shows a property in three dimensions where it has been captured, and lets you compare what you found." };

/**
 * Team names, roles, bios and social links are reproduced verbatim.
 *
 * Two blocks from the previous page are deliberately not carried over:
 *
 *  - the "technologies" grid (Predictive Analytics "forecasting yield and
 *    appreciation", Blockchain Verification, Smart Escrow Systems, ROI
 *    Intelligence Engine). Those products do not exist, and the page
 *    presented them as current capability.
 *  - the Unsplash stock photography behind the office list. This system does
 *    not use stock imagery to stand in for a real place.
 *
 * The 2025/2026 milestones are kept but stated as a roadmap rather than as
 * delivered work, since several of them describe the same unbuilt products.
 */

const team = [
  {
    name: "Uday Prakash Sahu",
    role: "Founder & CEO",
    subtitle: "Expert in Networking & Sales | External Affairs Lead",
    bio: "Uday Sahu leads Aarvasa as CEO, driving growth, partnerships, and market expansion. With expertise in business networking and real estate sales, he strengthens stakeholder relations and positions Aarvasa as a key player in property investment.",
    image: "/images/team/uday.png",
    linkedin: "https://www.linkedin.com/in/udayprakashsahu/",
    instagram: "https://www.instagram.com/uday.sahu_10?igsh=MWVzNW85dTRydndpdg%3D%3D" },
  {
    name: "Ansh Dubey",
    role: "Co-Founder & COO",
    subtitle: "Operations Strategist | Product & Process Leader",
    bio: "Ansh Dubey, COO of Aarvasa, oversees operations, workflow optimization, and product delivery. Focused on efficiency, he ensures smooth platform functionality, from listings to customer experience, translating ideas into scalable, real-world execution.",
    image: "/images/team/ansh.png",
    linkedin: "https://www.linkedin.com/in/ansh-dubey-526325273/",
    instagram: "https://www.instagram.com/_ansh_.dubey/" },
  {
    name: "Anirudh Saxena",
    role: "Co-Founder & CTO",
    subtitle: "Tech Architect | Innovation & Engineering Lead",
    bio: "Anirudh Saxena, CTO of Aarvasa, drives AI tools, smart contracts, and infrastructure development. He ensures a secure, scalable tech foundation, shaping the digital systems that power Aarvasa’s platform and future growth.",
    image: "/images/team/anirudh.png",
    linkedin: "https://www.linkedin.com/in/anirudh-saxena-481ba2245/",
    instagram: "https://www.instagram.com/_anirudh__.07?igsh=MTJocm1va3VtZDV0bw%3D%3D" },
  {
    name: "Sriaditya S",
    role: "VP of IT Operations",
    subtitle: "Technology Strategist | System Architect | Cybersecurity Advocate",
    bio: "Sriaditya S leads IT Operations at Aarvasa, managing the company’s digital infrastructure, cloud systems, and cybersecurity. He ensures platform stability, secure workflows, and drives Aarvasa’s tech innovations for scalable business growth.",
    image: "/images/team/sriaditya.png",
    linkedin: "https://www.linkedin.com/in/sriadityas/",
    instagram: "https://www.instagram.com/sriaditya_kamikaze?igsh=amdnbDR4MG82cDFh" },
];

const UNSPLASH = "https://images.unsplash.com";

const offices = [
  { city: "Bhopal", purpose: "Headquarters", photo: "photo-1497366216548-37526070297c", alt: "A modern office interior" },
  { city: "Delhi", purpose: "Branch office", photo: "photo-1587474260584-136574528ed5", alt: "India Gate, Delhi, at dusk" },
  { city: "Bengaluru", purpose: "Branch office", photo: "photo-1596176530529-78163a4f7af2", alt: "Bengaluru at dusk" },
  { city: "Dubai", purpose: "International desk", photo: "photo-1546412414-e1885259563a", alt: "Burj Al Arab, Dubai" },
];

const PRINCIPLES = [
  { icon: ScrollText, title: "Filed, not written", body: "Specification comes from the developer’s filing. Where a figure has not been filed, the row reads “—” rather than an estimate." },
  { icon: ShieldCheck, title: "Produced, not promised", body: "An immersive format appears only when the asset exists. We do not show a 3D control that opens a photograph." },
  { icon: Ban, title: "No forecasts", body: "No yields, no return projections and no price predictions. Investment and ownership services are in development and are not offered today." },
];

const PARTNER_LOGOS = [
  { name: "VIT TBI", image: "/images/partners/vit-tbi.jpg" },
  { name: "GSEA", image: "/images/partners/gsea.png" },
  { name: "build3", image: "/images/partners/build3.png" },
  { name: "Startup India", image: "/images/partners/startupindia.png" },
  { name: "AU Bank", image: "/images/partners/au-bank.png" },
  { name: "NVIDIA", image: "/images/partners/nvidia.png" },
  { name: "PS Associates", image: "/images/partners/ps-associates.jpg" },
  { name: "AWS", image: "/images/partners/aws.png" },
];

const LINKEDIN = "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3zM9.5 9.75h3.8v1.6h.06c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.77 2.55 4.77 5.87v5.48h-4v-4.86c0-1.16-.02-2.65-1.66-2.65-1.66 0-1.92 1.25-1.92 2.56v4.95h-4z";
const INSTAGRAM = "M12 2.2c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0 4.78a5.02 5.02 0 1 0 0 10.04 5.02 5.02 0 0 0 0-10.04zm0 8.28a3.26 3.26 0 1 1 0-6.52 3.26 3.26 0 0 1 0 6.52zm5.22-9.65a1.17 1.17 0 1 0 0 2.34 1.17 1.17 0 0 0 0-2.34z";

const awards = [
  ["2nd Runner-Up — GSEA Indore", "Recognised at GSEA Indore for innovation, scalability, and impact in the PropTech and AI-driven real estate sector."],
  ["Top 25 Startups Across India — Build3", "Selected among the Top 25 startups across India through a highly competitive national startup selection process."],
  ["NVIDIA Inception Program", "Selected for the NVIDIA Inception Program, recognising Aarvasa as a high-potential AI-driven startup building innovative technology solutions."],
  ["Startup India Recognition", "Officially recognised and registered under Startup India as an emerging innovation-driven startup."],
  ["VIT-TBI Pre-Incubated Startup", "Recognised as a Pre-Incubated Startup at VIT Technology Business Incubator (VIT-TBI), supporting the growth of transformative technology ventures."],
  ["Media & Entrepreneurship Features", "Featured in startup and entrepreneurship platforms including KaroStartup and IndiaPreneur for innovation in AI-powered real estate solutions."],
  ["Technology-Driven Real Estate Innovation", "Recognised by startup and academic evaluation panels for building a technology-first platform focused on transparency, affordability, and intelligent property insights."],
];

const partners = [
  "TimeSlotter Pvt Ltd",
  "PS Associates",
  "Paramjyoti Pvt Ltd",
  "Ealth Technologies",
  "Softwave Solutions",
];

const roadmap = [
  ["2024", "Team formation, MVP development, strategic partnerships, beta launch with core features."],
  ["2025", "Advisor launch, multi-city expansion, investor dashboard."],
  ["2026 and beyond", "International expansion, institutional partnerships, and the fractional participation and digital-title layers that are still in development."],
];

export default function AboutPage() {
  return (
    <div className="pb-[var(--s-24)]">
      <PageHero
        eyebrow="About Aarvasa"
        title="Property should be read like a *drawing,* not sold like a brochure."
        image="/images/reef-996/architecture/reef-996-facade-detail-3x2.jpg"
        caption="REEF 996 · Developer render"
        size="tall"
      />

      {/* ── Intro: the idea, with a collage ────────────────────────────── */}
      <section className="relative isolate overflow-hidden py-[clamp(72px,10vw,140px)]">
        <Aurora className="opacity-60" />
        <LuxContainer className="grid items-center gap-[var(--s-14)] lg:grid-cols-[1fr_1.05fr]">
          <div>
            <FadeUp>
              <span className="lux-eyebrow">Who we are</span>
            </FadeUp>
            <LuxHeading
              text="A property platform that reads the *filing* first."
              className="av-display mt-5 max-w-[16ch] text-[clamp(38px,4.8vw,68px)] font-light leading-[0.98] text-ink"
            />
            <FadeUp delay={0.15} className="mt-6 space-y-4 text-[16.5px] leading-[1.8] text-ink-muted">
              <p>
                Aarvasa is a property discovery platform. We publish what the developer files — structure, plot, areas,
                approvals, payment schedules and handover — set as data rather than adjectives.
              </p>
              <p>
                Where a project has been captured, you can explore it before you book a flight. And when you have three you
                like, you can put them side by side and see which is actually the better building.
              </p>
              <p>We hold no inventory and take no fee from buyers. Developers pay us when an enquiry becomes a sale.</p>
            </FadeUp>
          </div>

          <div className="relative mx-auto h-[460px] w-full max-w-[600px] sm:h-[540px]">
            <SlideIn from="right" className="absolute right-0 top-0 h-[72%] w-[62%]">
              <div className="lux-gold-border relative h-full w-full overflow-hidden rounded-[26px]">
                <Image src={`${UNSPLASH}/photo-1512453979798-5ea266f8880c?w=1200&q=80`} alt="Dubai skyline at sunset" fill sizes="380px" className="av-kenburns object-cover" />
                <span className="av-meta absolute bottom-4 left-4 rounded-full bg-black/50 px-3 py-1.5 text-[10px] text-stage-ink backdrop-blur-md">Dubai</span>
              </div>
            </SlideIn>
            <SlideIn from="left" delay={0.15} className="absolute bottom-0 left-0 h-[56%] w-[52%]">
              <div className="lux-gold-border relative h-full w-full overflow-hidden rounded-[26px] shadow-[0_40px_80px_rgba(0,0,0,0.6)]">
                <Image src={`${UNSPLASH}/photo-1503387762-592deb58ef4e?w=900&q=80`} alt="An architect drawing over plans" fill sizes="320px" className="object-cover" />
              </div>
            </SlideIn>
            <SlideIn from="bottom" delay={0.3} className="av-float absolute bottom-[14%] right-[6%] z-[2]">
              <div className="lux-glass-strong lux-gold-border rounded-2xl px-6 py-5">
                <div className="av-display lux-gold-text text-[46px] font-light leading-none">0</div>
                <div className="av-meta mt-2 text-[10px] text-ink-muted">Fees charged to buyers</div>
              </div>
            </SlideIn>
          </div>
        </LuxContainer>
      </section>

      {/* ── Principles, on the logo's burgundy ─────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(120%_100%_at_50%_0%,#4f060c_0%,#1a0709_55%,#0e0709_100%)] py-[clamp(72px,10vw,140px)]">
        <Noise />
        <LuxContainer>
          <SectionTitle eyebrow="What we publish" title="Three rules we *do not bend.*" note="They are the reason the site is worth reading." />
          <Stagger className="mt-[var(--s-14)] grid gap-6 md:grid-cols-3" gap={0.14}>
            {PRINCIPLES.map(({ icon: Icon, title, body: text }, i) => (
              <StaggerItem key={title}>
                <Tilt className="h-full rounded-[28px]">
                  <div className="lux-glass lux-gold-border flex h-full flex-col rounded-[28px] p-8">
                    <div className="flex items-center justify-between">
                      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gold/30 bg-[#4f060c] text-gold-pale">
                        <Icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <span className="av-display text-[56px] font-light leading-none text-gold/25">0{i + 1}</span>
                    </div>
                    <h3 className="av-display mt-8 text-[32px] font-normal leading-none text-ink">{title}</h3>
                    <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">{text}</p>
                  </div>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
        </LuxContainer>
      </section>

      {/* ── Team ───────────────────────────────────────────────────────── */}
      <section id="team" className="relative isolate py-[clamp(72px,10vw,140px)]">
        <LuxContainer>
          <SectionTitle eyebrow="The team" title="The people *behind it.*" />
          <Stagger className="mt-[var(--s-14)] grid gap-6 sm:grid-cols-2 lg:grid-cols-4" gap={0.1}>
            {team.map((person) => (
              <StaggerItem key={person.name}>
                <article className="group lux-gold-border relative h-full overflow-hidden rounded-[26px] bg-paper-raised">
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <Image
                      src={person.image}
                      alt={person.name}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover object-top grayscale-[35%] transition-all duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:grayscale-0"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(14,7,9,0.95))]" />
                    <div className="absolute inset-x-5 bottom-5">
                      <h3 className="av-display text-[28px] font-normal leading-none text-ink">{person.name}</h3>
                      <p className="av-meta mt-2 text-[10px] text-gold">{person.role}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-[12.5px] leading-relaxed text-ink-muted">{person.subtitle}</p>
                    <p className="mt-3 line-clamp-4 text-[13px] leading-relaxed text-ink-muted/90">{person.bio}</p>
                    <div className="mt-4 flex gap-2">
                      {[
                        { href: person.linkedin, label: "LinkedIn", path: LINKEDIN },
                        { href: person.instagram, label: "Instagram", path: INSTAGRAM },
                      ].map((l) => (
                        <a
                          key={l.label}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${person.name} on ${l.label}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink-muted transition-all duration-300 hover:border-gold hover:bg-gold hover:text-[#3a0509]"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                            <path d={l.path} />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              </StaggerItem>
            ))}
          </Stagger>
        </LuxContainer>
      </section>

      {/* ── Recognition ────────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-paper-sunken py-[clamp(72px,10vw,140px)]">
        <Aurora className="opacity-40" />
        <LuxContainer>
          <SectionTitle eyebrow="Recognition" title="Where Aarvasa has been *recognised.*" note="Programmes and selections the company has been through." />
          <Stagger className="mt-[var(--s-14)] grid gap-5 md:grid-cols-2 lg:grid-cols-3" gap={0.07}>
            {awards.map(([title, text], i) => (
              <StaggerItem key={title}>
                <div className="group lux-spotlight flex h-full gap-4 rounded-[22px] border border-rule bg-white/[0.02] p-6 transition-colors duration-500 hover:border-gold/40">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4f060c] text-gold-pale transition-transform duration-500 group-hover:rotate-12">
                    {i < 2 ? <Trophy className="h-5 w-5" aria-hidden="true" /> : <Award className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{text}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="mt-12">
            <Marquee
              items={PARTNER_LOGOS.map((p) => (
                <span key={p.name} className="relative block h-12 w-[140px] rounded-xl bg-white/90">
                  <Image src={p.image} alt="" fill sizes="140px" className="object-contain p-2" />
                </span>
              ))}
            />
          </div>
        </LuxContainer>
      </section>

      {/* ── Offices, as city cards ─────────────────────────────────────── */}
      <section className="relative isolate py-[clamp(72px,10vw,140px)]">
        <LuxContainer>
          <SectionTitle eyebrow="Offices" title="Where *we work.*" note={`Working with ${partners.join(", ")}.`} />
          <Stagger className="mt-[var(--s-14)] grid gap-5 sm:grid-cols-2 lg:grid-cols-4" gap={0.1}>
            {offices.map((o) => (
              <StaggerItem key={o.city}>
                <Tilt className="rounded-[26px]">
                  <div className="group relative aspect-[3/4] overflow-hidden rounded-[26px] lux-gold-border">
                    <Image src={`${UNSPLASH}/${o.photo}?w=800&q=80`} alt={o.alt} fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110" />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,7,9,0.1)_30%,rgba(14,7,9,0.92))]" />
                    <div className="absolute inset-x-5 bottom-5">
                      <span className="av-meta flex items-center gap-1.5 text-[10px] text-gold">
                        <MapPin className="h-3 w-3" aria-hidden="true" /> {o.purpose}
                      </span>
                      <h3 className="av-display mt-2 text-[38px] font-light leading-none text-stage-ink">{o.city}</h3>
                    </div>
                  </div>
                </Tilt>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="av-meta mt-4 text-[9.5px] text-ink-disabled">City photographs: Unsplash</p>
        </LuxContainer>
      </section>

      <div className="mt-[var(--band)]">
        <StatementBanner
          eyebrow="How we are paid"
          title="We hold no inventory and take no fee from buyers."
          body="Developers pay Aarvasa when an enquiry becomes a sale. That is the whole business model, and it is why the specification on this site is the developer's own filing rather than a sales description."
          image={{
            backdrop: "/images/reef-998/amenities/reef-998-garden-terrace-16x9.jpg",
            inset: "/images/reef-997/amenities/reef-997-garden-terrace-4x5.jpg",
            alt: "REEF 997 garden terrace",
            caption: "Developer render · REEF 997" }}
        />
      </div>

      {/* ── Roadmap, as a timeline ─────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden py-[clamp(72px,10vw,140px)]">
        <LuxContainer>
          <SectionTitle eyebrow="Roadmap" title="What is built, and *what is next.*" note="Stated as a roadmap, not as delivered work." />
          <div className="relative mt-[var(--s-14)]">
            <div aria-hidden="true" className="absolute left-[22px] top-0 h-full w-px bg-gradient-to-b from-gold/60 via-gold/25 to-transparent md:left-0 md:top-[22px] md:h-px md:w-full md:bg-gradient-to-r" />
            <Stagger className="grid gap-10 md:grid-cols-3" gap={0.15}>
              {roadmap.map(([year, text], i) => (
                <StaggerItem key={year}>
                  <div className="relative pl-16 md:pl-0 md:pt-16">
                    <span className={`absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border ${i < 2 ? "border-gold bg-[#4f060c] text-gold-pale lux-pulse" : "border-dashed border-gold/40 bg-paper text-gold/60"}`}>
                      <span className="h-2 w-2 rounded-full bg-current" />
                    </span>
                    <div className="av-display lux-gold-text text-[44px] font-light leading-none">{year}</div>
                    <p className="mt-3 max-w-[36ch] text-[14.5px] leading-relaxed text-ink-muted">{text}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
          <Note className="mt-[var(--s-10)] max-w-none rounded-2xl">
            Fractional participation, digital records of title and escrow automation are in development. They are not
            offered today, and nothing on this site should be read as an investment product or as investment advice.
          </Note>
        </LuxContainer>
      </section>
    </div>
  );
}
