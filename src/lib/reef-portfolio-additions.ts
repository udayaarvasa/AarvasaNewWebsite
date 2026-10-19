import type { Project } from "./project-types";

/**
 * REEF 999 and REEF 1000, hand-authored from the developer's own pages.
 *
 * reef-projects.ts is generated from the 28 June 2026 inventory sheet, which
 * does not cover these two, so they live here. Every figure is from
 * reefdevelopments.ae (accessed 20 October 2026) unless marked otherwise; the
 * full source register, with the conflicts noted below, is in
 * research/sources/reef-999-1000-register.md.
 *
 * What is deliberately NOT here:
 *  - Per-unit prices. The developer publishes none for either project, so unit
 *    rows carry 0 and render "On request". REEF 999 has a project-level
 *    starting price; REEF 1000 has none.
 *  - Floor counts. Secondary portals say "two 12-storey towers" (999) and
 *    "G+6" (1000); the developer states neither, so buildingConfig is null.
 *  - Imagery. Public access to the developer's renders is not a licence to
 *    republish them; both pages use the typographic panel until permission is
 *    recorded.
 *  - Instalment schedules. REEF 999 is advertised as "60% - 40%" without the
 *    milestones; REEF 1000's plan is not published by the developer.
 */

const REEF_CONTACT = ["+971 800 3 7333", "info@reefdevelopments.ae"];

export const reef999: Project = {
  slug: "reef-999-al-furjan",
  name: "REEF 999",
  developer: "REEF Luxury Developments",
  location: "Al Furjan",
  city: "Dubai",
  country: "UAE",
  currency: "AED",
  kind: "apartments",
  // Current developer project page. The launch release said Q1 2027; the site
  // now says Q2 2027, and the later official statement is used.
  completion: "Q2 2027",
  totalUnits: 142,
  buildingConfig: null,
  availableUnits: null,
  // "Starting price AED 1,158,334" — developer's REEF 999 page. Not attributed
  // to a unit type, because the developer does not say which.
  fromPrice: 1_158_334,
  toPrice: 0,
  minSqft: 792,
  maxSqft: 3_695,
  ratePerSqft: null,
  rateNote:
    "From AED 1,158,334, the developer's published starting price. The developer advertises a 60/40 payment plan; prices by residence type and the instalment schedule are confirmed on enquiry.",
  published: true,
  unitTypes: [
    { type: "1BHK", label: "1 Bedroom", bedrooms: 1, available: null, minSqft: 792, maxSqft: 917, fromPrice: 0, toPrice: 0 },
    { type: "2BHK", label: "2 Bedroom", bedrooms: 2, available: null, minSqft: 1_338, maxSqft: 1_876, fromPrice: 0, toPrice: 0 },
    { type: "3BHK", label: "3 Bedroom", bedrooms: 3, available: null, minSqft: 2_022, maxSqft: 2_636, fromPrice: 0, toPrice: 0 },
    { type: "SKYVILLA4BR", label: "4 Bedroom Sky Villa", bedrooms: 4, available: null, minSqft: 3_424, maxSqft: 3_695, fromPrice: 0, toPrice: 0 },
  ],
  views: [],
  images: [],
  planImages: [],
  planLabels: [],
  paymentPlans: [],
  nearby: [
    { place: "Al Furjan Metro Station", minutes: 5 },
    { place: "Arbor School", minutes: 5 },
    { place: "Medcare Clinic", minutes: 5 },
    { place: "Ibn Battuta Mall", minutes: 10 },
    { place: "Dubai Marina", minutes: 15 },
    { place: "Al Maktoum Intl Airport (DWC)", minutes: 15 },
  ],
  usps: [
    "Outdoor-cooled winter gardens — the developer describes REEF 999 as the first building to have them",
    "REEF's patented outdoor-cooled sunken balconies",
    "A dedicated retail mall within the development",
    "Tennis and padel courts, an outdoor cinema, a yoga area, a kids' pool and a vegetable garden",
  ],
  approvals: [],
  contact: REEF_CONTACT,
  coordinates: null,
};

export const reef1000: Project = {
  slug: "reef-1000-dlrc",
  name: "REEF 1000",
  developer: "REEF Luxury Developments",
  location: "Dubai Land Residence Complex (DLRC)",
  city: "Dubai",
  country: "UAE",
  currency: "AED",
  kind: "apartments",
  completion: "Q4 2026",
  totalUnits: 125,
  buildingConfig: null,
  availableUnits: null,
  // No price is published by the developer. Portals quote ~AED 620,000, which is
  // secondary and is not shown.
  fromPrice: 0,
  toPrice: 0,
  minSqft: 437,
  maxSqft: 1_905,
  ratePerSqft: null,
  rateNote: null,
  published: true,
  unitTypes: [
    { type: "STUDIO", label: "Studio", bedrooms: 0, available: null, minSqft: 437, maxSqft: 488, fromPrice: 0, toPrice: 0 },
    { type: "1BHK", label: "1 Bedroom", bedrooms: 1, available: null, minSqft: 752, maxSqft: 1_066, fromPrice: 0, toPrice: 0 },
    { type: "2BHK", label: "2 Bedroom", bedrooms: 2, available: null, minSqft: 1_152, maxSqft: 1_370, fromPrice: 0, toPrice: 0 },
    { type: "2BHKDUPLEX", label: "2 Bedroom Duplex", bedrooms: 2, available: null, minSqft: 1_653, maxSqft: 1_905, fromPrice: 0, toPrice: 0 },
  ],
  views: [],
  images: [],
  planImages: [],
  planLabels: [],
  paymentPlans: [],
  nearby: [
    { place: "Sheikh Mohammed Bin Zayed Road (E311)", minutes: null },
    { place: "Al Ain Road (E66)", minutes: null },
  ],
  usps: [
    "REEF's patented outdoor-cooled sunken balconies — the developer describes REEF 1000 as the first building to have them",
    "Residences over ground-floor retail",
    "A running track, cricket pitch, outdoor gym, Baja-shelf pool, BBQ area and vegetable garden",
  ],
  approvals: [],
  contact: REEF_CONTACT,
  coordinates: null,
};
