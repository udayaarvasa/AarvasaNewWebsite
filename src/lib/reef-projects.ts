// GENERATED from the Reef inventory dated 28 June 2026 and the "Four Whys" brochure.
// Figures are derived from the source documents — do not hand-edit; regenerate instead.
//
// Prices are AED, the currency Reef contracts in. Each figure is the lowest of the
// three published payment plans (see `planLabels`). `availableUnits` reflects the
// inventory sheet, not the total project size.

export type ReefUnitType = {
  type: string;
  label: string;
  bedrooms: number;
  available: number;
  minSqft: number;
  maxSqft: number;
  fromAed: number;
  toAed: number;
};

export type ReefPaymentPlan = {
  name: string;
  downPayment: string;
  duringConstruction: string;
  final: string;
  note: string | null;
};

export type ReefProject = {
  slug: string;
  name: string;
  developer: string;
  location: string;
  city: string;
  country: string;
  currency: "AED";
  completion: string;
  totalUnits: number | null;
  buildingConfig: string | null;
  availableUnits: number;
  fromAed: number;
  toAed: number;
  minSqft: number;
  maxSqft: number;
  unitTypes: ReefUnitType[];
  views: string[];
  images: string[];
  planLabels: string[];
  paymentPlans: ReefPaymentPlan[];
  nearby: { place: string; minutes: number }[];
  usps: string[];
};

export const reefProjects: ReefProject[] = [
  {
    "slug": "reef-996-dubai-production-city",
    "name": "REEF 996",
    "developer": "REEF Luxury Developments",
    "location": "Dubai Production City (IMPZ)",
    "city": "Dubai",
    "country": "UAE",
    "currency": "AED",
    "completion": "Q3 2028",
    "totalUnits": 505,
    "buildingConfig": "1B + G + 3P + 20",
    "availableUnits": 64,
    "fromAed": 679467,
    "toAed": 2923848,
    "minSqft": 452,
    "maxSqft": 1901,
    "unitTypes": [
      {
        "type": "STUDIO",
        "label": "Studio",
        "bedrooms": 0,
        "available": 34,
        "minSqft": 452,
        "maxSqft": 469,
        "fromAed": 679467,
        "toAed": 827038
      },
      {
        "type": "1BHK",
        "label": "1 Bedroom",
        "bedrooms": 1,
        "available": 14,
        "minSqft": 693,
        "maxSqft": 884,
        "fromAed": 1015988,
        "toAed": 1443402
      },
      {
        "type": "2BHK",
        "label": "2 Bedroom",
        "bedrooms": 2,
        "available": 11,
        "minSqft": 1045,
        "maxSqft": 1246,
        "fromAed": 1427438,
        "toAed": 1847916
      },
      {
        "type": "3BHK",
        "label": "3 Bedroom",
        "bedrooms": 3,
        "available": 5,
        "minSqft": 1423,
        "maxSqft": 1901,
        "fromAed": 1882178,
        "toAed": 2923848
      }
    ],
    "views": [
      "Amenities",
      "Community",
      "Golf Course",
      "Marina Skyline",
      "Marina Skyline & Golf Course"
    ],
    "images": [
      "/reef/reef-996-balconies.jpg",
      "/reef/reef-996-tower.jpg"
    ],
    "planLabels": [
      "50% Down Payment",
      "50/50 On Handover",
      "50/50 Post-Handover"
    ],
    "paymentPlans": [
      {
        "name": "5.5-Year Extended Plan",
        "downPayment": "20%",
        "duringConstruction": "50%",
        "final": "30% post-handover",
        "note": "1% per month post-handover"
      },
      {
        "name": "3-Year Easy Plan",
        "downPayment": "20%",
        "duringConstruction": "50%",
        "final": "30% on handover",
        "note": null
      }
    ],
    "nearby": [
      {
        "place": "Dubai Marina",
        "minutes": 10
      },
      {
        "place": "Dubai Miracle Garden",
        "minutes": 10
      },
      {
        "place": "Jumeirah Beach Residence",
        "minutes": 10
      },
      {
        "place": "Mall of the Emirates",
        "minutes": 10
      },
      {
        "place": "Palm Jumeirah",
        "minutes": 15
      },
      {
        "place": "Global Village",
        "minutes": 15
      },
      {
        "place": "Al Maktoum Intl Airport (DWC)",
        "minutes": 15
      },
      {
        "place": "Burj Khalifa",
        "minutes": 20
      },
      {
        "place": "Dubai Mall",
        "minutes": 20
      },
      {
        "place": "Dubai Intl Airport (DXB)",
        "minutes": 25
      }
    ],
    "usps": [
      "Globally patented outdoor-cooled sunken balconies",
      "100% usable space — no wasted area",
      "Tax-free ownership with no property or capital gains tax",
      "RERA-regulated escrow protection on off-plan purchase"
    ]
  },
  {
    "slug": "reef-997-dubai-islands",
    "name": "REEF 997",
    "developer": "REEF Luxury Developments",
    "location": "Dubai Islands",
    "city": "Dubai",
    "country": "UAE",
    "currency": "AED",
    "completion": "March 2028",
    "totalUnits": null,
    "buildingConfig": null,
    "availableUnits": 8,
    "fromAed": 2699042,
    "toAed": 7178682,
    "minSqft": 1061,
    "maxSqft": 2536,
    "unitTypes": [
      {
        "type": "1BHK",
        "label": "1 Bedroom",
        "bedrooms": 1,
        "available": 1,
        "minSqft": 1061,
        "maxSqft": 1061,
        "fromAed": 2699042,
        "toAed": 2965980
      },
      {
        "type": "2BHK",
        "label": "2 Bedroom",
        "bedrooms": 2,
        "available": 6,
        "minSqft": 1220,
        "maxSqft": 2187,
        "fromAed": 2938753,
        "toAed": 5573768
      },
      {
        "type": "3BHK",
        "label": "3 Bedroom",
        "bedrooms": 3,
        "available": 1,
        "minSqft": 2536,
        "maxSqft": 2536,
        "fromAed": 6532601,
        "toAed": 7178682
      }
    ],
    "views": [
      "Park",
      "Pool"
    ],
    "images": [],
    "planLabels": [
      "50% Down Payment",
      "50/50 On Handover",
      "50/50 Post-Handover"
    ],
    "paymentPlans": [],
    "nearby": [],
    "usps": [
      "Globally patented outdoor-cooled sunken balconies",
      "100% usable space — no wasted area",
      "Tax-free ownership with no property or capital gains tax",
      "RERA-regulated escrow protection on off-plan purchase"
    ]
  },
  {
    "slug": "reef-998-dlrc",
    "name": "REEF 998",
    "developer": "REEF Luxury Developments",
    "location": "Dubai Land Residence Complex (DLRC)",
    "city": "Dubai",
    "country": "UAE",
    "currency": "AED",
    "completion": "June 2028",
    "totalUnits": null,
    "buildingConfig": null,
    "availableUnits": 18,
    "fromAed": 742070,
    "toAed": 2048804,
    "minSqft": 477,
    "maxSqft": 1397,
    "unitTypes": [
      {
        "type": "STUDIO",
        "label": "Studio",
        "bedrooms": 0,
        "available": 11,
        "minSqft": 477,
        "maxSqft": 478,
        "fromAed": 742070,
        "toAed": 875549
      },
      {
        "type": "1BHK",
        "label": "1 Bedroom",
        "bedrooms": 1,
        "available": 4,
        "minSqft": 645,
        "maxSqft": 672,
        "fromAed": 977379,
        "toAed": 1125680
      },
      {
        "type": "2BHK",
        "label": "2 Bedroom",
        "bedrooms": 2,
        "available": 2,
        "minSqft": 1002,
        "maxSqft": 1002,
        "fromAed": 1353192,
        "toAed": 1596594
      },
      {
        "type": "3BHK",
        "label": "3 Bedroom",
        "bedrooms": 3,
        "available": 1,
        "minSqft": 1397,
        "maxSqft": 1397,
        "fromAed": 1864411,
        "toAed": 2048804
      }
    ],
    "views": [
      "Park",
      "Pool & Skyline"
    ],
    "images": [],
    "planLabels": [
      "50% Down Payment",
      "60/40 On Handover",
      "70/30 Post-Handover"
    ],
    "paymentPlans": [],
    "nearby": [],
    "usps": [
      "Globally patented outdoor-cooled sunken balconies",
      "100% usable space — no wasted area",
      "Tax-free ownership with no property or capital gains tax",
      "RERA-regulated escrow protection on off-plan purchase"
    ]
  }
];

export const getReefProject = (slug: string): ReefProject | undefined =>
  reefProjects.find((p) => p.slug === slug);
