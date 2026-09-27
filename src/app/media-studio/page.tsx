import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock, Check } from "lucide-react";
import { auth } from "@/auth";
import { SectionHead, Wrap } from "@/components/av/primitives";
import { DraftingGrid, Grain, MeasureRule, SectionIndex } from "@/components/av/graphics";
import { TextReveal, Reveal } from "@/components/av/motion";
import { activeCapabilities } from "@/lib/entitlements/service";
import {
  CAPABILITY_LABELS,
  ENTITLEMENT_CAPABILITIES,
  type Capability,
} from "@/lib/entitlements/capabilities";
import { paymentsAvailable } from "@/lib/entitlements/payment-provider";

/**
 * AARVASA MEDIA STUDIO.
 *
 * The creator surface: upload property media, turn it into 3D or 360, review
 * it, publish it. All of that is premium, and all of it is locked here until an
 * entitlement is active.
 *
 * What this page is NOT is the security boundary. It reads entitlements to
 * decide what looks unlocked; every operation is checked again server-side at
 * its own endpoint, so a user who edits this page's state in their browser gets
 * a 402 the moment they try to use anything.
 *
 * Payment does not exist yet. There is therefore no checkout, no plan table, no
 * price, no invoice and no transaction id anywhere on this page — showing any
 * of those would imply a commercial flow that has not been built.
 */
export const metadata = {
  title: "Media Studio | Aarvasa",
  description:
    "Create 3D and 360° experiences from property media. Available with an Aarvasa Media Studio plan.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** The creator pipeline, in the order it actually runs. */
const PIPELINE: { step: string; title: string; body: string; needs: Capability | null }[] = [
  {
    step: "01",
    title: "Upload",
    body: "Bring photographs or video of the property. Originals stay private to your account until you publish them.",
    needs: "PROCESS_MEDIA",
  },
  {
    step: "02",
    title: "Coverage check",
    body: "We look at whether the material can actually support a reconstruction, and say what is missing before anything is charged or processed.",
    needs: null,
  },
  {
    step: "03",
    title: "Reconstruct",
    body: "Photogrammetry or Gaussian reconstruction produces geometry or a splat, then optimisation makes it small enough to open on a phone.",
    needs: "CREATE_3D",
  },
  {
    step: "04",
    title: "Review",
    body: "You see the result before anyone else does. Output that is not good enough is rejected rather than published with a disclaimer.",
    needs: null,
  },
  {
    step: "05",
    title: "Publish",
    body: "The asset joins the property page and its capability badge appears — only once a real asset exists behind it.",
    needs: "PUBLISH_IMMERSIVE",
  },
];

export default async function MediaStudioPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=%2Fmedia-studio");

  // Server-side read. Presentation only — see the note above.
  const held = await activeCapabilities(session.user.id);
  const hasAny = held.length > 0;

  return (
    <div className="pb-[var(--s-24)]">
      <section
        data-surface="stage"
        className="relative isolate overflow-hidden bg-stage pb-[var(--band)] pt-[var(--s-16)]"
      >
        <DraftingGrid tone="stage" size={56} fade="top" className="opacity-25" />
        <Grain opacity={0.06} />
        <Wrap className="relative z-[3]">
          <span className="av-label text-gold">Aarvasa Media Studio</span>
          <TextReveal
            as="h1"
            text="Make the building explorable."
            className="av-display mt-2 max-w-[18ch] text-[clamp(32px,5vw,62px)] leading-[1.02] text-stage-ink"
          />
          <p className="mt-[var(--s-5)] max-w-[58ch] text-[17px] leading-relaxed text-stage-muted">
            Turn photographs and video of a property into a 3D model or a 360° tour, review
            the result, and publish it to the project page. Creation tools are part of a
            Media Studio plan; browsing and comparing property on Aarvasa stays free.
          </p>

          <div className="mt-[var(--s-8)] inline-flex items-center gap-2 rounded-xs border border-stage-rule px-3 py-2">
            {hasAny ? (
              <>
                <Check className="h-4 w-4 text-gold" aria-hidden="true" />
                <span className="av-meta text-stage-ink">
                  {held.length} capabilit{held.length === 1 ? "y" : "ies"} active
                </span>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4 text-stage-muted" aria-hidden="true" />
                <span className="av-meta text-stage-muted">No active plan</span>
              </>
            )}
          </div>
        </Wrap>
      </section>

      {/* ── What the plan covers ───────────────────────────────────────── */}
      <Wrap className="pt-[var(--band)]">
        <SectionIndex n={1} total={2} className="mb-[var(--s-3)]" />
        <SectionHead
          label="Capabilities"
          title="What a Media Studio plan unlocks"
          note="Each is checked on the server when you use it, not when this page renders."
        />
        <Reveal>
          <ul className="grid gap-[var(--s-3)] sm:grid-cols-2 lg:grid-cols-3">
            {ENTITLEMENT_CAPABILITIES.map((cap) => {
              const unlocked = held.includes(cap);
              return (
                <li
                  key={cap}
                  className={
                    "flex items-center gap-3 border px-4 py-3 " +
                    (unlocked
                      ? "border-gold-ink bg-paper-raised"
                      : "border-rule bg-paper-sunken")
                  }
                >
                  {unlocked ? (
                    <Check className="h-4 w-4 shrink-0 text-gold-ink" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-ink-disabled" aria-hidden="true" />
                  )}
                  <span className={unlocked ? "text-[14px] text-ink" : "text-[14px] text-ink-muted"}>
                    {CAPABILITY_LABELS[cap]}
                  </span>
                  <span className="sr-only">{unlocked ? "unlocked" : "locked"}</span>
                </li>
              );
            })}
          </ul>
        </Reveal>

        {!hasAny && (
          <Reveal delay={0.08}>
            <div className="mt-[var(--s-8)] max-w-[60ch] border border-rule-firm bg-paper-raised p-[var(--s-6)]">
              <h3 className="av-display text-[22px] leading-tight">
                Immersive creation is available with a Media Studio plan.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                {paymentsAvailable()
                  ? "Choose a plan to unlock creation and publishing."
                  : "Plans and payment are not open yet — there is nothing to buy today and no card to enter. When pricing is set, this is where it will appear."}
              </p>
              <p className="av-meta mt-[var(--s-5)] text-ink-disabled">
                {paymentsAvailable()
                  ? "Plans available"
                  : "Plans and payment integration coming soon"}
              </p>
            </div>
          </Reveal>
        )}
      </Wrap>

      {/* ── The pipeline ───────────────────────────────────────────────── */}
      <Wrap className="pt-[var(--band)]">
        <SectionIndex n={2} total={2} className="mb-[var(--s-3)]" />
        <SectionHead
          label="How it works"
          title="Upload, check, reconstruct, review, publish"
          note="Coverage is assessed before processing runs, so material that cannot support a reconstruction is caught early rather than turned into unreliable geometry."
        />
        <Reveal>
          <ol className="border-t border-rule-firm">
            {PIPELINE.map((s) => {
              const locked = s.needs !== null && !held.includes(s.needs);
              return (
                <li
                  key={s.step}
                  className="grid grid-cols-1 gap-2 border-b border-rule py-[var(--s-5)] sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:gap-[var(--s-5)]"
                >
                  <span className="av-num text-[13px] text-ink-muted">{s.step}</span>
                  <div className="min-w-0">
                    <h3 className="av-display text-[19px] leading-tight">{s.title}</h3>
                    <p className="mt-1 max-w-[62ch] text-[14px] leading-relaxed text-ink-muted">
                      {s.body}
                    </p>
                  </div>
                  {s.needs && (
                    <span className="av-meta self-start whitespace-nowrap text-ink-disabled sm:text-right">
                      {locked ? "Locked" : "Unlocked"}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </Reveal>

        <div className="mt-[var(--s-8)] max-w-[420px]">
          <MeasureRule />
        </div>
        <p className="mt-[var(--s-5)] max-w-[60ch] text-[13.5px] leading-relaxed text-ink-muted">
          Processing is not running yet: the reconstruction service is being built, and the
          endpoints report that plainly rather than queueing work that would never complete.
          Nothing here has taken a payment.{" "}
          <Link href="/listings" className="underline underline-offset-2 hover:text-burgundy">
            Browse property instead
          </Link>
          .
        </p>
      </Wrap>
    </div>
  );
}
