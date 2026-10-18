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
 * The headline figures. The first three are the business's stated reach,
 * supplied by Aarvasa (18 Oct 2026) and set here deliberately — they must be
 * kept true to the partnerships actually in place before they are published.
 * The last is counted from the listed project records.
 */
export const STATED_FIGURES = {
  projects: 10,
  countries: 2,
  developers: 20,
} as const;

export function platformFigures(): { value: number; suffix: string; label: string }[] {
  const projects = publishedProjects();
  return [
    { value: STATED_FIGURES.projects, suffix: "+", label: "Projects listed" },
    { value: STATED_FIGURES.countries, suffix: "+", label: "Countries" },
    { value: STATED_FIGURES.developers, suffix: "+", label: "Developers" },
    { value: projects.reduce((sum, p) => sum + (p.totalUnits ?? 0), 0), suffix: "", label: "Homes & plots on record" },
  ];
}

/** The project the homepage features: the first with a curated image library. */
export function featuredProject(): Project | null {
  const projects = publishedProjects();
  return projects.find((p) => p.imagery && p.imagery.gallery.length > 2) ?? projects[0] ?? null;
}
