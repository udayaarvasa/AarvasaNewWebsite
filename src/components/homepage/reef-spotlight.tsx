import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, CalendarClock, MapPin, Ruler, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { getReefProject } from "@/lib/reef-projects";
import { formatCurrency, inrEstimate } from "@/lib/currency";

const SLUG = "reef-996-dubai-production-city";

export function ReefSpotlight() {
  const project = getReefProject(SLUG);
  if (!project) return null;

  const hero = project.images[1] ?? project.images[0];
  const stats = [
    { icon: CalendarClock, label: "Completion", value: project.completion },
    { icon: Building2, label: "Residences", value: project.totalUnits ? `${project.totalUnits}` : "—" },
    { icon: Ruler, label: "Sizes", value: `${project.minSqft.toLocaleString()}–${project.maxSqft.toLocaleString()} sq.ft` },
    { icon: MapPin, label: "Location", value: project.city },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8" id="reef-996">
      <MotionReveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7a1f3d] via-[#481123] to-[#240914] p-8 sm:p-12 lg:p-14">
          {/* Ambient glow, matching the site's other dark panels */}
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#d4af37]/15 blur-[90px]" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#d4af37]/10 blur-[90px]" />
          <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#d4af37]/40 to-transparent" />

          <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:items-center">
            {/* Render */}
            <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl shadow-[0_32px_80px_rgba(0,0,0,0.45)] ring-1 ring-[#f5d27a]/20">
              <Image
                src={hero}
                alt={`${project.name} tower, ${project.location}`}
                width={998}
                height={1400}
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="h-full w-full object-cover"
                priority
              />
              <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-[#f5d27a] backdrop-blur-md">
                <BadgeCheck className="h-3.5 w-3.5" />
                Exclusive to Aarvasa
              </div>
            </div>

            {/* Detail */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#f5d27a]/30 bg-[#f5d27a]/10 px-4 py-2 text-sm font-semibold text-[#f5d27a]">
                <Wind className="h-4 w-4" />
                Dubai Launch · {project.developer}
              </span>

              <h2 className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl">
                {project.name} <span className="gold-text">Dubai</span>
              </h2>
              <p className="mt-3 flex items-center gap-2 text-lg text-white/70">
                <MapPin className="h-4 w-4 shrink-0 text-[#f5d27a]" />
                {project.location}
              </p>

              {/* Price */}
              <div className="mt-7 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <span className="text-sm uppercase tracking-widest text-white/50">Starting from</span>
                <span className="text-3xl font-black text-white sm:text-4xl">
                  {formatCurrency(project.fromAed, project.currency)}
                </span>
                <span className="text-lg font-medium text-[#f5d27a]">
                  {inrEstimate(project.fromAed, project.currency)}
                </span>
              </div>

              {/* Stats */}
              <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                    <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/45">
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </dt>
                    <dd className="mt-1.5 text-sm font-bold text-white">{value}</dd>
                  </div>
                ))}
              </dl>

              {/* Unit types */}
              <div className="mt-7">
                <p className="text-xs uppercase tracking-widest text-white/45">Available configurations</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.unitTypes.map((unit) => (
                    <span
                      key={unit.type}
                      className="rounded-lg border border-[#f5d27a]/20 bg-[#f5d27a]/[0.07] px-3 py-2 text-sm text-white/85"
                    >
                      <span className="font-semibold text-white">{unit.label}</span>
                      <span className="mx-1.5 text-white/30">·</span>
                      from {formatCurrency(unit.fromAed, project.currency)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="gold" size="lg" className="text-base">
                  <Link href={`/projects/${project.slug}`}>
                    View {project.name}
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="glass"
                  size="lg"
                  className="border-white/20 text-white hover:bg-white/15"
                >
                  <Link href="/contact">Request Inventory</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </MotionReveal>
    </section>
  );
}
