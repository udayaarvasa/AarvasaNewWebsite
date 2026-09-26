import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { StageHero } from "@/components/layout/nav-overlay";
import {
  CoordinateMarks,
  DraftingGrid,
  Grain,
  MeasureRule,
  SectionIndex,
} from "@/components/av/graphics";
import { Parallax, Reveal, TextReveal } from "@/components/av/motion";
import { TextureBanner } from "@/components/av/banner";
import { Gallery, type GalleryItem } from "@/components/property/gallery";
import {
  CapMark,
  Ledger,
  Note,
  Plate,
  RailStrip,
  SectionHead,
  Status,
  StageBand,
  Wrap,
  type LedgerRow,
} from "@/components/av/primitives";
import { getProject, publishedProjects } from "@/lib/projects";
import type { Project } from "@/lib/project-types";
import { formatCurrency, inrEstimate, AED_TO_INR } from "@/lib/currency";
import { projectViewerConfig } from "@/lib/viewer/project-media";
import { loadProjectTour } from "@/lib/services/project-panoramas";
import { loadProjectSplat } from "@/lib/services/project-splats";
import ImmersiveSection from "./immersive-section";

// Only slugs from generateStaticParams resolve; anything else 404s at the routing
// layer. Without this, unpublished projects were served as soft-404s: HTTP 200,
// with generateMetadata still emitting a real title search engines could index.
export const dynamicParams = false;

export function generateStaticParams() {
  return publishedProjects().map((p) => ({ slug: p.slug }));
}

/** Headline price line: an absolute figure where known, otherwise the per-sq.ft rate. */
function headlinePrice(project: Project): { primary: string; secondary: string | null } {
  if (project.fromPrice > 0) {
    return {
      primary: formatCurrency(project.fromPrice, project.currency),
      secondary: inrEstimate(project.fromPrice, project.currency),
    };
  }
  if (project.ratePerSqft) {
    return { primary: `${formatCurrency(project.ratePerSqft, project.currency)} / sq.ft`, secondary: null };
  }
  return { primary: "Price on request", secondary: null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return { title: "Project not found" };
  const { primary } = headlinePrice(project);
  return {
    title: `${project.name} — ${project.location}, ${project.city} | Aarvasa`,
    description: `${project.name} by ${project.developer} in ${project.location}, ${project.city}. ${
      project.kind === "plots" ? "Residential plots" : "Residences"
    } from ${primary}.`,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const price = headlinePrice(project);
  const hero = project.images[0] ?? null;
  const isPlots = project.kind === "plots";
  const viewer = projectViewerConfig(project);
  const [tour, splat] = await Promise.all([loadProjectTour(project), loadProjectSplat(project)]);
  const hasImmersive = Boolean(viewer || tour || splat);

  /* Capability marks come from what actually passed server-side gating. A
     format with no published asset is omitted — never a dead control. */
  const produced: string[] = [
    ...(viewer ? ["3D"] : []),
    ...(tour ? ["360°"] : []),
    ...(splat ? ["Scan"] : []),
    ...(project.planImages.length > 0 ? ["Plan"] : []),
  ];

  /* Photographs only. The developer's filed layout drawing keeps its own
     captioned section below, so it is never shown as a photograph and never
     appears twice on the page. */
  const galleryItems: GalleryItem[] = [
    ...project.images.map((src, i) => ({
      src,
      alt: `${project.name}, ${project.location} — view ${i + 1}`,
      caption: i === 0 ? `${project.name} · ${project.location}` : undefined,
      kind: "photo" as const,
    })),
  ];

  const railItems = [
    { label: project.fromPrice > 0 ? "Starting from" : "Rate", value: price.primary },
    {
      label: isPlots ? "Plots in layout" : "Completion",
      value: isPlots ? (project.totalUnits ? String(project.totalUnits) : "—") : (project.completion ?? "—"),
    },
    { label: "Developer", value: project.developer },
    ...(!isPlots && project.totalUnits
      ? [{ label: "Residences", value: String(project.totalUnits) }]
      : []),
  ];

  const specRows: LedgerRow[] = [
    { term: "Project", value: `${project.name}, ${project.location}` },
    { term: "City", value: project.city },
    { term: "Developer", value: project.developer },
    { term: isPlots ? "Layout" : "Completion", value: isPlots ? `${project.totalUnits ?? "—"} plots` : (project.completion ?? "—") },
    ...(project.approvals.length > 0 ? [{ term: "Approvals", value: project.approvals.join(" · ") }] : []),
    ...(price.secondary ? [{ term: "Indicative INR", value: price.secondary }] : []),
  ];

  return (
    <div className="pb-[var(--s-24)]">
      {/* ── DISCOVER ──────────────────────────────────────────────────────
          Cinematic hero. Photography where it exists, otherwise a typographic
          panel — never a stock photo standing in for the real site. */}
      <StageHero className="relative">
        <Plate ratio="auto" scrim={Boolean(hero)} className="h-[74vh] min-h-[460px] bg-stage">
          {hero ? (
            <Parallax distance={32} className="absolute inset-0">
              <Image
                src={hero}
                alt={`${project.name}, ${project.location}`}
                fill
                sizes="100vw"
                className="object-cover"
                priority
              />
            </Parallax>
          ) : (
            <div className="absolute inset-0 bg-stage" />
          )}
          <DraftingGrid tone="stage" size={64} fade="top" className="z-[1] opacity-25" />
          <Grain opacity={0.06} className="z-[1]" />
          <CoordinateMarks tone="stage" className="z-[2] max-md:hidden" />
          <div className="absolute inset-x-0 bottom-0 z-[2] pb-[var(--s-10)]">
            <Wrap>
              <span className="av-meta text-gold">
                {project.kind === "plots" ? "Plotted development" : "Residences"} · {project.city}
              </span>
              <TextReveal
                as="h1"
                text={project.name}
                className="av-display mt-3 max-w-[14ch] text-[clamp(36px,6vw,64px)] leading-[1.0] text-stage-ink"
              />
              <p className="av-meta mt-3 text-stage-muted">
                {project.location} · {project.developer}
              </p>
              {produced.length > 0 && (
                <div className="mt-[var(--s-5)] flex flex-wrap gap-1">
                  {produced.map((p) => (
                    <span
                      key={p}
                      className="av-meta rounded-xs border border-stage-rule px-[7px] py-[3px] text-stage-ink"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </Wrap>
          </div>
        </Plate>
      </StageHero>

      {/* Sticky summary bar — price, status and the one action, always reachable */}
      <div className="sticky top-[var(--nav-h)] z-40 border-b border-rule bg-paper">
        <Wrap className="flex flex-wrap items-center gap-[var(--s-4)] py-[10px]">
          <span className="text-[17px] font-semibold">{price.primary}</span>
          {price.secondary && <span className="text-[13px] text-ink-muted">{price.secondary}</span>}
          <Status tone={isPlots ? "ready" : "pending"}>
            {isPlots ? "Selling" : (project.completion ?? "Under construction")}
          </Status>
          <div className="ml-auto flex items-center gap-[var(--s-3)]">
            <Link
              href="/listings"
              className="av-label hidden text-ink-muted transition-colors hover:text-ink sm:inline"
            >
              All listings
            </Link>
            <Button asChild size="sm">
              <Link href="/contact">Enquire</Link>
            </Button>
          </div>
        </Wrap>
      </div>

      <Wrap className="pt-[var(--s-6)]">
        <RailStrip items={railItems} />
      </Wrap>

      {/* ── EXPLORE ───────────────────────────────────────────────────────
          Placed directly beneath the hero, before any specification: the
          immersive layer is the differentiator and is met first. The section
          is absent entirely when no published media exists. */}
      {hasImmersive && (
        <StageBand className="mt-[var(--s-14)] py-[var(--band)]">
          <ImmersiveSection
            viewer={viewer}
            tour={tour}
            splat={splat}
            projectName={project.name}
            projectSlug={project.slug}
          />
        </StageBand>
      )}

      {!hasImmersive && (
        <div className="mt-[var(--s-14)]">
          <TextureBanner
            eyebrow="Explore"
            title="This project has not been captured yet."
            body="When a 3D model, a 360° tour or a scan is produced for this project, it appears here and on the listing. Until then the specification below is the record."
            motif="contour"
            tone="stage"
          />
        </div>
      )}

      {/* ── EVALUATE ──────────────────────────────────────────────────── */}
      <Wrap className="pt-[var(--band)]">
        <div className="grid grid-cols-1 items-start gap-[var(--s-14)] lg:grid-cols-[minmax(0,1fr)_var(--aside)]">
          <div>
            <MotionReveal>
              <SectionIndex n={1} total={6} className="mb-[var(--s-3)]" />
              <SectionHead label="Overview" />
              <Ledger rows={specRows} className="-mt-[var(--s-6)]" />
            </MotionReveal>

            {/* Availability / configurations */}
            {project.unitTypes.length > 0 && (
              <MotionReveal>
                <section className="mt-[var(--s-14)]">
                  <SectionHead
                    label="Availability"
                    title={isPlots ? "Plot sizes" : "Current availability"}
                    note={
                      project.availableUnits !== null
                        ? `${project.availableUnits} units released from the developer's inventory of 28 June 2026.`
                        : undefined
                    }
                  />
                  <div className="-mt-[var(--s-6)] overflow-x-auto border border-rule">
                    <table className="w-full min-w-[560px] text-left text-[13.5px]">
                      <thead className="bg-paper-sunken">
                        <tr>
                          <th className="av-label px-5 py-3 text-ink-muted">
                            {isPlots ? "Plot size" : "Configuration"}
                          </th>
                          {!isPlots && <th className="av-label px-5 py-3 text-ink-muted">Available</th>}
                          <th className="av-label px-5 py-3 text-ink-muted">Area (sq.ft)</th>
                          <th className="av-label px-5 py-3 text-ink-muted">
                            {isPlots ? "Price" : "Price from"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {project.unitTypes.map((unit) => (
                          <tr key={unit.type} className="border-t border-rule">
                            <td className="px-5 py-4 font-medium">{unit.label}</td>
                            {!isPlots && (
                              <td className="av-num px-5 py-4 text-ink-muted">{unit.available ?? "—"}</td>
                            )}
                            <td className="av-num px-5 py-4 text-ink-muted">
                              {unit.minSqft === unit.maxSqft
                                ? unit.minSqft.toLocaleString()
                                : `${unit.minSqft.toLocaleString()} – ${unit.maxSqft.toLocaleString()}`}
                            </td>
                            <td className="av-num px-5 py-4">
                              <span className="font-semibold">
                                {formatCurrency(unit.fromPrice, project.currency)}
                              </span>
                              {inrEstimate(unit.fromPrice, project.currency) && (
                                <span className="ml-2 text-[12px] text-ink-muted">
                                  {inrEstimate(unit.fromPrice, project.currency)}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                    {isPlots
                      ? `Plot prices are calculated at the developer's quoted rate of ${formatCurrency(project.ratePerSqft ?? 0, project.currency)} per sq.ft. Confirm final figures and registry costs with Aarvasa before purchase.`
                      : `Prices are the lowest of ${project.planLabels.length} published payment plans (${project.planLabels.join(", ")}), quoted in AED. Rupee figures are indicative only, converted at AED 1 = ₹${AED_TO_INR}.`}
                  </p>
                </section>
              </MotionReveal>
            )}

            {/* Rate-only projects */}
            {project.unitTypes.length === 0 && project.ratePerSqft && (
              <MotionReveal>
                <section className="mt-[var(--s-14)]">
                  <SectionHead label="Pricing" />
                  <p className="-mt-[var(--s-6)] max-w-[var(--measure)] text-[17px] leading-relaxed">
                    {project.rateNote ??
                      `Plots are sold at ${formatCurrency(project.ratePerSqft, project.currency)} per sq.ft.`}
                  </p>
                  <p className="mt-3 text-[13px] text-ink-muted">
                    Individual plot dimensions vary across the layout — contact Aarvasa for the plot
                    schedule and exact pricing.
                  </p>
                </section>
              </MotionReveal>
            )}

            {/* Payment plans */}
            {project.paymentPlans.length > 0 && (
              <MotionReveal>
                <section className="mt-[var(--s-14)]">
                  <SectionIndex n={3} total={6} className="mb-[var(--s-3)]" />
                  <SectionHead label="Payment" title="Payment plans" />
                  <div className="-mt-[var(--s-6)] grid gap-[var(--s-5)] sm:grid-cols-2">
                    {project.paymentPlans.map((plan) => (
                      <div key={plan.name} className="border border-rule bg-paper-raised p-[var(--s-5)]">
                        <h3 className="text-[17px] font-semibold">{plan.name}</h3>
                        <Ledger
                          className="mt-4"
                          rows={[
                            { term: "Down payment", value: plan.downPayment },
                            { term: "During construction", value: plan.duringConstruction },
                            { term: "Final payment", value: plan.final },
                          ]}
                        />
                        {plan.note && <Note className="mt-4">{plan.note}</Note>}
                      </div>
                    ))}
                  </div>
                </section>
              </MotionReveal>
            )}

            {/* Highlights */}
            {project.usps.length > 0 && (
              <MotionReveal>
                <section className="mt-[var(--s-14)]">
                  <SectionIndex n={4} total={6} className="mb-[var(--s-3)]" />
                  <SectionHead label="Highlights" title={`Why ${project.name}`} />
                  <div className="-mt-[var(--s-6)] grid gap-0 sm:grid-cols-2 sm:gap-x-[var(--s-10)]">
                    {project.usps.map((usp) => (
                      <div key={usp} className="border-b border-rule py-[10px] text-[13.5px]">
                        {usp}
                      </div>
                    ))}
                  </div>
                </section>
              </MotionReveal>
            )}

            {/* Connectivity */}
            {project.nearby.length > 0 && (
              <MotionReveal>
                <section className="mt-[var(--s-14)]">
                  <SectionHead
                    label="Location"
                    title={project.nearby.some((n) => n.minutes !== null) ? "Getting around" : "Nearby landmarks"}
                  />
                  <Ledger
                    className="-mt-[var(--s-6)]"
                    rows={project.nearby.map((n) => ({
                      term: n.place,
                      value: n.minutes !== null ? `${n.minutes} min` : "Nearby",
                    }))}
                  />
                </section>
              </MotionReveal>
            )}

            {/* Layout plan — labelled as a drawing, never presented as photography */}
            {project.planImages.length > 0 && (
              <MotionReveal>
                <section className="mt-[var(--s-14)]">
                  <SectionHead
                    label="Plan"
                    title="Layout plan"
                    note="Developer's approved layout drawing. Indicative — confirm plot boundaries on site."
                  />
                  <div className="-mt-[var(--s-6)] grid gap-[var(--s-4)] sm:grid-cols-2">
                    {project.planImages.map((src, i) => (
                      <div key={src} className="border border-rule bg-white p-2">
                        <Image
                          src={src}
                          alt={`${project.name} layout plan ${i + 1}`}
                          width={562}
                          height={2600}
                          sizes="(min-width: 640px) 50vw, 100vw"
                          className="h-auto w-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </MotionReveal>
            )}

            <div className="mt-[var(--s-14)] max-w-[420px]">
              <MeasureRule />
            </div>

            {/* Gallery — photography in a lightbox with keyboard controls */}
            {galleryItems.length > 0 && (
              <Reveal>
                <section className="mt-[var(--s-14)]">
                  <SectionIndex n={6} total={6} className="mb-[var(--s-3)]" />
                  <SectionHead
                    label="Gallery"
                    title="On site"
                    note="Select any frame to open it full screen. Arrow keys move between frames."
                  />
                  <div className="-mt-[var(--s-6)]">
                    <Gallery items={galleryItems} projectName={project.name} />
                  </div>
                </section>
              </Reveal>
            )}
          </div>

          {/* Enquiry rail */}
          <aside className="grid gap-[var(--s-4)] lg:sticky lg:top-[calc(var(--nav-h)+var(--s-4))]">
            <div className="border border-rule bg-paper-raised p-[var(--s-5)]">
              <h3 className="text-[17px] font-semibold">Enquire</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {isPlots
                  ? "Speak to our team for the plot schedule, availability and a site visit."
                  : "Speak to our Dubai desk for unit-level inventory, floor plans and payment schedules."}
              </p>
              {project.contact.length > 0 && (
                <p className="av-num mt-4 text-[13.5px] font-medium">{project.contact.join(" · ")}</p>
              )}
              <Button asChild className="mt-[var(--s-5)] w-full">
                <Link href="/contact">Request details</Link>
              </Button>
            </div>

            {produced.length > 0 && (
              <div className="border border-rule bg-paper-raised p-[var(--s-5)]">
                <h3 className="av-label text-ink-muted">Produced for this project</h3>
                <div className="mt-3 flex flex-wrap gap-1">
                  {produced.map((p) => (
                    <CapMark key={p}>{p}</CapMark>
                  ))}
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
                  Only formats with a published asset are offered. Nothing downloads until you open it.
                </p>
              </div>
            )}
          </aside>
        </div>
      </Wrap>
    </div>
  );
}
