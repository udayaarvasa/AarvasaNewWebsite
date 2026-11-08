/** Developer project pages checked 8 November 2026. This is a project-wide
 * specification, separate from the dated, unit-level sales inventory. */
export type ReefReference = {
  number: number;
  slug: string;
  location: string;
  residences: number;
  completion: string;
  summary: string;
  configurations: { label: string; sqft: string }[];
  amenities: string[];
  modelNote: string;
};

export const REEF_REFERENCES: readonly ReefReference[] = [
  {
    number: 996, slug: "reef-996-dubai-production-city", location: "Dubai Production City",
    residences: 505, completion: "Q3 2028",
    summary: "A residential tower with outdoor-cooled garden lounges, sunken balconies and landscaped spaces for recreation and wellness.",
    configurations: [{ label: "Studio", sqft: "400–473" }, { label: "1 bedroom", sqft: "691–852" }, { label: "2 bedrooms", sqft: "1,036–1,274" }, { label: "3 bedrooms", sqft: "1,369–1,932" }],
    amenities: ["Outdoor-cooled garden lounges", "Infinity swimming pool", "Kids pool", "BBQ area", "Pilates studio", "Basketball court", "Crossfit area", "Baja shelf"],
    modelNote: "20 residential levels over ground and three podium levels, following the developer's building configuration. The facade uses S-curve balcony bays. Plan dimensions, storey heights and hidden elevations are approximate.",
  },
  {
    number: 997, slug: "reef-997-dubai-islands", location: "Dubai Islands",
    residences: 63, completion: "Q1 2028",
    summary: "A coastal residential development with apartments, duplexes and a signature penthouse, arranged around landscaped outdoor amenities.",
    configurations: [{ label: "1 bedroom", sqft: "776–1,062" }, { label: "2 bedrooms", sqft: "1,220–2,187" }, { label: "3 bedroom duplex", sqft: "2,492–2,550" }, { label: "4 bedroom penthouse", sqft: "6,022" }],
    amenities: ["Infinity swimming pool", "Outdoor-cooled cinema", "Hammock forest", "Outdoor-cooled kids area", "Gym", "Yoga area", "BBQ area", "Vegetable garden"],
    modelNote: "Ground, two podium levels and eight residential levels follow the brochure. Rounded wings, recessed connectors and the pool deck follow developer renders. Wing depths and unseen facades remain approximate.",
  },
  {
    number: 998, slug: "reef-998-dlrc", location: "Dubai Land Residence Complex",
    residences: 323, completion: "Q2 2028",
    summary: "A residential and retail development with outdoor-cooled sunken balconies, a retail mall and a podium devoted to leisure and wellness.",
    configurations: [{ label: "Studio", sqft: "412–478" }, { label: "1 bedroom", sqft: "623–798" }, { label: "2 bedrooms", sqft: "1,002–1,011" }, { label: "3 bedrooms", sqft: "1,397" }],
    amenities: ["Sunken seated area", "Infinity swimming pool", "Kids play area", "Outdoor gym", "Aqua bikes"],
    modelNote: "The existing v3 reconstruction: 20 residential levels, three podium levels, separate balcony pods and a chamfered slab form. Derived from renders and floor plans; absolute dimensions and unseen details are approximate.",
  },
  {
    number: 999, slug: "reef-999-al-furjan", location: "Al Furjan",
    residences: 142, completion: "Q2 2027",
    summary: "Apartments and sky villas above a retail podium, with outdoor-cooled winter gardens and sunken balconies as the defining features.",
    configurations: [{ label: "1 bedroom", sqft: "792–917" }, { label: "2 bedrooms", sqft: "1,338–1,876" }, { label: "3 bedrooms", sqft: "2,022–2,636" }, { label: "4 bedroom sky villa", sqft: "3,424–3,695" }],
    amenities: ["Winter gardens", "Kids pool", "Tennis and padel court", "Outdoor cinema", "Shaded seating", "Kids play area", "Yoga area", "Vegetable garden"],
    modelNote: "New reconstruction of offset wings, projecting scalloped balconies, tall winter-garden openings, rooftop pergolas and a louvred retail podium. Level counts, dimensions and rear elevations are estimates from perspective renders.",
  },
  {
    number: 1000, slug: "reef-1000-dlrc", location: "Dubai Land Residence Complex",
    residences: 125, completion: "Q4 2026",
    summary: "A mid-rise residential and retail project offering studios, apartments and duplexes, with outdoor-cooled sunken balconies and courtyard amenities.",
    configurations: [{ label: "Studio", sqft: "437–488" }, { label: "1 bedroom", sqft: "752–1,066" }, { label: "2 bedrooms", sqft: "1,152–1,370" }, { label: "2 bedroom duplex", sqft: "1,653–1,905" }],
    amenities: ["Vegetable garden", "Running track", "Cricket pitch", "Outdoor gym", "Baja shelf", "BBQ area", "Sunken seated area"],
    modelNote: "A U-shaped mid-rise with six balcony levels and a screened top level, a courtyard pool and a canopy roof. Level count is interpreted from developer imagery; dimensions and unseen details are approximate.",
  },
];

export const reefReference = (slug: string) => REEF_REFERENCES.find((p) => p.slug === slug);
export const reefSourceUrl = (number: number) => `https://reefdevelopments.ae/projects/reef-${number}`;
