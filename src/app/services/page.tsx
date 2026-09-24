import Link from "next/link";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { Ledger, Note, SectionHead, Wrap } from "@/components/av/primitives";

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

const audiences: {
  label: string;
  title: string;
  body: string;
  includes: [string, string][];
}[] = [
  {
    label: "For buyers",
    title: "Find it, walk it, compare it",
    body: "Search the platform on city, budget, configuration and specification, open the immersive formats a project has actually produced, and put a shortlist of three side by side before you travel. Enquiries go straight to the developer; you pay Aarvasa nothing.",
    includes: [
      ["Search and filters", "City, budget, configuration, type and verified-only, held in the URL"],
      ["Immersive exploration", "3D models, 360° tours and scans, wherever they have been captured"],
      ["Side-by-side comparison", "Up to three properties on price, specification and locality"],
      ["Direct enquiry", "Routed to the developer or their appointed channel partner"],
    ],
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
  },
];

const process = [
  ["Discover", "Search the platform on the specification that decides it, or describe what you want to the advisor."],
  ["Explore", "Open the 3D model, the 360° tour or the measured plans — wherever those assets have been produced."],
  ["Evaluate", "Compare a shortlist of three, then send one enquiry to the developer."],
];

export default function ServicesPage() {
  return (
    <div className="pb-[var(--s-24)]">
      <Wrap className="pt-[var(--s-10)]">
        <span className="av-label text-gold-ink">Services</span>
        <h1 className="av-display mt-2 max-w-[20ch] text-[clamp(32px,4.6vw,56px)] leading-[1.02]">
          Four people use Aarvasa. It is built for all four.
        </h1>
        <p className="mt-[var(--s-4)] max-w-[54ch] text-[17px] leading-relaxed text-ink-muted">
          Buyers and occupiers on one side, builders and their channel partners on the other. The
          same captured project serves both.
        </p>
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <SectionHead
          label="How it works"
          title="Discover, explore, evaluate"
          note="Three steps that exist today. Investment and ownership are in development and are not offered."
        />
        <Ledger className="-mt-[var(--s-6)]" rows={process.map(([t, d]) => ({ term: t, value: d }))} />
      </Wrap>

      {audiences.map((a, i) => (
        <Wrap key={a.label} className="pt-[var(--band)]">
          <MotionReveal delay={Math.min(i, 2) * 0.06}>
            <SectionHead label={a.label} title={a.title} />
            <div className="-mt-[var(--s-6)] grid grid-cols-1 items-start gap-[var(--s-10)] lg:grid-cols-2">
              <p className="max-w-[var(--measure)] text-[17px] leading-[1.75]">{a.body}</p>
              <Ledger rows={a.includes.map(([t, d]) => ({ term: t, value: d }))} />
            </div>
          </MotionReveal>
        </Wrap>
      ))}

      <Wrap className="pt-[var(--band)]">
        <SectionHead
          label="In development"
          title="Not offered today"
          note="Listed here so the roadmap is visible without being sold anywhere else on the site."
        />
        <Ledger
          className="-mt-[var(--s-6)]"
          rows={[
            ["Fractional participation", "A way to take a share in a property rather than the whole of it."],
            ["Digital records of title", "Verifiable ownership records and transfer history."],
            ["Escrow automation", "Automated, milestone-linked release of funds."],
          ].map(([t, d]) => ({ term: t, value: d }))}
        />
        <Note className="mt-[var(--s-5)] max-w-none">
          Aarvasa is a property discovery and marketing platform. It does not offer investment
          products, fractional ownership, tokenised title or any financial service, and it does not
          give investment advice. These layers are in development and will carry their own
          disclosures if and when they launch.
        </Note>
      </Wrap>

      <Wrap className="pt-[var(--band)]">
        <div className="flex flex-wrap items-center gap-[var(--s-4)] border-t border-rule-firm pt-[var(--s-8)]">
          <p className="av-display max-w-[22ch] text-[clamp(24px,3vw,36px)] leading-[1.1]">
            Start with one building.
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
