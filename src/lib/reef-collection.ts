import { projects } from "./projects";
import type { Project } from "./project-types";

/**
 * The REEF family, as a collection.
 *
 * REEF Luxury Developments numbers its towers sequentially, and the supplied
 * media covers five of them. Only some have a project record: 996, 997 and 998
 * are sourced from the inventory sheet and are listed. 999 and 1000 exist in
 * the developer's own material — launch films and dated construction updates —
 * but no location, price, configuration or completion date has been supplied
 * for either.
 *
 * They are named here anyway, because the family is genuinely five buildings
 * and pretending otherwise misrepresents it just as much as inventing figures
 * would. What is NOT done is fill the gap: an entry with no record carries no
 * specification, no price, no imagery and no link, and says plainly that
 * nothing is published yet.
 */
export type ReefEntry = {
  readonly number: string;
  readonly name: string;
  /** Present only when a sourced project record exists. */
  readonly project: Project | null;
  /** What the developer's own material shows, where there is no record. */
  readonly mediaNote: string | null;
};

const bySlug = (slug: string): Project | null =>
  projects.find((p) => p.slug === slug && p.published) ?? null;

export function reefCollection(): ReefEntry[] {
  return [
    {
      number: "996",
      name: "REEF 996",
      project: bySlug("reef-996-dubai-production-city"),
      mediaNote: null,
    },
    {
      number: "997",
      name: "REEF 997",
      project: bySlug("reef-997-dubai-islands"),
      mediaNote: null,
    },
    {
      number: "998",
      name: "REEF 998",
      project: bySlug("reef-998-dlrc"),
      mediaNote: null,
    },
    {
      number: "999",
      name: "REEF 999",
      project: null,
      mediaNote: "Launch film and construction updates through August 2026.",
    },
    {
      number: "1000",
      name: "REEF 1000",
      project: null,
      mediaNote: "Launch film and construction updates through June 2026.",
    },
  ];
}

/** Entries with a listed project record. */
export const listedReef = (): ReefEntry[] =>
  reefCollection().filter((e) => e.project !== null);
