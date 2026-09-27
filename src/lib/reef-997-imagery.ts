/**
 * REEF 997 (Dubai Islands) web imagery.
 *
 * Same provenance rules as REEF 996 — see reef-996-imagery.ts for the full
 * account. In short: REEF 997 is off-plan, so every frame here is a developer
 * RENDER and says so. Frames carrying burned-in marketing text, the teal
 * origami brand motion-graphic, the "23°" marker, brand slates, or a model in
 * the foreground were rejected rather than cropped. Crops come from the top 85%
 * of each 9:16 source because the agency QR watermark sits in the bottom band.
 */
import type { ProjectCuratedImage, ProjectImageRatio } from "./project-types";

const DIR = "/images/reef-997";

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

export const POOL_DECK = img(
  "hero",
  "reef-997-pool-deck",
  ["16x9", "3x2", "1x1"],
  "Aerial render of the REEF 997 pool deck, loungers and cabanas set along a curved pool beside the tower.",
  "Pool deck, REEF 997 — developer render",
);

export const POOL_SUNSET = img(
  "hero",
  "reef-997-pool-sunset",
  ["16x9", "3x2", "4x5"],
  "Render of the REEF 997 pool at sunset, palms silhouetted against the sky.",
  "Pool at sunset — developer render",
);

export const FACADE_SIGNAGE = img(
  "architecture",
  "reef-997-facade-signage",
  ["4x5", "3x2", "1x1"],
  "Close render of the REEF 997 facade, curved balcony edges rising past the building's crown signage.",
  "Facade, REEF 997 — developer render",
);

export const GARDEN_TERRACE = img(
  "amenities",
  "reef-997-garden-terrace",
  ["16x9", "3x2", "4x5"],
  "Render of a planted garden terrace at REEF 997 with a long table and hanging seat.",
  "Garden terrace — developer render",
);

export const POOL_AERIAL = img(
  "amenities",
  "reef-997-pool-aerial",
  ["3x2", "1x1"],
  "Overhead render of a pool at REEF 997, its timber deck edged by planting.",
  "Pool, from above — developer render",
);

export const WALL_DETAIL = img(
  "interiors",
  "reef-997-wall-detail",
  ["1x1", "4x5"],
  "Close render of a sculptural rippled wall panel catching low interior light.",
  "Interior detail — developer render",
);

export const BEDROOM = img(
  "interiors",
  "reef-997-bedroom",
  ["4x5", "3x2", "1x1"],
  "Interior render of a REEF 997 bedroom in pale tones with a glazed wall beyond.",
  "Bedroom — developer render",
);

export const REEF_997_IMAGERY = {
  hero: POOL_DECK,
  gallery: [POOL_SUNSET, FACADE_SIGNAGE, GARDEN_TERRACE, POOL_AERIAL, BEDROOM, WALL_DETAIL],
  cards: [POOL_SUNSET, FACADE_SIGNAGE, GARDEN_TERRACE],
  details: [WALL_DETAIL, POOL_AERIAL],
  /* No night frame in the usable set, so the banner role reuses the sunset
     pool rather than inventing a dark one. */
  banners: [POOL_SUNSET],
} as const;
