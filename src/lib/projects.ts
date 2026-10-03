import {
  projectImageSrc,
  type Project,
  type ProjectImagery,
  type ProjectImmersiveMedia,
  type ProjectPanoramaTour,
  type ProjectSplatMedia,
} from "./project-types";
import { reefProjects } from "./reef-projects";
import { REEF_997_IMAGERY } from "./reef-997-imagery";
import { REEF_998_IMAGERY } from "./reef-998-imagery";
import {
  REEF_996_BANNERS,
  REEF_996_CARDS,
  REEF_996_DETAILS,
  REEF_996_GALLERY,
  REEF_996_HERO,
} from "./reef-996-imagery";

/**
 * Aaradhyam developments, Bhopal.
 *
 * Sourced from the developer's own brochures plus pricing confirmed by Aarvasa.
 * Two cautions recorded here because they caused a real mix-up:
 *
 *  - Pearl is at Badwai (NH-12, Karond bypass, north Bhopal). Prime is at
 *    Jatkhedi (Hoshangabad Road, south Bhopal). They are NOT the same site.
 *  - The Pearl brochure's photographs are stock imagery of North American
 *    housing, not the Badwai site. They are deliberately not used. `images`
 *    holds photography of the actual development only; `planImages` holds
 *    layout drawings. A project with neither stays unpublished.
 */

// Shared across both Aaradhyam layouts. Road surfacing differs per project, so
// each one states its own rather than duplicating a generic line.
const PLOT_USPS = [
  "Gated colony with boundary wall and 24×7 security",
  "Lab-tested drinking water supply",
  "Landscaped gardens and open play area",
];

const aaradhyamPearl: Project = {
  slug: "aaradhyam-pearl-badwai-bhopal",
  name: "Aaradhyam Pearl",
  developer: "Aaradhyam",
  location: "Badwai Road, NH-12, Karond Bypass, Village Badwai",
  city: "Bhopal",
  country: "India",
  currency: "INR",
  kind: "plots",
  completion: null,
  totalUnits: 65,
  buildingConfig: null,
  availableUnits: null,
  // 22×35 ft at ₹3,500/sq.ft — the entry configuration.
  fromPrice: 770 * 3500,
  toPrice: 880 * 3500,
  minSqft: 770,
  maxSqft: 880,
  ratePerSqft: 3500,
  rateNote: null,
  published: true,
  unitTypes: [
    {
      type: "22X35",
      label: "22 × 35 ft plot",
      bedrooms: 0,
      available: null,
      minSqft: 770,
      maxSqft: 770,
      fromPrice: 770 * 3500,
      toPrice: 770 * 3500,
    },
    {
      type: "22X40",
      label: "22 × 40 ft plot",
      bedrooms: 0,
      available: null,
      minSqft: 880,
      maxSqft: 880,
      fromPrice: 880 * 3500,
      toPrice: 880 * 3500,
    },
  ],
  views: [],
  images: [],
  planImages: ["/aaradhyam/pearl-layout-plan.jpg"],
  planLabels: [],
  paymentPlans: [],
  nearby: [],
  usps: [
    ...PLOT_USPS,
    "9 m wide roads with street lighting",
    "½ inch water supply line to every plot",
    "Dedicated commercial shop plots within the colony",
  ],
  approvals: [
    "Town & Country Planning Department approved layout",
    "Nagar Nigam Bhopal approved colony",
  ],
  contact: [],
  coordinates: null,
};

const aaradhyamPrime: Project = {
  slug: "aaradhyam-prime-jatkhedi-bhopal",
  name: "Aaradhyam Prime",
  developer: "Aaradhyam",
  location: "Beside Stellar High International School, Gram Jatkhedi, Hoshangabad Road",
  city: "Bhopal",
  country: "India",
  currency: "INR",
  kind: "plots",
  completion: null,
  totalUnits: 37,
  buildingConfig: null,
  availableUnits: null,
  // Plot dimensions for Prime are not legible in the material supplied, so no
  // absolute price is published — only the per-sq.ft rate the developer quoted.
  fromPrice: 0,
  toPrice: 0,
  minSqft: 0,
  maxSqft: 0,
  ratePerSqft: 5200,
  rateNote:
    "Plots 1–11 are ₹5,500/sq.ft and plots 12–21 are ₹5,200/sq.ft. Plots 28–37 are allocated under the LIG and EWS schemes.",
  published: true,
  unitTypes: [],
  views: [],
  images: [],
  planImages: [],
  planLabels: [],
  paymentPlans: [],
  nearby: [
    { place: "Ashima Mall", minutes: null },
    { place: "Barkatullah University (BU Bhopal)", minutes: null },
    { place: "Rani Kamlapati Railway Station", minutes: null },
    { place: "Sayaji Hotel", minutes: null },
  ],
  usps: [
    ...PLOT_USPS,
    "9 m wide RCC roads with street lighting",
    "Residential and commercial plots within one layout",
  ],
  approvals: ["Approved by Government Department"],
  contact: ["7000734091", "8871326431"],
  coordinates: { lat: 23.17633, lng: 77.4694 },
};

/**
 * Phase 3 immersive-media pilot. Copied from the pipeline manifest produced by
 * `npm run media:pilot:stage` (keys are content-addressed, so re-running it gives
 * the same values). The model is a placeholder that exercises the pipeline and
 * viewer; it is not a model of REEF 996 and is never shown in production builds.
 */
const REEF_996_PILOT_MEDIA: ProjectImmersiveMedia = {
  mediaId: "8ba87bf969112016e7905b6f",
  kind: "MODEL",
  format: "GLB",
  storageKey: "m/8ba87bf969112016e7905b6f/de1d54d4e9da0d02",
  entryFile: "scene.glb",
  contentHash: "370418ddb037b189a64f4c1f761398b8fcf9974ca9028b9ab188bb3a37ba7ef2",
  sizeBytes: 1840,
  poster: { key: "m/8ba87bf969112016e7905b6f/de1d54d4e9da0d02/poster.webp", width: 1280, height: 720 },
  processingVersion: "1.0.0/passthrough-v1",
  altText: "Placeholder massing model: a single tower on a podium slab. Not a model of REEF 996.",
  review: "placeholder",
  // Phase 8 pilot. The placeholder GLB is authored in metres (glTF's own convention) and
  // shown life size; a real massing model would use a previewScale such as 1/50.
  xr: { modes: ["ar", "vr"], scale: { metersPerUnit: 1, previewScale: 1 } },
};

/**
 * Development pilot for the 360° tour pipeline (Phase 6). Every scene is a
 * generated test grid (src/lib/viewer/panorama-fixtures.ts), not a photograph of
 * REEF 996, and the tour is a "placeholder", so production builds never show it.
 * To use real rooms, replace each image with { source: "published", mediaAssetId }
 * once that panorama is PUBLISHED, and set review to "approved".
 */
const REEF_996_PILOT_TOUR: ProjectPanoramaTour = {
  label: "Pilot 360° tour for REEF 996",
  review: "placeholder",
  startSceneId: "room-a",
  scenes: [
    {
      id: "room-a",
      title: "Test room A",
      floor: "Test level 1",
      image: { source: "fixture", fixture: "test-room-a" },
      alt: "Placeholder 360° test grid labelled Test room A, with compass headings. Not a photo of REEF 996.",
      initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 },
      hotspots: [
        { id: "to-room-b", label: "Go to Test room B", yawDeg: 90, pitchDeg: -10, type: "navigation", targetSceneId: "room-b" },
        { id: "to-room-c", label: "Go to Test room C", yawDeg: -90, pitchDeg: -10, type: "navigation", targetSceneId: "room-c" },
        {
          id: "about-grid",
          label: "About this test image",
          yawDeg: 0,
          pitchDeg: 20,
          type: "info",
          description: "A generated grid used to check panorama orientation: yaw 0 is the image centre and each line is 30° apart.",
        },
      ],
    },
    {
      id: "room-b",
      title: "Test room B",
      floor: "Test level 1",
      image: { source: "fixture", fixture: "test-room-b" },
      alt: "Placeholder 360° test grid labelled Test room B. Not a photo of REEF 996.",
      initialView: { yawDeg: -90, pitchDeg: 0, fovDeg: 75 },
      hotspots: [{ id: "to-room-a", label: "Back to Test room A", yawDeg: -90, pitchDeg: -10, type: "navigation", targetSceneId: "room-a" }],
    },
    {
      id: "room-c",
      title: "Test room C",
      floor: "Test level 2",
      image: { source: "fixture", fixture: "test-room-c" },
      alt: "Placeholder 360° test grid labelled Test room C. Not a photo of REEF 996.",
      initialView: { yawDeg: 90, pitchDeg: 0, fovDeg: 75 },
      hotspots: [
        { id: "to-room-a", label: "Back to Test room A", yawDeg: 90, pitchDeg: -10, type: "navigation", targetSceneId: "room-a" },
        { id: "to-room-b", label: "Go to Test room B", yawDeg: 180, pitchDeg: -10, type: "navigation", targetSceneId: "room-b" },
      ],
    },
  ],
};

const TOUR_BY_SLUG: Readonly<Record<string, ProjectPanoramaTour>> = {
  "reef-996-dubai-production-city": REEF_996_PILOT_TOUR,
};

/**
 * Development pilot for Gaussian splat rendering (Phase 7): the generated test
 * scene (src/lib/viewer/splat-fixtures.ts), not a scan of REEF 996. As a
 * "placeholder" it never reaches production builds. For a real scan, use
 * { source: "published", mediaAssetId } once that SOG is PUBLISHED, and set
 * review to "approved".
 */
const REEF_996_PILOT_SPLAT: ProjectSplatMedia = {
  label: "Pilot 3D scan for REEF 996",
  review: "placeholder",
  scene: { source: "fixture", fixture: "test-scene" },
  alt: "Placeholder Gaussian splat test scene: a grey disc, an orange tower outline and red, green and blue axis markers. Not a scan of REEF 996.",
  initialView: { yawDeg: 35, pitchDeg: 20, distanceFactor: 1.6 },
};

const SPLAT_BY_SLUG: Readonly<Record<string, ProjectSplatMedia>> = {
  "reef-996-dubai-production-city": REEF_996_PILOT_SPLAT,
};

// reef-projects.ts is generated, so immersive media is attached here instead.
const IMMERSIVE_BY_SLUG: Readonly<Record<string, ProjectImmersiveMedia>> = {
  "reef-996-dubai-production-city": REEF_996_PILOT_MEDIA,
};

/**
 * Curated imagery, attached here for the same reason as the media above:
 * reef-projects.ts is generated and must not be hand-edited.
 *
 * REEF 996 is off-plan, so this library is mostly developer renders and each
 * frame records that. `images` is replaced rather than appended to, because the
 * two frames the generated record carries are superseded by properly reviewed
 * crops of the same subjects.
 */
const REEF_996_IMAGERY: ProjectImagery = {
  hero: REEF_996_HERO,
  gallery: REEF_996_GALLERY,
  cards: REEF_996_CARDS,
  details: REEF_996_DETAILS,
  banners: REEF_996_BANNERS,
};

const IMAGERY_BY_SLUG: Readonly<Record<string, ProjectImagery>> = {
  "reef-996-dubai-production-city": REEF_996_IMAGERY,
  "reef-997-dubai-islands": REEF_997_IMAGERY,
  "reef-998-dlrc": REEF_998_IMAGERY,
};

/**
 * Publication decided here, not in the generated inventory.
 *
 * reef-projects.ts is generated from the 28 June 2026 inventory sheet, which
 * carried `published: false` for 997 and 998. Both hold complete, sourced
 * records — location, completion, unit types and AED price ranges — and now
 * have reviewed imagery, and the product owner confirmed this inventory is
 * being marketed, so they are live. Whether a project is advertised is a
 * commercial decision: it is recorded here rather than by editing the
 * generated file, which would be overwritten on the next regeneration.
 */
/**
 * Coordinates for the REEF towers, reconciled rather than taken on trust.
 *
 * These arrived as third-party candidates, so each was reverse-geocoded against
 * OpenStreetMap and checked against the locality the project record already
 * states. All three land in the right community:
 *
 *   996  25.03785, 55.20126  ->  "مدينة دبي للإنتاج" (Dubai Production City),
 *                                Me'aisem 1. Record says Dubai Production City
 *                                (IMPZ). IMPZ is this zone's former name. Match.
 *   997  25.28990, 55.30238  ->  "جزر دبي" (Dubai Islands), Palm Deira. Record
 *                                says Dubai Islands, which is what Deira
 *                                Islands was renamed to. Match.
 *   998  25.10029, 55.37471  ->  "وادي الصفا 5" (Wadi Al Safa 5). Record says
 *                                Dubai Land Residence Complex, which sits inside
 *                                Wadi Al Safa 5. Consistent, one level coarser:
 *                                the geocoder named the community, not DLRC.
 *
 * So each is `locality` precision, not `plot`. That is enough to show a buyer
 * the neighbourhood — which is all Explore Area claims to do — and deliberately
 * not enough to place a building model on the ground, because a tower dropped on
 * a locality-accurate point lands on whatever is actually there. Overlaying the
 * reconstructed model on the map stays off until a surveyed position exists.
 *
 * Replace these with the developer's own filed position when it is available,
 * and set the precision to "plot" at the same time.
 */
const REEF_COORDINATES: Readonly<
  Record<string, { lat: number; lng: number; precision: "locality"; source: string }>
> = {
  "reef-996-dubai-production-city": {
    lat: 25.03785,
    lng: 55.20126,
    precision: "locality",
    source: "Third-party candidate, reconciled to Dubai Production City (IMPZ) by OpenStreetMap reverse geocode, 4 October 2026",
  },
  "reef-997-dubai-islands": {
    lat: 25.2899,
    lng: 55.30238,
    precision: "locality",
    source: "Third-party candidate, reconciled to Dubai Islands (Palm Deira) by OpenStreetMap reverse geocode, 4 October 2026",
  },
  "reef-998-dlrc": {
    lat: 25.10029,
    lng: 55.37471,
    precision: "locality",
    source: "Third-party candidate, reconciled to Wadi Al Safa 5, which contains DLRC, by OpenStreetMap reverse geocode, 4 October 2026",
  },
};

const PUBLISH_OVERRIDE: Readonly<Record<string, boolean>> = {
  "reef-997-dubai-islands": true,
  "reef-998-dlrc": true,
};

/** Flat `images` stays populated so listing cards and any consumer that has not
 *  been taught about `imagery` keep working. Order matches the gallery. */
const flatImages = (imagery: ProjectImagery): string[] => [
  projectImageSrc(imagery.hero, "3x2"),
  ...imagery.gallery.map((i) => projectImageSrc(i, "3x2")),
];

/**
 * Pilot media is engineering material, and a project page is not where it goes.
 *
 * The three pilots above — a placeholder massing model, a tour of generated test
 * grids, a splat of coloured axis markers — exist to exercise the pipeline and
 * the viewer. None of them depicts the building whose page they were attached
 * to, and a visitor reading "Explore in 3D" on REEF 996 has no reason to expect
 * a test asset behind it, however the control is captioned. Labelling was not
 * enough: the control itself is the claim.
 *
 * They are still reachable, at /labs/viewer, which generates no params in
 * production and is linked from nowhere. A project page shows immersive media
 * only once a real asset has been published for it and a reviewer has stated
 * what it is.
 */
const attachIfApproved = <T extends { review: "placeholder" | "approved" }>(
  map: Readonly<Record<string, T>>,
  slug: string,
): T | null => (map[slug]?.review === "approved" ? map[slug] : null);

export const projects: Project[] = [
  ...reefProjects,
  aaradhyamPearl,
  aaradhyamPrime,
].map((p) => ({
  ...p,
  ...(attachIfApproved(IMMERSIVE_BY_SLUG, p.slug) ? { immersive: IMMERSIVE_BY_SLUG[p.slug] } : {}),
  ...(attachIfApproved(TOUR_BY_SLUG, p.slug) ? { tour: TOUR_BY_SLUG[p.slug] } : {}),
  ...(attachIfApproved(SPLAT_BY_SLUG, p.slug) ? { splat: SPLAT_BY_SLUG[p.slug] } : {}),
  ...(IMAGERY_BY_SLUG[p.slug]
    ? { imagery: IMAGERY_BY_SLUG[p.slug], images: flatImages(IMAGERY_BY_SLUG[p.slug]) }
    : {}),
  ...(p.slug in PUBLISH_OVERRIDE ? { published: PUBLISH_OVERRIDE[p.slug] } : {}),
  ...(REEF_COORDINATES[p.slug]
    ? {
        coordinates: { lat: REEF_COORDINATES[p.slug].lat, lng: REEF_COORDINATES[p.slug].lng },
        coordinatesPrecision: REEF_COORDINATES[p.slug].precision,
        coordinatesSource: REEF_COORDINATES[p.slug].source,
      }
    : {}),
}));

/** Live on the site. Set per project rather than inferred from imagery. */
export const isPublished = (p: Project): boolean => p.published;

export const publishedProjects = (): Project[] => projects.filter(isPublished);

export const getProject = (slug: string): Project | undefined =>
  projects.find((p) => p.slug === slug);
