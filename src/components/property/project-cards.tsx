import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { publishedProjects } from "@/lib/projects";
import { formatCurrency, formatCompact, inrEstimate } from "@/lib/currency";

/**
 * Exclusive developer projects, rendered from curated data rather than the
 * properties table. Cards fall back to a typographic panel when a project has
 * no photography of its own — never a stand-in image of somewhere else.
 */
export function ProjectCards() {
  const items = publishedProjects();
  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-white/60 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37] shadow-sm backdrop-blur-md">
          Exclusive Projects
        </span>
        <h2 className="heading-serif mt-4 text-3xl tracking-tight text-[#4A0012] sm:text-4xl">
          Developer <span className="text-[#7A0019]">Exclusives</span>
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[#7A5C5C]">
          Projects Aarvasa represents directly, with inventory and pricing sourced from the developer.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((project, i) => {
          const cover = project.images[0] ?? project.planImages[0] ?? null;
          const isPlanOnly = project.images.length === 0;
          const price =
            project.fromPrice > 0
              ? formatCompact(project.fromPrice, project.currency)
              : project.ratePerSqft
                ? `${formatCurrency(project.ratePerSqft, project.currency)}/sq.ft`
                : "On request";

          return (
            <MotionReveal key={project.slug} delay={i * 0.08}>
              <Link
                href={`/projects/${project.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#DCCDCE]/50 bg-white shadow-luxury-sm transition hover:-translate-y-1 hover:shadow-luxury-lg"
              >
                <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#7a1f3d] via-[#481123] to-[#240914]">
                  {cover && (
                    <Image
                      src={cover}
                      alt={`${project.name}, ${project.location}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className={
                        isPlanOnly
                          ? "object-contain object-top opacity-90 p-2"
                          : "object-cover transition duration-500 group-hover:scale-105"
                      }
                    />
                  )}
                  {isPlanOnly && (
                    <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-md">
                      Layout plan
                    </span>
                  )}
                  <span className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-bold text-[#f5d27a] backdrop-blur-md">
                    {price}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-lg font-black text-[#4A0012]">{project.name}</h3>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-[#7A5C5C]">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                    {project.location}, {project.city}
                  </p>

                  {project.approvals.length > 0 && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {project.approvals[0]}
                    </p>
                  )}

                  {inrEstimate(project.fromPrice, project.currency) && (
                    <p className="mt-3 text-xs font-medium text-[#B8912A]">
                      {inrEstimate(project.fromPrice, project.currency)}
                    </p>
                  )}

                  <span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#7A0019]">
                    View project
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </MotionReveal>
          );
        })}
      </div>
    </section>
  );
}
