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

export function platformFigures() {
  const projects = publishedProjects();
  return [
    { value: projects.length, label: "Projects listed" },
    { value: new Set(projects.map((p) => p.city)).size, label: "Cities" },
    { value: new Set(projects.map((p) => p.developer)).size, label: "Developers" },
    { value: projects.reduce((sum, p) => sum + (p.totalUnits ?? 0), 0), label: "Homes & plots on record" },
  ];
}

/** The project the homepage features: the first with a curated image library. */
export function featuredProject(): Project | null {
  const projects = publishedProjects();
  return projects.find((p) => p.imagery && p.imagery.gallery.length > 2) ?? projects[0] ?? null;
}
