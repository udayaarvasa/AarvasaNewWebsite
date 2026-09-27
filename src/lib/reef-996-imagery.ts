/**
 * REEF 996 web imagery, curated from the developer's own film assets.
 *
 * PROVENANCE — read before adding anything here.
 *
 * REEF 996 is off-plan. With one exception, every frame below is an
 * architectural RENDER, not a photograph of a finished building, and each one
 * says so through `origin`. The UI is required to surface that: a render must
 * never be presented as a photograph. This mirrors the rule already recorded in
 * projects.ts for the Aaradhyam Pearl brochure imagery.
 *
 * The exception is the `show-apartment` set (origin: "photo"), taken from a
 * walkthrough of the built show apartment in Dubai. It is genuine photography,
 * but it is a SALES SHOW APARTMENT — a furnished demonstration unit, not a
 * delivered residence — and the captions say so.
 *
 * Frames the source material offered but that are deliberately NOT here:
 *   - anything carrying burned-in marketing text. The films caption themselves
 *     with claims ("THE WORLD'S FIRST BUILDING", "REEF's globally patented",
 *     "the world's first outdoor-cooled Garden Lounges"). Baking those into
 *     Aarvasa's own imagery would republish them as Aarvasa's assertions.
 *   - an establishing shot of the Burj Khalifa above cloud, which is not REEF
 *     996 and does not belong in its gallery.
 *   - brand slates, motion-graphic diagrams, and frames led by models or
 *     children rather than by architecture.
 *
 * Every crop is taken from the top 85% of its 9:16 source because the supplied
 * films carry a scannable third-party QR watermark in the bottom band. All four
 * target ratios fit inside that region at full source width, so excluding it
 * costs no architectural subject. If you add a frame, re-check that band.
 */

import type {
  ProjectCuratedImage,
  ProjectImageOrigin,
  ProjectImageRatio,
} from "./project-types";

/** How the image was produced. Always stated, never inferred from the subject. */
export type ImageOrigin = ProjectImageOrigin;

export type ImageRatio = ProjectImageRatio;

export type CuratedImage = ProjectCuratedImage;

const DIR = "/images/reef-996";

/** `group` names the folder; `dir` is derived so call sites never build paths. */
const img = (i: Omit<CuratedImage, "dir"> & { group: string }): CuratedImage => {
  const { group, ...rest } = i;
  return { ...rest, dir: `${DIR}/${group}` };
};

/* ── Exteriors and massing ─────────────────────────────────────────────── */

export const TOWER_AERIAL = img({
  id: "reef-996-tower-aerial",
  group: "hero",
  ratios: ["16x9", "4x5", "3x2", "1x1"],
  origin: "render",
  alt: "Aerial render of the REEF 996 tower, its balcony bands curving across the elevation, set among low-rise blocks and planting.",
  caption: "REEF 996, Dubai Production City — developer render",
});

export const BALCONIES_STACKED = img({
  id: "reef-996-balconies-stacked",
  group: "hero",
  ratios: ["16x9", "4x5", "3x2", "1x1"],
  origin: "render",
  alt: "Render looking down the face of REEF 996, showing the stacked, wave-edged balconies with planting on each level.",
  caption: "Stacked balcony bands — developer render",
});

export const TOWER_ELEVATION_DAY = img({
  id: "reef-996-tower-elevation-day",
  group: "architecture",
  ratios: ["4x5", "3x2", "1x1"],
  origin: "render",
  alt: "Daylight render of the full REEF 996 elevation against open sky, the balcony edges reading as horizontal bands.",
  caption: "Full elevation, daylight — developer render",
});

export const FACADE_DETAIL = img({
  id: "reef-996-facade-detail",
  group: "architecture",
  ratios: ["4x5", "3x2", "1x1"],
  origin: "render",
  alt: "Close render of the REEF 996 facade, the repeating balcony profile and the building's crown signage.",
  caption: "Facade, close — developer render",
});

/* ── Dark-stage banner frames ──────────────────────────────────────────── */

export const TOWER_CROWN_NIGHT = img({
  id: "reef-996-tower-crown-night",
  group: "banners",
  ratios: ["16x9", "4x5", "3x2"],
  origin: "render",
  alt: "Night render of REEF 996 with the illuminated crown above lit balconies and water below.",
  caption: "The crown at night — developer render",
});

export const TOWER_FACADE_NIGHT = img({
  id: "reef-996-tower-facade-night",
  group: "banners",
  ratios: ["16x9", "4x5", "3x2"],
  origin: "render",
  alt: "Night render of the REEF 996 facade, warm interior light showing through the balcony line.",
  caption: "Facade at night — developer render",
});

/* ── Amenity decks and the sunken balcony ──────────────────────────────── */

export const POOL_CABANAS = img({
  id: "reef-996-pool-cabanas",
  group: "amenities",
  ratios: ["16x9", "3x2", "1x1"],
  origin: "render",
  alt: "Render of the pool deck at REEF 996, curtained cabanas set along the water's edge.",
  caption: "Pool deck and cabanas — developer render",
});

export const SUNKEN_BALCONIES = img({
  id: "reef-996-sunken-balconies",
  group: "amenities",
  ratios: ["16x9", "4x5", "3x2", "1x1"],
  origin: "render",
  alt: "Render of the sunken balconies at REEF 996, each recessed terrace furnished and planted.",
  caption: "Sunken balconies — developer render",
});

export const SUNKEN_BALCONY_SUNSET = img({
  id: "reef-996-sunken-balcony-sunset",
  group: "amenities",
  ratios: ["16x9", "4x5", "3x2"],
  origin: "render",
  alt: "Render of a sunken balcony at sunset, seating along a glazed edge with the skyline beyond.",
  caption: "Sunken balcony at sunset — developer render",
});

/* ── Interior renders ──────────────────────────────────────────────────── */

export const BEDROOM = img({
  id: "reef-996-bedroom",
  group: "interiors",
  ratios: ["4x5", "3x2", "1x1"],
  origin: "render",
  alt: "Interior render of a REEF 996 bedroom, daylight from a full-height window falling across the bed.",
  caption: "Bedroom — developer render",
});

export const LIVING_DINING = img({
  id: "reef-996-living-dining",
  group: "interiors",
  ratios: ["3x2", "4x5", "1x1"],
  origin: "render",
  alt: "Interior render of a REEF 996 living and dining space in pale finishes.",
  caption: "Living and dining — developer render",
});

export const MARBLE_DETAIL = img({
  id: "reef-996-marble-detail",
  group: "interiors",
  ratios: ["1x1", "4x5"],
  origin: "render",
  alt: "Close render of a veined marble table surface catching low light.",
  caption: "Surface detail — developer render",
});

export const SHOWER_DETAIL = img({
  id: "reef-996-shower-detail",
  group: "interiors",
  ratios: ["1x1", "4x5"],
  origin: "render",
  alt: "Render of a REEF 996 bathroom, rain shower behind a glazed screen.",
  caption: "Bathroom — developer render",
});

/* ── Show apartment — the only genuine photography in the set ──────────── */

const showApartment = (id: string, ratios: readonly ImageRatio[], alt: string, caption: string) =>
  img({ id, group: "gallery", ratios, origin: "photo", alt, caption });

export const SHOWAPT_LIVING_DINING = showApartment(
  "showapt-living-dining",
  ["3x2", "4x5", "1x1"],
  "Photograph of the REEF show apartment: a dining table in the foreground with the living area and window beyond.",
  "Show apartment, Dubai — photograph of a furnished demonstration unit",
);

export const SHOWAPT_DINING_KITCHEN = showApartment(
  "showapt-dining-kitchen",
  ["3x2", "4x5"],
  "Photograph of the REEF show apartment: dining table set against the open kitchen run.",
  "Show apartment, Dubai — photograph of a furnished demonstration unit",
);

export const SHOWAPT_KITCHEN = showApartment(
  "showapt-kitchen",
  ["3x2", "1x1"],
  "Photograph of the REEF show apartment kitchen: handleless units under a lit worktop.",
  "Show apartment, Dubai — photograph of a furnished demonstration unit",
);

export const SHOWAPT_LIVING = showApartment(
  "showapt-living",
  ["3x2", "4x5"],
  "Photograph of the REEF show apartment living area, seating arranged on a pale rug.",
  "Show apartment, Dubai — photograph of a furnished demonstration unit",
);

export const SHOWAPT_TERRACE = showApartment(
  "showapt-terrace",
  ["16x9", "3x2", "4x5"],
  "Photograph of the REEF show apartment terrace: a sunken bench on a timber deck enclosed by planting.",
  "Show apartment terrace, Dubai — photograph of a furnished demonstration unit",
);

export const SHOWAPT_BEDROOM = showApartment(
  "showapt-bedroom",
  ["3x2", "4x5", "1x1"],
  "Photograph of the REEF show apartment bedroom, a mirror and dressing surface beside the bed.",
  "Show apartment, Dubai — photograph of a furnished demonstration unit",
);

/* ── Roles ────────────────────────────────────────────────────────────────
 * Grouped by the job each image does on the site, so no route has to reach for
 * whatever happens to be first in a flat list and every surface gets a
 * different frame. Order within a role is the order it is used.
 */

/** Leads the REEF 996 project page. */
export const REEF_996_HERO = TOWER_AERIAL;

/** The project page gallery: architecture first, then amenity, then interior. */
export const REEF_996_GALLERY: readonly CuratedImage[] = [
  BALCONIES_STACKED,
  SUNKEN_BALCONIES,
  TOWER_ELEVATION_DAY,
  SUNKEN_BALCONY_SUNSET,
  POOL_CABANAS,
  FACADE_DETAIL,
  SHOWAPT_LIVING_DINING,
  SHOWAPT_TERRACE,
  SHOWAPT_BEDROOM,
  SHOWAPT_KITCHEN,
  BEDROOM,
  LIVING_DINING,
];

/** Square and portrait frames for card grids and small rails. */
export const REEF_996_CARDS: readonly CuratedImage[] = [
  SUNKEN_BALCONIES,
  POOL_CABANAS,
  TOWER_ELEVATION_DAY,
  SHOWAPT_LIVING_DINING,
  BEDROOM,
  FACADE_DETAIL,
];

/** Tight crops for texture and material moments. */
export const REEF_996_DETAILS: readonly CuratedImage[] = [
  MARBLE_DETAIL,
  SHOWER_DETAIL,
  FACADE_DETAIL,
  SHOWAPT_KITCHEN,
];

/** Night frames, for dark-stage bands only. */
export const REEF_996_BANNERS: readonly CuratedImage[] = [
  TOWER_CROWN_NIGHT,
  TOWER_FACADE_NIGHT,
];

// Explicit extension so this module also loads under plain node for tests;
// the bundler resolves it identically.
export { projectImageSrc as imageSrc } from "./project-types.ts";
