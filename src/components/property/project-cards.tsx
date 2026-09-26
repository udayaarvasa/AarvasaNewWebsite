import Image from "next/image";
import Link from "next/link";
import { MotionReveal } from "@/components/layout/motion-reveal";
import { Plate, Status } from "@/components/av/primitives";
import { publishedProjects } from "@/lib/projects";
import { formatCurrency, formatCompact, inrEstimate } from "@/lib/currency";
import { projectImageSrc } from "@/lib/project-types";
import { projectViewerConfig } from "@/lib/viewer/project-media";

/**
 * Developer projects, rendered from curated data rather than the properties
 * table. Plates, not cards: image, hairline, hanging text.
 *
 * A project with no photography of its own gets a typographic panel — never a
 * stand-in image of somewhere else. Where a project has a published 3D model,
 * that is stated from real server-side gating; 360° and splat availability
 * need per-request loaders, so they are shown on the project page rather than
 * guessed at here.
 *
 * The section heading is supplied by the page so it is not stated twice.
 */
export function ProjectCards() {
  const items = publishedProjects();
  if (items.length === 0) return null;

  return (
    <div className="grid gap-[var(--s-8)] md:grid-cols-2 lg:grid-cols-3">
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
        const isRenderCover = coverImage?.origin === "render";
        const hasModel = Boolean(projectViewerConfig(project));
        const price =
          project.fromPrice > 0
            ? formatCompact(project.fromPrice, project.currency)
            : project.ratePerSqft
              ? `${formatCurrency(project.ratePerSqft, project.currency)}/sq.ft`
              : "On request";
        const inr = inrEstimate(project.fromPrice, project.currency);

        return (
          <MotionReveal key={project.slug} delay={Math.min(i, 3) * 0.09}>
            <Link href={`/projects/${project.slug}`} className="group block" data-hov>
              <Plate ratio="card" className="border-b border-rule-firm">
                {cover ? (
                  <Image
                    src={cover}
                    alt={coverImage?.alt ?? `${project.name}, ${project.location}`}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className={
                      isPlanCover
                        ? "bg-white object-contain object-top p-2"
                        : "object-cover transition-transform duration-[1200ms] ease-[var(--ease-enter)] group-hover:scale-[1.03]"
                    }
                  />
                ) : (
                  <div className="absolute inset-0 flex items-end bg-paper-sunken p-4">
                    <span className="av-meta text-ink-disabled">Not yet photographed</span>
                  </div>
                )}
                {isPlanCover && (
                  <span className="av-meta absolute bottom-3 left-3 rounded-xs border border-rule-firm bg-paper/90 px-2 py-1 text-ink">
                    Layout plan
                  </span>
                )}
                {isRenderCover && (
                  <span className="av-meta absolute bottom-3 left-3 rounded-xs border border-rule-firm bg-paper/90 px-2 py-1 text-ink">
                    Render
                  </span>
                )}
              </Plate>

              <h3 className="av-display mt-3 text-[22px] leading-[1.15]">{project.name}</h3>
              <p className="mt-[2px] text-[13px] text-ink-muted">
                {project.location}, {project.city}
              </p>
              <p className="av-num mt-2 text-[15px] font-semibold">
                {price}
                {inr && <span className="ml-2 font-normal text-ink-muted">{inr}</span>}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rule pt-[10px]">
                {project.approvals.length > 0 && <Status tone="ready">{project.approvals[0]}</Status>}
                {project.completion && <Status tone="pending">{project.completion}</Status>}
                {hasModel && (
                  <span className="av-meta rounded-xs border border-rule-firm px-[7px] py-[3px] text-ink">
                    3D
                  </span>
                )}
              </div>
            </Link>
          </MotionReveal>
        );
      })}
    </div>
  );
}
