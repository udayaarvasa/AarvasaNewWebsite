"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileCheck2, Landmark, Link2, Lock, ScrollText, Send } from "lucide-react";
import { EASE } from "./motion";

/**
 * The record of a listing, drawn as a chain of blocks.
 *
 * The first four links are how Aarvasa works today: a listing is built from
 * the developer's filing and its approvals, published, and an enquiry is
 * sent by email. There is no stored lead workflow: the contact form opens the
 * visitor's own mail app addressed to Aarvasa (app/contact/contact-form.tsx),
 * so the block says exactly that rather than "routed to the developer's desk",
 * which it once claimed. The last two — an on-chain title record and escrow
 * — are the roadmap and are marked as such on the block itself, never
 * implied to be live.
 *
 * The live blocks used to show rolling "0x…" strings. They were decorative,
 * not hashes of anything, and read as on-chain transaction records the site
 * does not have; a plain "Live" mark replaces them.
 */

const BLOCKS = [
  { icon: ScrollText, title: "Developer filing", body: "Specification, areas and plans as filed", live: true },
  { icon: FileCheck2, title: "Approvals", body: "Planning approvals, where the developer has supplied them", live: true },
  { icon: Link2, title: "Listing published", body: "Inventory and payment plans, from the filing", live: true },
  { icon: Send, title: "Enquiry by email", body: "Written in your own mail app and sent to Aarvasa", live: true },
  { icon: Lock, title: "Title on-chain", body: "Verifiable record of ownership", live: false },
  { icon: Landmark, title: "Escrow", body: "Milestone-linked release of funds", live: false },
];

export function LedgerChain() {
  const reduced = useReducedMotion();
  return (
    <div className="relative">
      {/* The chain line behind the blocks: flowing on the live part, dashed
          and still on the roadmap part. */}
      <svg aria-hidden="true" className="absolute left-0 right-0 top-[52px] hidden h-2 w-full lg:block" preserveAspectRatio="none" viewBox="0 0 600 2">
        <line x1="0" y1="1" x2="400" y2="1" stroke="var(--gold)" strokeOpacity="0.55" strokeWidth="1.5" className="lux-flow" vectorEffect="non-scaling-stroke" />
        <line x1="400" y1="1" x2="600" y2="1" stroke="var(--gold)" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 6" vectorEffect="non-scaling-stroke" />
      </svg>

      <ol className="relative grid gap-[var(--s-5)] sm:grid-cols-2 lg:grid-cols-6">
        {BLOCKS.map((b, i) => {
          const Icon = b.icon;
          return (
            <motion.li
              key={b.title}
              initial={reduced ? false : { opacity: 0, y: 40, rotateX: -35 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.9, ease: EASE, delay: i * 0.14 }}
              style={{ transformPerspective: 900 }}
              className={`group relative flex flex-col rounded-2xl p-5 ${
                b.live ? "lux-glass lux-gold-border" : "border border-dashed border-[var(--glass-rule)] bg-white/[0.015]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`relative flex h-12 w-12 items-center justify-center rounded-xl ${
                    b.live ? "bg-[linear-gradient(135deg,#4f060c,#7a0f19)] text-gold-pale lux-pulse" : "bg-white/[0.04] text-ink-disabled"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="av-meta text-[10px] text-ink-disabled">#{String(i + 1).padStart(3, "0")}</span>
              </div>
              <h3 className={`mt-5 text-[15px] font-semibold ${b.live ? "text-ink" : "text-ink-muted"}`}>{b.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{b.body}</p>
              <div className="mt-auto pt-4">
                {b.live ? (
                  <span className="av-meta flex items-center gap-1.5 text-[10px] text-gold/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-positive" /> Live
                  </span>
                ) : (
                  <span className="av-meta rounded-full border border-[var(--glass-rule)] px-2 py-1 text-[10px] text-ink-muted">
                    Roadmap · not live
                  </span>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
