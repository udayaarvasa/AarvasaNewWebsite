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
};
