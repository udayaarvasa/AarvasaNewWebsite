import { projects } from "./projects";
import type { Project } from "./project-types";

/**
 * The REEF family, as a collection.
 *
 * REEF Luxury Developments numbers its towers sequentially, and the supplied
 * media covers five of them, and all five now have a project record: 996, 997
 * and 998 from the inventory sheet, and 999 and 1000 from the developer's own
 * project pages (src/lib/reef-portfolio-additions.ts), which publish location,
 * residence sizes and completion but — for 1000 — no price.
 *
 * An entry without a published record would carry no specification, price,
 * imagery or link and say plainly that nothing is published yet; mediaNote
 * remains for that case.
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
      project: bySlug("reef-999-al-furjan"),
      mediaNote: null,
    },
    {
      number: "1000",
      name: "REEF 1000",
      project: bySlug("reef-1000-dlrc"),
      mediaNote: null,
    },
  ];
}

/** Entries with a listed project record. */
export const listedReef = (): ReefEntry[] =>
  reefCollection().filter((e) => e.project !== null);
