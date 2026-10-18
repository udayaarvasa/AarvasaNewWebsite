import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { Status } from "@/components/av/primitives";
import { publishedProjects } from "@/lib/projects";
import { formatCurrency, formatCompact, inrEstimate } from "@/lib/currency";
import { projectImageSrc } from "@/lib/project-types";
import { projectsWithModel } from "@/lib/services/project-models";
import { matchesProjectQuery, type ProjectQuery } from "@/lib/project-filter";

/**
 * Developer projects, rendered from curated data rather than the properties
 * table. Plates, not cards: image, hairline, hanging text.
 *
 * A project with no photography of its own gets a typographic panel — never a
 * stand-in image of somewhere else. Where a project has a published 3D model,
 * that is stated from real server-side gating — including models published
 * through the studio, so a card never denies 3D that its project page offers.
 * 360° and splat availability need per-scene loaders, so they are shown on the
 * project page rather than guessed at here.
 *
 * The section heading is supplied by the page so it is not stated twice.
 */
export async function ProjectCards({ query = {} }: { query?: ProjectQuery } = {}) {
  /* Developer inventory obeys every filter on the page, not just the city:
     showing Dubai and Bhopal projects above a Mumbai result set read as
     Mumbai matches. */
  const items = publishedProjects().filter((p) => matchesProjectQuery(p, query));
  if (items.length === 0) return null;
  const withModel = await projectsWithModel(items);

  return (
    <div className="grid gap-[var(--s-6)] md:grid-cols-2 lg:grid-cols-3">
      {items.map((project, i) => {
        /* A card frame, not the hero — the listing and the project page should
           not open on the same picture. */
        const coverImage = project.imagery?.cards[0] ?? null;
        const cover = coverImage
          ? projectImageSrc(coverImage, "3x2")
          : (project.images[0] ?? project.planImages[0] ?? null);
        // True only when the cover is actually a drawing — a project with no
        // artwork at all shows the panel and no label.
        const isPlanCover = !project.images[0] && !!project.planImages[0];
        const hasModel = withModel.has(project.slug);
        const price =
          project.fromPrice > 0
            ? formatCompact(project.fromPrice, project.currency)
            : project.ratePerSqft
              ? `${formatCurrency(project.ratePerSqft, project.currency)}/sq.ft`
              : "On request";
        const inr = inrEstimate(project.fromPrice, project.currency);

        return (
          <MotionReveal key={project.slug} delay={Math.min(i, 3) * 0.09}>
            <Link
              href={`/projects/${project.slug}`}
              className="group lux-gold-border block overflow-hidden rounded-[24px] bg-paper-raised transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-2 hover:shadow-[0_40px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(217,194,154,0.25)]"
              data-hov
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                {cover ? (
                  <Image
                    src={cover}
                    alt={coverImage?.alt ?? `${project.name}, ${project.location}`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className={
                      isPlanCover
                        ? "bg-white object-contain object-top p-2"
                        : "object-cover transition-transform duration-[1600ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-110"
                    }
                  />
                ) : (
                  <div className="absolute inset-0 flex items-end bg-[radial-gradient(circle_at_30%_20%,#4f060c,#110c0d_70%)] p-5">
                    <span className="av-meta text-[10px] text-ink-muted">Not yet photographed</span>
                  </div>
                )}
                {!isPlanCover && cover && (
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(7,5,5,0.7))]" />
                )}
                {isPlanCover && (
                  <span className="av-meta absolute left-4 top-4 rounded-full bg-black/55 px-3 py-1.5 text-[10px] text-stage-ink backdrop-blur-md">
                    Layout plan
                  </span>
                )}
                {hasModel && (
                  <span className="av-meta absolute right-4 top-4 rounded-full border border-gold/50 bg-black/55 px-3 py-1.5 text-[10px] text-gold backdrop-blur-md">
                    3D
                  </span>
                )}
                <span className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 bg-black/40 text-gold backdrop-blur-md transition-all duration-500 group-hover:rotate-45 group-hover:bg-gold group-hover:text-[#3a0509]">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>

              <div className="p-6">
                <h3 className="av-display text-[30px] font-normal leading-none text-ink">{project.name}</h3>
                <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-muted">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" aria-hidden="true" />
                  {project.location}, {project.city}
                </p>
                <div className="mt-5 flex items-end justify-between gap-3 border-t border-rule pt-4">
                  <p className="av-num">
                    <span className="block text-[18px] font-semibold text-gold-pale">{price}</span>
                    {inr && <span className="text-[12.5px] text-ink-muted">{inr}</span>}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    {project.approvals.length > 0 && <Status tone="ready">{project.approvals[0]}</Status>}
                    {project.completion && <Status tone="pending">{project.completion}</Status>}
                  </div>
                </div>
              </div>
            </Link>
          </MotionReveal>
        );
      })}
    </div>
  );
}
