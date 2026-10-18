import Image from "next/image";
import { PageHero } from "@/components/lux/page-hero";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SectionHead, Plate, Status, Wrap } from "@/components/av/primitives";
import { MeasureRule, SectionIndex } from "@/components/av/graphics";
import { RevealGroup, RevealItem, Reveal } from "@/components/av/motion";
import { projectImageSrc } from "@/lib/project-types";
import { reefCollection } from "@/lib/reef-collection";
import { formatCurrency, inrEstimate } from "@/lib/currency";

/**
 * THE REEF COLLECTION.
 *
 * One developer, five numbered towers, in one place — so a reader can see the
 * family rather than meeting each building as an unrelated listing.
 *
 * Three of the five carry a sourced project record and are listed in full. Two
 * do not: REEF 999 and REEF 1000 appear in the developer's own launch and
 * construction material but no location, price, configuration or completion
 * date has been supplied. They are named, and say exactly that. No figure is
 * estimated to make the row look complete.
 */
export const metadata = {
  title: "The REEF Collection | Aarvasa",
  description:
    "REEF Luxury Developments' numbered towers in Dubai — what is listed, what is under construction, and what each one has actually produced." };

export default function ReefCollectionPage() {
  const entries = reefCollection();
  const listed = entries.filter((e) => e.project);
  const unlisted = entries.filter((e) => !e.project);

  return (
    <div className="pb-[var(--s-24)]">
      {/* ── Stage: the collection announces itself ─────────────────────── */}
      <PageHero
        eyebrow="REEF Luxury Developments"
        title="The REEF *Collection.*"
        body="Five numbered towers across Dubai, built by one developer to one idea: outdoor space that stays usable in summer. Three are listed here with the specification their developer filed. Two are under way, and say so."
        image="/images/reef-996/amenities/reef-996-sunken-balcony-sunset-16x9.jpg"
        caption="REEF 996 sunken balcony · Developer render"
        size="tall"
      >
          <ol className="mt-[var(--s-10)] grid grid-cols-2 gap-px overflow-hidden rounded-[26px] border border-[var(--glass-rule)] bg-[var(--glass-rule)] sm:grid-cols-5">
            {entries.map((e) => (
              <li
                key={e.number}
                className="bg-[rgba(12,9,9,0.55)] backdrop-blur-xl last:col-span-2 sm:last:col-span-1"
                              >
                {e.project ? (
                  <Link
                    href={`/projects/${e.project.slug}`}
                    className="group flex h-full min-h-[168px] flex-col justify-between p-[var(--s-5)] transition-colors duration-300 hover:bg-[rgba(80,8,14,0.55)]"
                    data-hov
                  >
                    <span className="flex items-center justify-between">
                      <span className="av-meta text-gold">Listed</span>
                      <ArrowUpRight
                        className="h-4 w-4 text-stage-muted transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-gold"
                        aria-hidden="true"
                      />
                    </span>
                    <span>
                      <span className="av-display block text-[clamp(40px,4.4vw,60px)] leading-none text-stage-ink transition-colors duration-300 group-hover:text-gold">
                        {e.number}
                      </span>
                      <span className="mt-3 block min-h-[2.6em] text-[12.5px] leading-snug text-stage-muted">
                        {e.project.location}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex h-full min-h-[168px] flex-col justify-between p-[var(--s-5)]">
                    <span className="av-meta text-[#8a7f70]">In progress</span>
                    <span>
                      <span className="av-display block text-[clamp(40px,4.4vw,60px)] leading-none text-[#6f6558]">
                        {e.number}
                      </span>
                      <span className="mt-3 block min-h-[2.6em] text-[12.5px] leading-snug text-[#8a7f70]">
                        Not yet listed
                      </span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ol>
      </PageHero>

      {/* ── Paper: the listed projects, read as data ───────────────────── */}
      <Wrap className="pt-[var(--band)]">
        <SectionIndex n={1} total={2} className="mb-[var(--s-3)]" />
        <SectionHead
          label="Listed"
          title={`${listed.length} projects with a filed specification`}
          note="Figures come from the developer's own inventory. Where a value has not been filed, the row reads dash rather than an estimate."
        />

        <RevealGroup className="grid gap-[var(--s-10)] md:grid-cols-2 lg:grid-cols-3">
          {listed.map((e) => {
            const p = e.project!;
            const cover = p.imagery?.hero ?? null;
            const price =
              p.fromPrice > 0 ? formatCurrency(p.fromPrice, p.currency) : "On request";
            const inr = inrEstimate(p.fromPrice, p.currency);
            return (
              <RevealItem key={p.slug}>
                <Link href={`/projects/${p.slug}`} className="group block" data-hov>
                  <Plate ratio="card" className="border-b border-rule-firm">
                    {cover ? (
                      <>
                        <Image
                          src={projectImageSrc(cover, "3x2")}
                          alt={cover.alt}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                          className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-enter)] group-hover:scale-[1.04]"
                        />
                        {cover.origin === "render" && (
                          <span className="av-meta absolute right-3 top-3 rounded-xs bg-[rgba(12,11,10,0.72)] px-2 py-1 text-stage-ink backdrop-blur-sm">
                            Render
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-end bg-paper-sunken p-4">
                        <span className="av-meta text-ink-disabled">Not yet photographed</span>
                      </div>
                    )}
                  </Plate>

                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="av-display text-[26px] leading-none">{e.number}</span>
                    <h3 className="av-display text-[20px] leading-tight">{p.name}</h3>
                    <ArrowUpRight className="ml-auto h-4 w-4 text-ink-muted transition-colors group-hover:text-burgundy" aria-hidden="true" />
                  </div>
                  <p className="mt-[2px] text-[13px] text-ink-muted">
                    {p.location}, {p.city}
                  </p>

                  <dl className="mt-3 grid grid-cols-2 gap-[var(--s-3)] border-t border-rule pt-[10px]">
                    <div className="min-w-0">
                      <dt className="av-label text-ink-muted">From</dt>
                      <dd className="av-num truncate text-[13px] font-semibold">
                        {price}
                        {inr && <span className="ml-1 font-normal text-ink-muted">≈ {inr}</span>}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="av-label text-ink-muted">Completion</dt>
                      <dd className="av-num truncate text-[13px] font-semibold">
                        {p.completion ?? "—"}
                      </dd>
                    </div>
                  </dl>

                  {p.availableUnits ? (
                    <div className="mt-3">
                      <Status tone="ready">{p.availableUnits} units available</Status>
                    </div>
                  ) : null}
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </Wrap>

      {/* ── Paper: the rest of the family, honestly ────────────────────── */}
      {unlisted.length > 0 && (
        <Wrap className="pt-[var(--band)]">
          <SectionIndex n={2} total={2} className="mb-[var(--s-3)]" />
          <SectionHead
            label="Under way"
            title="In the family, not yet listed"
            note="The developer has released film and construction updates for these. No location, price, configuration or completion date has been filed with Aarvasa, so none is shown."
          />
          <Reveal>
            <ul className="border-t border-rule-firm">
              {unlisted.map((e) => (
                <li
                  key={e.number}
                  className="grid grid-cols-1 items-baseline gap-2 border-b border-rule py-[var(--s-5)] sm:grid-cols-[100px_minmax(0,1fr)_auto]"
                >
                  <span className="av-display text-[30px] leading-none text-ink-muted">
                    {e.number}
                  </span>
                  <div className="min-w-0">
                    <h3 className="av-display text-[19px] leading-tight">{e.name}</h3>
                    {e.mediaNote && (
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        {e.mediaNote}
                      </p>
                    )}
                  </div>
                  <span className="av-meta text-ink-disabled sm:text-right">
                    No published specification
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <div className="mt-[var(--s-6)] max-w-[420px]">
            <MeasureRule />
          </div>
        </Wrap>
      )}
    </div>
  );
}
