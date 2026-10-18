import { formatCompact, inrEstimate } from "@/lib/currency";
import { projectImageSrc, type Project } from "@/lib/project-types";
import { publishedProjects } from "@/lib/projects";
import type { RailProject } from "@/components/lux/project-rail";

/**
 * Presentation data for the 2026 pages, derived from the project records.
 * Nothing here is typed in: every figure and frame comes from a project.
 */

export function priceOf(p: Project) {
  if (p.fromPrice > 0) return { price: formatCompact(p.fromPrice, p.currency), note: inrEstimate(p.fromPrice, p.currency) };
  if (p.ratePerSqft) return { price: `${formatCompact(p.ratePerSqft, p.currency)}/sq.ft`, note: null };
  return { price: "On request", note: null };
}

export function railProjects(): RailProject[] {
  return publishedProjects().map((p) => {
    const card = p.imagery?.cards[0] ?? p.imagery?.hero ?? null;
    const src = card ? projectImageSrc(card, "4x5") : (p.images[0] ?? null);
    const { price, note } = priceOf(p);
    return {
      slug: p.slug,
      name: p.name,
      place: `${p.location.split(",")[0]}, ${p.city}`,
      price,
      priceNote: note,
      status: p.kind === "plots" ? "Plots selling" : (p.completion ? `Handover ${p.completion}` : "Residences"),
      image: src,
      imageNote: card?.origin === "render" ? "Render" : null,
    };
  });
}

/**
 * The headline figures, every one counted from the published project records,
 * so a figure can never claim more than a visitor can open. (Stated figures of
 * "10+ projects / 20+ developers" were removed on 19 Oct 2026: the records hold
 * 5 projects from 2 developers, and no source supported the larger numbers.)
 */
export function platformFigures(): { value: number; suffix: string; label: string }[] {
  const projects = publishedProjects();
  return [
    { value: projects.length, suffix: "", label: "Projects listed" },
    { value: new Set(projects.map((p) => p.country)).size, suffix: "", label: "Countries" },
    { value: new Set(projects.map((p) => p.developer)).size, suffix: "", label: "Developers" },
    { value: projects.reduce((sum, p) => sum + (p.totalUnits ?? 0), 0), suffix: "", label: "Homes & plots on record" },
  ];
}

/** The project the homepage features: the first with a curated image library. */
export function featuredProject(): Project | null {
  const projects = publishedProjects();
  return projects.find((p) => p.imagery && p.imagery.gallery.length > 2) ?? projects[0] ?? null;
}
