/**
 * REEF 998 (Dubai Land Residence Complex) web imagery.
 *
 * Provenance rules as REEF 996 — see reef-996-imagery.ts. REEF 998 is off-plan,
 * so every frame is a developer RENDER and says so. The source film is largely
 * a lifestyle narrative built around a model walking through retail interiors;
 * those frames were rejected in favour of the architecture-led ones. Crops come
 * from the top 85% of the 9:16 source to exclude the agency QR watermark.
 */
import type { ProjectCuratedImage, ProjectImageRatio } from "./project-types";

const DIR = "/images/reef-998";

const img = (
  group: string,
  id: string,
  ratios: readonly ProjectImageRatio[],
  alt: string,
  caption: string,
): ProjectCuratedImage => ({
  id,
  dir: `${DIR}/${group}`,
  ratios,
  alt,
  caption,
  origin: "render",
});

export const POOL_FACADE = img(
  "hero",
  "reef-998-pool-facade",
  ["16x9", "4x5", "3x2", "1x1"],
  "Render of REEF 998 at sunset: a long pool running beside the tower's stepped balcony facade.",
  "Pool and facade, REEF 998 — developer render",
);

export const GYM = img(
  "amenities",
  "reef-998-gym",
  ["3x2", "16x9", "1x1"],
  "Render of the REEF 998 gym, equipment arranged along a fully glazed wall.",
  "Gym — developer render",
);

export const GARDEN_TERRACE = img(
  "amenities",
  "reef-998-garden-terrace",
  ["16x9", "3x2", "4x5"],
  "Render of a planted terrace at REEF 998 with hanging seats beneath mature trees.",
  "Garden terrace — developer render",
);

export const REEF_998_IMAGERY = {
  hero: POOL_FACADE,
  gallery: [GARDEN_TERRACE, GYM],
  cards: [GARDEN_TERRACE, GYM],
  details: [GYM],
  banners: [POOL_FACADE],
} as const;
