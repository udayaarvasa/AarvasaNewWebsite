import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  Wind,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { getProject, publishedProjects } from "@/lib/projects";
import type { Project } from "@/lib/project-types";
import { formatCurrency, inrEstimate, AED_TO_INR } from "@/lib/currency";

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
    return {
      primary: `${formatCurrency(project.ratePerSqft, project.currency)} / sq.ft`,
      secondary: null,
    };
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

  return (
    <div className="min-h-screen pb-24">
      {/* Hero — photography where it exists, otherwise a typographic panel.
          Never a stock photo standing in for the real site. */}
      <section className="relative h-[52vh] min-h-[380px] w-full overflow-hidden">
        {hero ? (
          <>
            <Image src={hero} alt={`${project.name}, ${project.location}`} fill sizes="100vw" className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-[#240914] via-[#240914]/55 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#7a1f3d] via-[#481123] to-[#240914]">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#d4af37]/15 blur-[90px]" />
            <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-[90px]" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-[#f5d27a] backdrop-blur-md">
            <BadgeCheck className="h-3.5 w-3.5" />
            Exclusive to Aarvasa
          </span>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-6xl">{project.name}</h1>
          <p className="mt-2 flex items-start gap-2 text-lg text-white/75">
            <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#f5d27a]" />
            {project.location}, {project.city}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="mt-6">
          <Link href="/listings">
            <ArrowLeft className="h-4 w-4" />
            Back to listings
          </Link>
        </Button>

        {/* Headline figures */}
        <MotionReveal>
          <div className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {project.fromPrice > 0 ? "Starting from" : "Rate"}
              </p>
              <p className="mt-1 text-3xl font-black text-foreground">{price.primary}</p>
              {price.secondary && (
                <p className="text-sm font-medium text-[#b8912a]">{price.secondary}</p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                {isPlots ? "Plots" : "Completion"}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xl font-bold text-foreground">
                <CalendarClock className="h-5 w-5 text-[#b8912a]" />
                {isPlots
                  ? project.totalUnits
                    ? `${project.totalUnits} in layout`
                    : "—"
                  : (project.completion ?? "—")}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Developer</p>
              <p className="mt-1 text-xl font-bold text-foreground">{project.developer}</p>
              {!isPlots && project.totalUnits && (
                <p className="text-sm text-muted-foreground">{project.totalUnits} residences</p>
              )}
            </div>
          </div>
        </MotionReveal>

        {/* Approvals */}
        {project.approvals.length > 0 && (
          <MotionReveal>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {project.approvals.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {a}
                </span>
              ))}
            </div>
          </MotionReveal>
        )}

        {/* Availability / configurations */}
        {project.unitTypes.length > 0 && (
          <MotionReveal>
            <section className="mt-12">
              <h2 className="text-2xl font-black text-foreground">
                {isPlots ? "Plot sizes" : "Current availability"}
              </h2>
              {project.availableUnits !== null && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {`${project.availableUnits} units released from the developer's inventory of 28 June 2026.`}
                </p>
              )}
              <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 font-semibold">{isPlots ? "Plot size" : "Configuration"}</th>
                      {!isPlots && <th className="px-5 py-3 font-semibold">Available</th>}
                      <th className="px-5 py-3 font-semibold">Area (sq.ft)</th>
                      <th className="px-5 py-3 font-semibold">{isPlots ? "Price" : "Price from"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {project.unitTypes.map((unit) => (
                      <tr key={unit.type}>
                        <td className="px-5 py-4 font-semibold text-foreground">{unit.label}</td>
                        {!isPlots && (
                          <td className="px-5 py-4 text-muted-foreground">{unit.available ?? "—"}</td>
                        )}
                        <td className="px-5 py-4 text-muted-foreground">
                          {unit.minSqft === unit.maxSqft
                            ? unit.minSqft.toLocaleString()
                            : `${unit.minSqft.toLocaleString()} – ${unit.maxSqft.toLocaleString()}`}
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-foreground">
                            {formatCurrency(unit.fromPrice, project.currency)}
                          </span>
                          {inrEstimate(unit.fromPrice, project.currency) && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {inrEstimate(unit.fromPrice, project.currency)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
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
            <section className="mt-12 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-2xl font-black text-foreground">Pricing</h2>
              <p className="mt-2 text-muted-foreground">
                Plots are sold at {formatCurrency(project.ratePerSqft, project.currency)} per sq.ft.
                Individual plot dimensions vary across the layout — contact Aarvasa for the plot
                schedule and exact pricing.
              </p>
            </section>
          </MotionReveal>
        )}

        {/* Payment plans */}
        {project.paymentPlans.length > 0 && (
          <MotionReveal>
            <section className="mt-12">
              <h2 className="text-2xl font-black text-foreground">Payment plans</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {project.paymentPlans.map((plan) => (
                  <div key={plan.name} className="rounded-2xl border border-border bg-card p-6">
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Down payment</dt>
                        <dd className="font-semibold text-foreground">{plan.downPayment}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">During construction</dt>
                        <dd className="font-semibold text-foreground">{plan.duringConstruction}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Final payment</dt>
                        <dd className="font-semibold text-foreground">{plan.final}</dd>
                      </div>
                    </dl>
                    {plan.note && (
                      <p className="mt-4 rounded-lg bg-[#d4af37]/10 px-3 py-2 text-xs font-medium text-[#8a6c1f]">
                        {plan.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </MotionReveal>
        )}

        {/* Highlights */}
        <MotionReveal>
          <section className="mt-12">
            <h2 className="text-2xl font-black text-foreground">Why {project.name}</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {project.usps.map((usp) => (
                <li
                  key={usp}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground"
                >
                  <Wind className="mt-0.5 h-4 w-4 shrink-0 text-[#b8912a]" />
                  {usp}
                </li>
              ))}
            </ul>
          </section>
        </MotionReveal>

        {/* Connectivity */}
        {project.nearby.length > 0 && (
          <MotionReveal>
            <section className="mt-12">
              <h2 className="text-2xl font-black text-foreground">
                {project.nearby.some((n) => n.minutes !== null) ? "Getting around" : "Nearby landmarks"}
              </h2>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {project.nearby.map((n) => (
                  <span
                    key={n.place}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
                  >
                    {n.minutes !== null ? (
                      <>
                        <Clock className="h-3.5 w-3.5 text-[#b8912a]" />
                        {n.place}
                        <span className="font-semibold text-muted-foreground">{n.minutes} min</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3.5 w-3.5 text-[#b8912a]" />
                        {n.place}
                      </>
                    )}
                  </span>
                ))}
              </div>
            </section>
          </MotionReveal>
        )}

        {/* Layout plan — labelled as a drawing, never presented as photography */}
        {project.planImages.length > 0 && (
          <MotionReveal>
            <section className="mt-12">
              <h2 className="text-2xl font-black text-foreground">Layout plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Developer&apos;s approved layout drawing. Indicative — confirm plot boundaries on site.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {project.planImages.map((src, i) => (
                  <div key={src} className="overflow-hidden rounded-2xl border border-border bg-white p-2">
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

        {/* Gallery */}
        {project.images.length > 1 && (
          <MotionReveal>
            <section className="mt-12">
              <h2 className="text-2xl font-black text-foreground">Gallery</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {project.images.map((src, i) => (
                  <div key={src} className="overflow-hidden rounded-2xl border border-border">
                    <Image
                      src={src}
                      alt={`${project.name} render ${i + 1}`}
                      width={1920}
                      height={1080}
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          </MotionReveal>
        )}

        {/* CTA */}
        <MotionReveal>
          <section className="mt-14 rounded-3xl bg-gradient-to-br from-[#7a1f3d] via-[#481123] to-[#240914] p-10 text-center">
            <h2 className="text-3xl font-black text-white">Interested in {project.name}?</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">
              {isPlots
                ? "Speak to our team for the plot schedule, availability and site visit."
                : "Speak to our Dubai desk for the full unit-level inventory, floor plans and payment schedules."}
            </p>
            {project.contact.length > 0 && (
              <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-[#f5d27a]">
                <Phone className="h-4 w-4" />
                {project.contact.join(" · ")}
              </p>
            )}
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="gold" size="lg">
                <Link href="/contact">Request details</Link>
              </Button>
              <Button asChild variant="glass" size="lg" className="border-white/20 text-white hover:bg-white/15">
                <Link href="/listings">Browse all listings</Link>
              </Button>
            </div>
          </section>
        </MotionReveal>
      </div>
    </div>
  );
}
