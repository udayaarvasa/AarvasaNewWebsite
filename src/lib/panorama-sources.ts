/**
 * Genuine 360° sources known for each REEF building, and whether Aarvasa may
 * publish them. The register the tour framework consults before any panorama
 * scene can be ingested for a project page.
 *
 * Every source here is a developer-produced, computer-generated panorama set
 * hosted on REEF's channel-partner portal. None is a photograph, and none may be
 * shown — hosted, embedded or linked — until the developer's written permission
 * is recorded in `permissionRef` (request: docs/reef-developer-request.md).
 * Ordinary marketing films are NOT 360° and never appear here; they belong to
 * the film catalogue in immersive-tours.ts.
 *
 * Counts and chapter coverage were re-verified on 20 October 2026 from each
 * tour's public definition (docs/reef-portfolio.md, "Immersive media catalogue").
 */

export type PanoramaRights = "UNCONFIRMED" | "GRANTED" | "REFUSED";

/** The chapters a property tour is organised into. */
export const PANORAMA_CHAPTERS = [
  "EXTERIOR",
  "LOBBY",
  "RESIDENCE",
  "BALCONY",
  "AMENITIES",
  "ROOFTOP",
  "RETAIL",
] as const;
export type PanoramaChapter = (typeof PANORAMA_CHAPTERS)[number];

export type PanoramaSource = {
  readonly projectSlug: string;
  readonly tourUrl: string;
  /** Panorama objects in the tour definition; null where the tour is split per scene. */
  readonly panoramas: number | null;
  readonly kind: "CG_RENDER";
  /** Chapters the source covers, from its scene labels. Unlabelled views are not counted. */
  readonly chapters: readonly PanoramaChapter[];
  readonly rights: PanoramaRights;
  /** Where the written permission is filed (e.g. an email reference). Required for GRANTED. */
  readonly permissionRef: string | null;
  readonly verifiedOn: string;
};

export const PANORAMA_SOURCES: readonly PanoramaSource[] = [
  {
    projectSlug: "reef-996-dubai-production-city",
    tourUrl: "https://reefchannelpartners.com/vr/996/",
    panoramas: 67,
    kind: "CG_RENDER",
    chapters: ["LOBBY", "RESIDENCE"],
    rights: "UNCONFIRMED",
    permissionRef: null,
    verifiedOn: "2026-10-20",
  },
  {
    projectSlug: "reef-997-dubai-islands",
    tourUrl: "https://reefchannelpartners.com/vr/997/",
    panoramas: 108,
    kind: "CG_RENDER",
    chapters: ["LOBBY", "RESIDENCE", "BALCONY", "AMENITIES"],
    rights: "UNCONFIRMED",
    permissionRef: null,
    verifiedOn: "2026-10-20",
  },
  {
    projectSlug: "reef-998-dlrc",
    tourUrl: "https://reefchannelpartners.com/vr/998/",
    panoramas: 140,
    kind: "CG_RENDER",
    chapters: ["LOBBY", "RESIDENCE", "BALCONY", "AMENITIES"],
    rights: "UNCONFIRMED",
    permissionRef: null,
    verifiedOn: "2026-10-20",
  },
  {
    projectSlug: "reef-1000-dlrc",
    tourUrl: "https://reefchannelpartners.com/vr/vr1000/",
    panoramas: null,
    kind: "CG_RENDER",
    chapters: ["LOBBY", "RESIDENCE", "AMENITIES", "ROOFTOP", "RETAIL"],
    rights: "UNCONFIRMED",
    permissionRef: null,
    verifiedOn: "2026-10-20",
  },
  // REEF 999: no 360° source found (vr/999 returns 404).
];

/** Sources Aarvasa may publish: permission granted AND its record filed. */
export const publishablePanoramaSources = (
  sources: readonly PanoramaSource[] = PANORAMA_SOURCES,
): PanoramaSource[] => sources.filter((s) => s.rights === "GRANTED" && !!s.permissionRef);

/** Chapters a property's tour still lacks any 360° source for. */
export const missingChapters = (projectSlug: string): PanoramaChapter[] => {
  const covered = new Set(
    PANORAMA_SOURCES.filter((s) => s.projectSlug === projectSlug).flatMap((s) => s.chapters),
  );
  return PANORAMA_CHAPTERS.filter((c) => !covered.has(c));
};
