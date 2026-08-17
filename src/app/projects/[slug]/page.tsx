import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, BadgeCheck, CalendarClock, Clock, MapPin, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { reefProjects, getReefProject } from "@/lib/reef-projects";
import { formatCurrency, inrEstimate, AED_TO_INR } from "@/lib/currency";

export function generateStaticParams() {
  return reefProjects
    .filter((p) => p.images.length > 0)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getReefProject(slug);
  if (!project) return { title: "Project not found" };
  return {
    title: `${project.name} — ${project.location} | Aarvasa`,
    description: `${project.name} by ${project.developer} in ${project.location}. Studios to 3 bedroom residences from ${formatCurrency(project.fromAed, project.currency)}. Completion ${project.completion}.`,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getReefProject(slug);
  if (!project || project.images.length === 0) notFound();

  return (
    <div className="min-h-screen pb-24">
      {/* Hero */}
      <section className="relative h-[52vh] min-h-[380px] w-full overflow-hidden">
        <Image
          src={project.images[0]}
          alt={`${project.name}, ${project.location}`}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#240914] via-[#240914]/55 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-[#f5d27a] backdrop-blur-md">
            <BadgeCheck className="h-3.5 w-3.5" />
            Exclusive to Aarvasa
          </span>
          <h1 className="mt-4 text-4xl font-black text-white sm:text-6xl">{project.name}</h1>
          <p className="mt-2 flex items-center gap-2 text-lg text-white/75">
            <MapPin className="h-4 w-4 text-[#f5d27a]" />
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
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Starting from</p>
              <p className="mt-1 text-3xl font-black text-foreground">
                {formatCurrency(project.fromAed, project.currency)}
              </p>
              <p className="text-sm font-medium text-[#b8912a]">
                {inrEstimate(project.fromAed, project.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Completion</p>
              <p className="mt-1 flex items-center gap-2 text-xl font-bold text-foreground">
                <CalendarClock className="h-5 w-5 text-[#b8912a]" />
                {project.completion}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Developer</p>
              <p className="mt-1 text-xl font-bold text-foreground">{project.developer}</p>
              {project.totalUnits && (
                <p className="text-sm text-muted-foreground">{project.totalUnits} residences</p>
              )}
            </div>
          </div>
        </MotionReveal>

        {/* Availability table */}
        <MotionReveal>
          <section className="mt-12">
            <h2 className="text-2xl font-black text-foreground">Current availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {`${project.availableUnits} units released from the developer's inventory of 28 June 2026.`}
            </p>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Configuration</th>
                    <th className="px-5 py-3 font-semibold">Available</th>
                    <th className="px-5 py-3 font-semibold">Size (sq.ft)</th>
                    <th className="px-5 py-3 font-semibold">Price from</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {project.unitTypes.map((unit) => (
                    <tr key={unit.type}>
                      <td className="px-5 py-4 font-semibold text-foreground">{unit.label}</td>
                      <td className="px-5 py-4 text-muted-foreground">{unit.available}</td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {unit.minSqft.toLocaleString()} – {unit.maxSqft.toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-foreground">
                          {formatCurrency(unit.fromAed, project.currency)}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {inrEstimate(unit.fromAed, project.currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Prices are the lowest of {project.planLabels.length} published payment plans
              ({project.planLabels.join(", ")}), quoted in AED. Rupee figures are indicative only,
              converted at AED 1 = ₹{AED_TO_INR}.
            </p>
          </section>
        </MotionReveal>

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

        {/* Why REEF */}
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
              <h2 className="text-2xl font-black text-foreground">Getting around</h2>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {project.nearby.map((n) => (
                  <span
                    key={n.place}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
                  >
                    <Clock className="h-3.5 w-3.5 text-[#b8912a]" />
                    {n.place}
                    <span className="font-semibold text-muted-foreground">{n.minutes} min</span>
                  </span>
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
              Speak to our Dubai desk for the full unit-level inventory, floor plans and payment schedules.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="gold" size="lg">
                <Link href="/contact">Request full inventory</Link>
              </Button>
              <Button
                asChild
                variant="glass"
                size="lg"
                className="border-white/20 text-white hover:bg-white/15"
              >
                <Link href="/listings">Browse all listings</Link>
              </Button>
            </div>
          </section>
        </MotionReveal>
      </div>
    </div>
  );
}
