import Image from "next/image";
import Link from "next/link";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { Ledger, Note, Plate, SectionHead, Wrap } from "@/components/av/primitives";

export const metadata = {
  title: "About | Aarvasa",
  description:
    "Aarvasa publishes what the developer files, shows a property in three dimensions where it has been captured, and lets you compare what you found.",
};

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
    instagram: "https://www.instagram.com/uday.sahu_10?igsh=MWVzNW85dTRydndpdg%3D%3D",
  },
  {
    name: "Ansh Dubey",
    role: "Co-Founder & COO",
    subtitle: "Operations Strategist | Product & Process Leader",
    bio: "Ansh Dubey, COO of Aarvasa, oversees operations, workflow optimization, and product delivery. Focused on efficiency, he ensures smooth platform functionality, from listings to customer experience, translating ideas into scalable, real-world execution.",
    image: "/images/team/ansh.png",
    linkedin: "https://www.linkedin.com/in/ansh-dubey-526325273/",
    instagram: "https://www.instagram.com/_ansh_.dubey/",
  },
  {
    name: "Anirudh Saxena",
    role: "Co-Founder & CTO",
    subtitle: "Tech Architect | Innovation & Engineering Lead",
    bio: "Anirudh Saxena, CTO of Aarvasa, drives AI tools, smart contracts, and infrastructure development. He ensures a secure, scalable tech foundation, shaping the digital systems that power Aarvasa’s platform and future growth.",
    image: "/images/team/anirudh.png",
    linkedin: "https://www.linkedin.com/in/anirudh-saxena-481ba2245/",
    instagram: "https://www.instagram.com/_anirudh__.07?igsh=MTJocm1va3VtZDV0bw%3D%3D",
  },
  {
    name: "Sriaditya S",
    role: "VP of IT Operations",
    subtitle: "Technology Strategist | System Architect | Cybersecurity Advocate",
    bio: "Sriaditya S leads IT Operations at Aarvasa, managing the company’s digital infrastructure, cloud systems, and cybersecurity. He ensures platform stability, secure workflows, and drives Aarvasa’s tech innovations for scalable business growth.",
    image: "/images/team/sriaditya.png",
    linkedin: "https://www.linkedin.com/in/sriadityas/",
    instagram: "https://www.instagram.com/sriaditya_kamikaze?igsh=amdnbDR4MG82cDFh",
  },
];

const offices = [
  { city: "Bhopal", purpose: "Headquarters" },
  { city: "Delhi", purpose: "Branch office" },
  { city: "Bengaluru", purpose: "Branch office" },
  { city: "Dubai", purpose: "International desk" },
];

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
      <Wrap className="pt-[var(--s-10)]">
        <span className="av-label text-gold-ink">About</span>
        <h1 className="av-display mt-2 max-w-[20ch] text-[clamp(32px,4.8vw,58px)] leading-[1.02]">
          Most property is sold on a brochure. We think it should be read like a drawing.
        </h1>
      </Wrap>

      <Wrap read className="pt-[var(--band-tight)]">
        <p className="text-[19px] leading-[1.75]">
          Aarvasa is a property discovery platform. We publish what the developer files —
          structure, plot, areas, approvals, payment schedules and handover — set as data rather
          than adjectives.
        </p>
        <p className="mt-[var(--s-5)] text-[17px] leading-[1.75] text-ink-muted">
          Where a project has been captured, you can walk it in three dimensions before you book a
          flight. And when you have three you like, you can put them side by side and see which is
          actually the better building.
        </p>
        <p className="mt-[var(--s-5)] text-[17px] leading-[1.75] text-ink-muted">
          We hold no inventory and take no fee from buyers. Developers pay us when an enquiry
          becomes a sale, and that is the whole business model.
        </p>
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <SectionHead
          label="What we publish"
          title="Three rules we do not bend"
          note="They are the reason the site is worth reading."
        />
        <Ledger
          className="-mt-[var(--s-6)]"
          rows={[
            {
              term: "Filed, not written",
              value:
                "Specification comes from the developer’s filing. Where a figure has not been filed, the row reads “—” rather than an estimate.",
            },
            {
              term: "Produced, not promised",
              value:
                "An immersive format appears only when the asset exists. We do not show a 3D control that opens a photograph.",
            },
            {
              term: "No forecasts",
              value:
                "We publish no yields, no return projections and no price predictions. Investment and ownership services are in development and are not offered today.",
            },
          ]}
        />
      </Wrap>

      <Wrap className="pt-[var(--band)]" >
        <SectionHead label="The team" title="Who runs Aarvasa" />
        <div className="grid gap-[var(--s-10)] sm:grid-cols-2 lg:grid-cols-4">
          {team.map((person, i) => (
            <MotionReveal key={person.name} delay={Math.min(i, 3) * 0.08}>
              <article id={i === 0 ? "team" : undefined}>
                <Plate ratio="plate" className="border-b border-rule-firm">
                  <Image
                    src={person.image}
                    alt={person.name}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover object-top"
                  />
                </Plate>
                <h3 className="av-display mt-3 text-[22px] leading-tight">{person.name}</h3>
                <p className="av-meta mt-1 text-gold-ink">{person.role}</p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                  {person.subtitle}
                </p>
                <p className="mt-3 border-t border-rule pt-3 text-[13px] leading-relaxed text-ink-muted">
                  {person.bio}
                </p>
                <p className="mt-3 flex gap-4">
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="av-label text-ink transition-colors hover:text-burgundy"
                  >
                    LinkedIn
                  </a>
                  <a
                    href={person.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="av-label text-ink transition-colors hover:text-burgundy"
                  >
                    Instagram
                  </a>
                </p>
              </article>
            </MotionReveal>
          ))}
        </div>
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <SectionHead
          label="Recognition"
          title="Where Aarvasa has been recognised"
          note="Programmes and selections the company has been through."
        />
        <Ledger className="-mt-[var(--s-6)]" rows={awards.map(([t, d]) => ({ term: t, value: d }))} />
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <SectionHead label="Offices" title="Where we work" />
        <Ledger
          className="-mt-[var(--s-6)]"
          rows={offices.map((o) => ({ term: o.city, value: o.purpose }))}
        />

        <div className="mt-[var(--s-10)]">
          <span className="av-label text-ink-muted">Working with</span>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-[var(--s-8)] gap-y-2 border-y border-rule-firm py-[var(--s-5)]">
            {partners.map((p) => (
              <span key={p} className="av-display text-[clamp(16px,1.8vw,22px)] text-ink/75">
                {p}
              </span>
            ))}
          </div>
        </div>
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <SectionHead
          label="Roadmap"
          title="What is built and what is not"
          note="Stated as a roadmap, not as delivered work."
        />
        <Ledger className="-mt-[var(--s-6)]" rows={roadmap.map(([y, d]) => ({ term: y, value: d }))} />
        <Note className="mt-[var(--s-5)] max-w-none">
          Fractional participation, digital records of title and escrow automation are in
          development. They are not offered today, and nothing on this site should be read as an
          investment product or as investment advice.
        </Note>
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <div className="flex flex-wrap items-center gap-[var(--s-4)] border-t border-rule-firm pt-[var(--s-8)]">
          <p className="av-display max-w-[20ch] text-[clamp(24px,3vw,36px)] leading-[1.1]">
            Come and read the drawings.
          </p>
          <div className="ml-auto flex flex-wrap gap-[var(--s-3)]">
            <Link
              href="/listings"
              className="av-label rounded-xs bg-burgundy px-6 py-[13px] text-paper transition-colors hover:bg-burgundy-deep"
            >
              Browse properties
            </Link>
            <Link
              href="/contact"
              className="av-label rounded-xs border border-rule-firm px-6 py-[13px] text-ink transition-colors hover:bg-paper-sunken"
            >
              Talk to the desk
            </Link>
          </div>
        </div>
      </Wrap>
    </div>
  );
}
