import Link from "next/link";
import { Wrap } from "@/components/av/primitives";
import { DraftingGrid, Grain, MeasureRule } from "@/components/av/graphics";
import { TextReveal } from "@/components/av/motion";

/**
 * Blockchain — statement of intent, not a product page.
 *
 * This route previously described an operating settlement stack in the present
 * tense: "Ownership Transfer — immutable on-chain title registry updates",
 * "Tokenization — fractional property investment instruments", "Smart Contracts
 * — automated escrow and programmable settlements", a "RERA compliance engine",
 * "decentralized escrow", and the assertion that "our infrastructure ensures
 * that high-value property investments are de-risked through absolute,
 * immutable transparency".
 *
 * None of that exists. Fractional investment instruments are a regulated
 * financial product, and a de-risking claim about someone's property purchase
 * is a financial representation. The page was unlinked from navigation but
 * still publicly reachable and indexable, so the claims were live.
 *
 * It now says only what is true: this is planned work, nothing is offered, and
 * there is nothing to sign up to.
 */
export const metadata = {
  title: "Blockchain | Aarvasa",
  description:
    "Where Aarvasa intends to take verifiable property records. Nothing described here is available today.",
  // Not a capability we offer; it should not be surfaced as one in search.
  robots: { index: false, follow: true },
};

export default function BlockchainPage() {
  return (
    <div className="pb-[var(--s-24)]">
      <section className="relative isolate overflow-hidden bg-paper-sunken pb-[var(--band-tight)] pt-[var(--s-10)]">
        <DraftingGrid size={40} fade="radial" className="opacity-25" />
        <Grain opacity={0.04} />
        <Wrap className="relative z-[2]">
          <span className="av-label text-gold-ink">Roadmap</span>
          <TextReveal
            as="h1"
            text="Not available today."
            className="av-display mt-2 text-[clamp(32px,4.4vw,52px)] leading-[1.04]"
          />
          <p className="mt-[var(--s-4)] max-w-[56ch] text-[17px] leading-relaxed text-ink-muted">
            Aarvasa does not offer blockchain-based ownership, tokenised property,
            fractional investment instruments, on-chain title transfer or smart-contract
            escrow. None of it is built, and none of it is for sale.
          </p>
          <div className="mt-[var(--s-6)] max-w-[420px]">
            <MeasureRule />
          </div>
        </Wrap>
      </section>

      <Wrap read className="pt-[var(--band-tight)]">
        <p className="text-[19px] leading-[1.75]">
          Property records in India are paper records. The interesting question is not
          which ledger they sit on, but whether what a developer filed can be read,
          checked and compared by the person buying. That is the product today, and it
          is the part we are actually building.
        </p>
        <p className="mt-[var(--s-5)] text-[17px] leading-[1.75] text-ink-muted">
          If verifiable records become something we can offer rather than something we
          can describe, this page will say so, and it will say what was independently
          checked. Until then it stays as it is — a note about intent, with nothing to
          sign up to and nothing to buy.
        </p>
        <p className="mt-[var(--s-8)]">
          <Link
            href="/listings"
            className="av-label rounded-xs border border-rule-firm bg-paper-raised px-3 py-[8px] text-ink transition-colors hover:border-burgundy hover:text-burgundy"
          >
            See what is listed today
          </Link>
        </p>
      </Wrap>
    </div>
  );
}
