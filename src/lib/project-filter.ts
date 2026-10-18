import { AED_TO_INR } from "./currency.ts";
import type { Project } from "./project-types.ts";

/**
 * The listings filters, applied to the developer projects.
 *
 * The filter rail drives the database listings through /api/properties; the
 * developer projects come from curated records, and used to obey only the
 * city filter — so searching "bhopal" or choosing "Plot" left every project
 * on screen. This applies the same query to them.
 */
export type ProjectQuery = Partial<
  Record<"search" | "city" | "propertyType" | "minPrice" | "maxPrice" | "bedrooms", string>
>;

const PLOT_TYPES = new Set(["PLOT", "LAND"]);
const HOME_TYPES = new Set(["APARTMENT", "STUDIO", "PENTHOUSE", "VILLA"]);

/** A project's entry price in rupees, so it compares with the rail's INR bounds. */
function entryInr(p: Project): number | null {
  const price = p.fromPrice > 0 ? p.fromPrice : p.ratePerSqft && p.minSqft ? p.ratePerSqft * p.minSqft : 0;
  if (!price) return null;
  return p.currency === "AED" ? price * AED_TO_INR : price;
}

export function matchesProjectQuery(p: Project, q: ProjectQuery): boolean {
  const haystack = [p.name, p.city, p.location, p.developer, p.country].join(" ").toLowerCase();

  const search = q.search?.trim().toLowerCase();
  if (search) {
    const words = search.split(/\s+/).filter((w) => w.length > 1);
    if (words.length > 0 && !words.every((w) => haystack.includes(w))) return false;
  }

  const city = q.city?.trim().toLowerCase();
  if (city && p.city.toLowerCase() !== city) return false;

  const type = q.propertyType?.trim().toUpperCase();
  if (type) {
    if (PLOT_TYPES.has(type) && p.kind !== "plots") return false;
    if (HOME_TYPES.has(type) && p.kind !== "apartments") return false;
    if (!PLOT_TYPES.has(type) && !HOME_TYPES.has(type)) return false; // offices, commercial: none listed
  }

  const min = Number(q.minPrice);
  const max = Number(q.maxPrice);
  if ((min > 0 || max > 0)) {
    const inr = entryInr(p);
    if (inr === null) return false;
    if (min > 0 && inr < min) return false;
    if (max > 0 && inr > max) return false;
  }

  const beds = Number(q.bedrooms);
  if (beds > 0 && !p.unitTypes.some((u) => u.bedrooms >= beds)) return false;

  return true;
}
