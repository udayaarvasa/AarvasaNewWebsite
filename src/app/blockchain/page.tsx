import Link from "next/link";
import { PageHero } from "@/components/lux/page-hero";
import { LedgerChain } from "@/components/lux/ledger-chain";
import { Wrap } from "@/components/av/primitives";

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
    "Where Aarvasa intends to take verifiable property records. Explore an interactive prototype and public testnet evidence. No ownership or investment service is offered.",
  // Not a capability we offer; it should not be surfaced as one in search.
  robots: { index: false, follow: true } };

export default function BlockchainPage() {
  return (
    <div className="pb-[var(--s-24)]">
      <PageHero
        eyebrow="Roadmap · Blockchain"
        title="On-chain title is *coming.* It is not here *yet.*"
        body="Aarvasa does not offer blockchain-based ownership, tokenised property, fractional investment instruments, on-chain title transfer or smart-contract escrow. An interactive prototype and read-only testnet evidence are available to explore. No real ownership or investment service is offered."
        size="tall"
      >
        <LedgerChain />
      </PageHero>

      <Wrap read className="pt-[var(--band-tight)]">
        <p className="text-[19px] leading-[1.75]">
          Property records in India are paper records. The interesting question is not
          which ledger they sit on, but whether what a developer filed can be read,
          checked and compared by the person buying. That is the product today, and it
          is the part we are actually building.
        </p>
        <p className="mt-[var(--s-5)] text-[17px] leading-[1.75] text-ink-muted">
          Explore the interactive demo to see sample document fingerprints, controlled
          unit issuance and transfer rules. Its Testnet proof view reads our deployed
          Base Sepolia contracts and links to public transaction receipts. The property,
          wallets and units are synthetic; these records do not represent legal title,
          a payment or an investment.
        </p>
        <p className="mt-[var(--s-8)]">
          <Link
            href="/blockchain/demo"
            className="av-label rounded-xs border border-rule-firm bg-paper-raised px-3 py-[8px] text-ink transition-colors hover:border-burgundy hover:text-burgundy"
          >
            Explore the blockchain demo
          </Link>
        </p>
      </Wrap>
    </div>
  );
}
