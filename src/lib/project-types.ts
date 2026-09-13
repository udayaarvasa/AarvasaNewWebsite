import type { CurrencyCode } from "./currency";

/** One purchasable configuration — an apartment layout, or a plot size. */
export type ProjectUnitType = {
  /** Machine key, e.g. "STUDIO" or "22X35". */
  type: string;
  /** Buyer-facing label, e.g. "Studio" or "22 × 35 ft". */
  label: string;
  bedrooms: number;
  /** Units currently released. null when the developer has not disclosed counts. */
  available: number | null;
  minSqft: number;
  maxSqft: number;
  fromPrice: number;
  toPrice: number;
};

export type ProjectPaymentPlan = {
  name: string;
  downPayment: string;
  duringConstruction: string;
  final: string;
  note: string | null;
};

/**
 * An immersive asset for a project, in the shape the media pipeline's manifest
 * publishes (`npm run media:process`, Phase 2B-2). It holds object keys only,
 * never URLs: where keys are served from is environment configuration, resolved
 * in src/lib/viewer/project-media.ts.
 */
export type ProjectImmersiveMedia = {
  mediaId: string;
  kind: "MODEL";
  format: "GLB";
  /** Immutable version directory, m/{mediaId}/{keyHash}. */
  storageKey: string;
  /** Entry file inside storageKey, e.g. "scene.glb". */
  entryFile: string;
  /** SHA-256 of the entry file. */
  contentHash: string;
  sizeBytes: number;
  poster: { key: string; width: number; height: number } | null;
  processingVersion: string;
  /** What the model shows, for screen readers. */
  altText: string;
  /**
   * "placeholder": a pipeline test asset that does not depict the project, only
   * ever shown outside production builds. "approved": reviewed real media.
   */
  review: "placeholder" | "approved";
};

export type Project = {
  slug: string;
  name: string;
  developer: string;
  location: string;
  city: string;
  country: string;
  currency: CurrencyCode;
  /** Drives which detail sections render. */
  kind: "apartments" | "plots";
  /** Handover or possession. null for ready/undisclosed. */
  completion: string | null;
  totalUnits: number | null;
  buildingConfig: string | null;
  availableUnits: number | null;
  fromPrice: number;
  toPrice: number;
  minSqft: number;
  maxSqft: number;
  /** Headline rate, e.g. 3500 for plots sold per sq.ft. null when priced per unit. */
  ratePerSqft: number | null;
  /** Extra pricing detail where a single rate understates it (tiered plot rates). */
  rateNote: string | null;
  /**
   * Whether the project is live on the site. Explicit rather than inferred from
   * imagery: a project can be worth publishing on its facts alone, with a
   * typographic panel standing in for a photo it does not yet have.
   */
  published: boolean;
  unitTypes: ProjectUnitType[];
  views: string[];
  images: string[];
  /** Layout/site plan — rendered separately from photography so the two are never conflated. */
  planImages: string[];
  planLabels: string[];
  paymentPlans: ProjectPaymentPlan[];
  nearby: { place: string; minutes: number | null }[];
  usps: string[];
  /** Regulatory approvals, e.g. "T&CP Approved Layout". */
  approvals: string[];
  contact: string[];
  coordinates: { lat: number; lng: number } | null;
  /** Optional interactive 3D media. Absent for most projects. */
  immersive?: ProjectImmersiveMedia;
};
