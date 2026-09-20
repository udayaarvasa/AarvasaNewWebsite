import type { Project, ProjectImmersiveMedia, ProjectPanoramaTour, ProjectSplatMedia } from "./project-types";
import { reefProjects } from "./reef-projects";

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

export const projects: Project[] = [
  ...reefProjects,
  aaradhyamPearl,
  aaradhyamPrime,
].map((p) => ({
  ...p,
  ...(IMMERSIVE_BY_SLUG[p.slug] ? { immersive: IMMERSIVE_BY_SLUG[p.slug] } : {}),
  ...(TOUR_BY_SLUG[p.slug] ? { tour: TOUR_BY_SLUG[p.slug] } : {}),
  ...(SPLAT_BY_SLUG[p.slug] ? { splat: SPLAT_BY_SLUG[p.slug] } : {}),
}));

/** Live on the site. Set per project rather than inferred from imagery. */
export const isPublished = (p: Project): boolean => p.published;

export const publishedProjects = (): Project[] => projects.filter(isPublished);

export const getProject = (slug: string): Project | undefined =>
  projects.find((p) => p.slug === slug);
