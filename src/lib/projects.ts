import type { Project } from "./project-types";
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

const PLOT_USPS = [
  "Gated colony with boundary wall and 24×7 security",
  "9 m wide roads with street lighting",
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
    "9 m wide RCC roads",
    "Residential and commercial plots within one layout",
  ],
  approvals: ["Approved by Government Department"],
  contact: ["7000734091", "8871326431"],
  coordinates: { lat: 23.17633, lng: 77.4694 },
};

export const projects: Project[] = [
  ...reefProjects,
  aaradhyamPearl,
  aaradhyamPrime,
];

/** A project is publishable once it has any imagery — photography or a plan. */
export const isPublished = (p: Project): boolean =>
  p.images.length > 0 || p.planImages.length > 0;

export const publishedProjects = (): Project[] => projects.filter(isPublished);

export const getProject = (slug: string): Project | undefined =>
  projects.find((p) => p.slug === slug);
