import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Wrap, SectionHead } from "@/components/av/primitives";
import { DraftingGrid, Grain, MeasureRule, SectionIndex } from "@/components/av/graphics";
import { TextReveal, RevealGroup, RevealItem } from "@/components/av/motion";

/**
 * Agents, from the actual user records.
 *
 * This page previously listed three invented people — stock portrait
 * photography, fabricated deal counts ("48 deals closed") and ratings (4.9)
 * — beneath a "Verified Agents" badge. None of them existed, none of those
 * numbers were measured, and the page sat in the main navigation.
 *
 * It now reads accounts that actually hold the AGENT role, and shows only what
 * the record supports: who they are and what they have listed. No ratings, no
 * deal counts, no verification claim, and no email address — this is a public
 * surface and a lister's contact details are reached through the enquiry flow.
 */
export const metadata = {
  title: "Agents | Aarvasa",
  description: "Channel partners and agents listing on Aarvasa.",
};

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await prisma.user
    .findMany({
      where: { role: "AGENT" },
      select: {
        id: true,
        name: true,
        image: true,
        properties: {
          where: { status: "ACTIVE" },
          select: { city: true },
        },
      },
      orderBy: { name: "asc" },
    })
    .catch(() => []);

  return (
    <div className="pb-[var(--s-24)]">
      <section className="relative isolate overflow-hidden bg-paper-sunken pb-[var(--band-tight)] pt-[var(--s-10)]">
        <DraftingGrid size={40} fade="radial" className="opacity-25" />
        <Grain opacity={0.04} />
        <Wrap className="relative z-[2]">
          <span className="av-label text-gold-ink">Who lists here</span>
          <TextReveal
            as="h1"
            text="Agents and channel partners"
            className="av-display mt-2 text-[clamp(32px,4.4vw,52px)] leading-[1.04]"
          />
          <p className="mt-[var(--s-4)] max-w-[56ch] text-[17px] leading-relaxed text-ink-muted">
            Aarvasa holds no inventory. Every listing belongs to the developer or the
            channel partner who filed it, and this is who they are.
          </p>
          <div className="mt-[var(--s-6)] max-w-[420px]">
            <MeasureRule />
          </div>
        </Wrap>
      </section>

      <Wrap className="pt-[var(--band)]">
        <SectionIndex n={1} total={1} className="mb-[var(--s-3)]" />
        <SectionHead
          label="Agents"
          title={agents.length > 0 ? "Listing on Aarvasa" : "No agents listed yet"}
          note="Drawn from the accounts that hold the agent role. Listing counts are live."
        />

        {agents.length === 0 ? (
          <div className="border border-rule bg-paper-raised px-6 py-[var(--s-14)]">
            <p className="max-w-[46ch] text-[13.5px] leading-relaxed text-ink-muted">
              No agent accounts are active at the moment. Developer inventory is listed
              directly and can be browsed from the properties page.
            </p>
            <Link
              href="/listings"
              className="av-label mt-[var(--s-5)] inline-block rounded-xs border border-rule-firm bg-paper px-3 py-[7px] text-ink transition-colors hover:border-burgundy hover:text-burgundy"
            >
              Browse listings
            </Link>
          </div>
        ) : (
          <RevealGroup className="grid gap-[var(--s-8)] sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => {
              // Cities are derived from what they have actually listed.
              const cities = [...new Set(a.properties.map((p) => p.city).filter(Boolean))];
              return (
                <RevealItem key={a.id}>
                  <article className="border-b border-rule-firm pb-[var(--s-4)]">
                    <div className="flex items-center gap-4">
                      {a.image ? (
                        <Image
                          src={a.image}
                          alt=""
                          width={56}
                          height={56}
                          className="h-14 w-14 rounded-full object-cover"
                        />
                      ) : (
                        /* Initial rather than a stock portrait of someone else. */
                        <span
                          aria-hidden="true"
                          className="av-display flex h-14 w-14 items-center justify-center rounded-full bg-paper-sunken text-[20px] text-ink-muted"
                        >
                          {(a.name ?? "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <h3 className="av-display text-[20px] leading-tight">
                          {a.name ?? "Agent"}
                        </h3>
                        <p className="av-meta mt-1 flex items-center gap-1.5 text-ink-muted">
                          <BadgeCheck className="h-3.5 w-3.5 text-gold-ink" aria-hidden="true" />
                          Agent account
                        </p>
                      </div>
                    </div>

                    <dl className="mt-[var(--s-4)] flex gap-[var(--s-5)] border-t border-rule pt-[10px]">
                      <div>
                        <dt className="av-label text-ink-muted">Active listings</dt>
                        <dd className="av-num text-[13px] font-semibold">
                          {a.properties.length}
                        </dd>
                      </div>
                      {cities.length > 0 && (
                        <div className="min-w-0">
                          <dt className="av-label text-ink-muted">Where</dt>
                          <dd className="flex items-center gap-1 truncate text-[13px] font-semibold">
                            <MapPin className="h-3 w-3 shrink-0 text-ink-muted" aria-hidden="true" />
                            {cities.join(", ")}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </article>
                </RevealItem>
              );
            })}
          </RevealGroup>
        )}
      </Wrap>
    </div>
  );
}
