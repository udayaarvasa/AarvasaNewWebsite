import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { StageHero } from "@/components/layout/nav-overlay";
import { MeasureRule, SectionIndex } from "@/components/av/graphics";
import { Reveal } from "@/components/av/motion";
import { Gallery, type GalleryItem } from "@/components/property/gallery";
import { projectImageSrc } from "@/lib/project-types";
import {
  CapMark,
  Ledger,
  Note,
  SectionHead,
  Status,
  StageBand,
  Wrap,
  type LedgerRow,
} from "@/components/av/primitives";
import { getProject, publishedProjects } from "@/lib/projects";
import type { Project } from "@/lib/project-types";
import { formatCurrency, inrEstimate, AED_TO_INR } from "@/lib/currency";
import { loadProjectModel } from "@/lib/services/project-models";
import { loadProjectTour } from "@/lib/services/project-panoramas";
import { loadProjectSplat } from "@/lib/services/project-splats";
import { ExploreArea } from "@/components/property/explore-area";
import { NearbyPlaces } from "@/components/property/nearby-places";
import { ImmersiveTour } from "@/components/property/immersive-tour";
import { loadImmersiveTour } from "@/lib/services/immersive-tour";
import { exploreAreaMode } from "@/lib/maps/google-3d";
import ImmersiveSection from "./immersive-section";
import { MapPin } from "lucide-react";
import { FadeUp, LuxHeading } from "@/components/lux/motion";
import { Container as LuxContainer, GhostButton, GoldButton } from "@/components/lux/primitives";

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
  /* A curated library wins over the flat `images` list: it carries a 16:9 crop
     made for this slot and states how the frame was produced. */
  const heroImage = project.imagery?.hero ?? null;
  const hero = heroImage ? projectImageSrc(heroImage, "16x9") : (project.images[0] ?? null);
  const heroAlt = heroImage?.alt ?? `${project.name}, ${project.location}`;
  /* Named on the hero itself, so the first thing a reader sees is qualified
     before they scroll. An off-plan tower photographs as a render or not at all. */
  const heroOriginNote =
    heroImage?.origin === "render" ? "Developer render — building not yet complete" : null;
  const isPlots = project.kind === "plots";
  /* All three come from the database where the project has published media, so
     a model a creator published through the studio appears here rather than only
     the hand-authored pilot asset. */
  const [viewer, tour, splat, films] = await Promise.all([
    loadProjectModel(project),
    loadProjectTour(project),
    loadProjectSplat(project),
    /* The developer's films, through the PUBLIC media resolver only. Null until
       they have been through upload, worker, review and release — there is no
       local file for this to fall back to, by design. */
    loadImmersiveTour(project),
  ]);
  const hasImmersive = Boolean(viewer || tour || splat);
  const hasFilms = Boolean(films && films.length > 0);

  /* Explore Area is geographic context, not the property's own model, so it is
     offered independently of whether any immersive media exists. It still needs
     a key and coordinates somebody verified — a plausible latitude is a made-up
     fact about where a home is. */
  const area = exploreAreaMode({
    coordinates: project.coordinates,
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
  });
  const hasArea = area.kind !== "unavailable";

  /* Capability marks come from what actually passed server-side gating. A
     format with no published asset is omitted — never a dead control. */
  const produced: string[] = [
    ...(viewer ? ["3D"] : []),
    ...(tour ? ["360°"] : []),
    ...(splat ? ["Scan"] : []),
    ...(hasArea ? ["Area"] : []),
    ...(project.planImages.length > 0 ? ["Plan"] : []),
  ];

  /* The developer's filed layout drawing keeps its own captioned section below,
     so it is never shown as a photograph and never appears twice on the page.
     Where a curated library exists, each frame carries its own provenance —
     for an off-plan project most of them are renders and are marked as such. */
  const galleryItems: GalleryItem[] = project.imagery
    ? project.imagery.gallery.map((image) => ({
        src: projectImageSrc(image, "3x2"),
        alt: image.alt,
        caption: image.caption,
        kind: image.origin,
      }))
    : project.images.map((src, i) => ({
        src,
        alt: `${project.name}, ${project.location} — view ${i + 1}`,
        caption: i === 0 ? `${project.name} · ${project.location}` : undefined,
        kind: "photo" as const,
      }));

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

  // The enquiry form arrives already naming the project the visitor came from.
  const enquireHref = `/contact?project=${encodeURIComponent(project.name)}`;

  /* Sections are numbered by what this project actually shows, so a project
     without payment plans reads 01, 02, 03 — not 01, 04, 06. */
  const sections = [
    "overview",
    project.unitTypes.length > 0 || project.ratePerSqft ? "pricing" : null,
    project.paymentPlans.length > 0 ? "payment" : null,
    project.usps.length > 0 ? "highlights" : null,
    project.nearby.length > 0 ? "location" : null,
    project.planImages.length > 0 ? "plan" : null,
    galleryItems.length > 0 ? "gallery" : null,
  ].filter((k): k is string => k !== null);
  const indexOf = (key: string) => (
    <SectionIndex n={sections.indexOf(key) + 1} total={sections.length} className="mb-[var(--s-3)]" />
  );

  return (
    <div className="pb-[var(--s-24)]">
      {/* ── DISCOVER ──────────────────────────────────────────────────────
          Cinematic hero. Photography where it exists, otherwise a typographic
          panel — never a stock photo standing in for the real site. */}
      <StageHero className="relative isolate overflow-hidden">
        <div className={hero ? "relative min-h-[92svh]" : "relative min-h-[64svh]"}>
          {hero ? (
            <div className="absolute inset-0">
              <Image src={hero} alt={heroAlt} fill sizes="100vw" className="av-kenburns object-cover" priority />
            </div>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_70%_20%,#3d0c10,#070505_70%)]" />
          )}
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,5,5,0.6)_0%,rgba(7,5,5,0.1)_35%,rgba(7,5,5,0.55)_65%,rgba(7,5,5,1)_100%)]" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,5,5,0.75)_0%,rgba(7,5,5,0)_60%)]" />
          {heroOriginNote && (
            <span className="av-meta absolute right-[var(--gutter)] top-[calc(var(--nav-h)+16px)] z-[3] rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] text-stage-ink backdrop-blur-md">
              {heroOriginNote}
            </span>
          )}

          <LuxContainer className={`relative z-[3] flex flex-col justify-end ${hero ? "min-h-[92svh]" : "min-h-[64svh]"} pb-[var(--s-10)] pt-[calc(var(--nav-h)+40px)]`}>
            <FadeUp immediate delay={0.1} y={12}>
              <span className="lux-eyebrow">
                {project.kind === "plots" ? "Plotted development" : "Residences"} · {project.city}
              </span>
            </FadeUp>
            <LuxHeading
              as="h1"
              immediate
              delay={0.2}
              text={project.name}
              className="av-display mt-4 text-[clamp(56px,9vw,140px)] font-light leading-[0.9] text-stage-ink"
            />
            <FadeUp immediate delay={0.5} className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-stage-muted">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gold" aria-hidden="true" /> {project.location}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-gold/60 sm:block" />
              <span>{project.developer}</span>
              {produced.map((p) => (
                <span key={p} className="av-meta rounded-full border border-gold/40 px-2.5 py-1 text-[10px] text-gold">
                  {p}
                </span>
              ))}
            </FadeUp>

            {/* The figures that decide it, in glass over the frame */}
            <FadeUp immediate delay={0.7} className="mt-8">
              <dl className="lux-glass grid grid-cols-2 gap-px overflow-hidden rounded-[24px] md:grid-cols-4">
                {railItems.map((item) => (
                  <div key={item.label} className="px-6 py-5">
                    <dt className="av-meta text-[10px] text-stage-muted">{item.label}</dt>
                    <dd className="av-display mt-2 text-[clamp(22px,2.2vw,30px)] leading-none text-stage-ink">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </FadeUp>
            <FadeUp immediate delay={0.85} className="mt-6 flex flex-wrap gap-3">
              <GoldButton href={enquireHref}>Enquire about {project.name}</GoldButton>
              <GhostButton href="/listings">All properties</GhostButton>
            </FadeUp>
          </LuxContainer>
        </div>
      </StageHero>

      {/* Sticky summary bar — price, status and the one action, always reachable */}
      <div className="sticky top-[var(--nav-h)] z-40 mx-3 mt-4 md:mx-auto md:max-w-[1240px]">
        <div className="lux-glass-strong flex flex-wrap items-center gap-[var(--s-4)] rounded-full px-5 py-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.4)] md:px-6">
          <span className="av-display text-[22px] leading-none text-ink">{project.name}</span>
          <span className="hidden h-4 w-px bg-white/15 sm:block" />
          <span className="text-[15px] font-semibold text-gold-pale">{price.primary}</span>
          {price.secondary && <span className="hidden text-[13px] text-ink-muted sm:inline">{price.secondary}</span>}
          <Status tone={isPlots ? "ready" : "pending"}>
            {isPlots ? "Selling" : (project.completion ?? "Under construction")}
          </Status>
          <Link
            href={enquireHref}
            className="av-gold ml-auto rounded-full px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em]"
          >
            Enquire
          </Link>
        </div>
      </div>

      {/* ── EXPLORE ───────────────────────────────────────────────────────
          Two experiences, kept apart because they answer different questions.
          "Explore property" is the building itself, in the PlayCanvas viewer.
          "Explore area" is where it stands, on Google's photorealistic map —
          Google's mesh is never used as the property, because its capture of an
          off-plan plot is a construction site.

          Each entry is either live or honestly absent. An entry that is missing
          says which input it is waiting for rather than pretending to be broken,
          and neither is ever simulated. */}
      {hasImmersive || hasFilms || hasArea ? (
      <StageBand className="mt-[var(--s-14)] py-[var(--band)]">
        <Wrap>
          <SectionHead label="Explore" title="See it for yourself" note="Nothing downloads until you open it." />

          {/* Only what is live is offered. An entry waiting on an asset, a key
              or verified coordinates is left out rather than shown as an empty
              box: a page of "not yet available" panels reads as unfinished, and
              an entry point to something unvalidated is a promise. */}
          <div className="mt-[var(--s-8)] grid gap-[var(--s-8)] lg:grid-cols-2">
            {hasImmersive && (
              <div className={hasFilms ? undefined : "lg:col-span-2"}>
                <h3 className="av-label text-stage-ink">Explore property</h3>
                <p className="mt-1 text-[14px] text-stage-muted">Interactive 3D model</p>
                <div className="mt-[var(--s-5)]">
                  <ImmersiveSection
                    viewer={viewer}
                    tour={tour}
                    splat={splat}
                    projectName={project.name}
                    projectSlug={project.slug}
                  />
                </div>
              </div>
            )}

            {/* Immersive tour — the developer's films, cut into the spaces they
                show. Flat films, never offered as 360: they cover what the camera
                pointed at and nothing more. */}
            {films && hasFilms && (
              <div className={hasImmersive ? undefined : "lg:col-span-2"}>
                <h3 className="av-label text-stage-ink">Immersive tour</h3>
                <p className="mt-1 text-[14px] text-stage-muted">Films of the spaces</p>
                <div className="mt-[var(--s-5)]">
                  <ImmersiveTour scenes={films} projectName={project.name} />
                </div>
              </div>
            )}

            {/* Explore area — the surroundings, full width in its own row. */}
            {area.kind !== "unavailable" && (
              <div className="lg:col-span-2">
                <h3 className="av-label text-stage-ink">Explore area</h3>
                <p className="mt-1 text-[14px] text-stage-muted">3D surroundings</p>
                <div className="mt-[var(--s-5)]">
                  <MotionReveal>
                    <ExploreArea
                      name={project.name}
                      location={`${project.location}, ${project.city}`}
                      coordinates={area.center}
                      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? null}
                    />
                    {/* Shares the map's gate exactly: same key, same verified
                        coordinates. Measuring distances from a position nobody
                        checked would make up how far a school is from a home. */}
                    <NearbyPlaces
                      center={area.center}
                      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? ""}
                    />
                  </MotionReveal>
                </div>
              </div>
            )}
          </div>
        </Wrap>
      </StageBand>
      ) : null}

      {/* ── EVALUATE ──────────────────────────────────────────────────── */}
      <Wrap className="pt-[var(--band)]">
        <div className="grid grid-cols-1 items-start gap-[var(--s-14)] lg:grid-cols-[minmax(0,1fr)_var(--aside)]">
          <div>
            <MotionReveal>
              {indexOf("overview")}
              <SectionHead label="Overview" />
              <Ledger rows={specRows} className="-mt-[var(--s-6)]" />
            </MotionReveal>

            {/* Availability / configurations */}
            {project.unitTypes.length > 0 && (
              <MotionReveal>
                <section className="mt-[var(--s-14)]">
                  {indexOf("pricing")}
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
                  {indexOf("pricing")}
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
                  {indexOf("payment")}
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
                  {indexOf("highlights")}
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
                  {indexOf("location")}
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
                  {indexOf("plan")}
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
                  {indexOf("gallery")}
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
              <Button asChild className="av-gold mt-[var(--s-5)] w-full rounded-full">
                <Link href={enquireHref}>Request details</Link>
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
