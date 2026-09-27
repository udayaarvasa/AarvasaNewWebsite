// ─── Property Types ────────────────────────────────────────────────────────────

export type PropertyType = "APARTMENT" | "VILLA" | "OFFICE" | "LAND" | "STUDIO" | "PENTHOUSE" | "PLOT" | "COMMERCIAL";
export type PropertyStatus = "ACTIVE" | "INACTIVE" | "SOLD" | "RENTED" | "PENDING";
export type RiskLevel = "LOW" | "MODERATE" | "BALANCED" | "HIGH";
export type Role = "USER" | "AGENT" | "BUILDER" | "ADMIN";

/**
 * Owner as returned by the PUBLIC catalogue endpoints.
 *
 * No id and no email: /api/properties is unauthenticated and paginated, so
 * anything here is harvestable at scale. Contact happens through the
 * authenticated inquiry flow. `role` is the coarsened listing capacity, not the
 * internal privilege level.
 */
export interface PropertyOwner {
  name: string | null;
  image: string | null;
  role: Role;
}

/** A property as returned by the PUBLIC catalogue endpoints. Internal scoring
 *  (riskLevel, aiScore), the ledger reference and ownerId are not part of this
 *  shape — no public surface renders them, and they were being served to
 *  anonymous callers. */
export interface PropertyListing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  city: string;
  state: string;
  country: string;
  propertyType: PropertyType;
  bedrooms: number;
  bathrooms: number;
  area: number;
  roi: number;
  amenities: string[];
  images: string[];
  featured: boolean;
  verified: boolean;
  status: PropertyStatus;
  tokenized: boolean;
  owner: PropertyOwner;
  _count?: { favorites: number; inquiries: number };
  isFavorited?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The full record, returned only to the account that owns the listing or to an
 * admin. Anything added here is privileged by definition — it must never be
 * folded back into PropertyListing, which is what anonymous callers receive.
 */
export interface OwnedPropertyListing extends PropertyListing {
  riskLevel: RiskLevel;
  aiScore: number | null;
  blockchainTxHash: string | null;
  ownerId: string;
  owner: PropertyOwner & { id: string; email: string | null };
}

export interface PropertyFilters {
  city?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minRoi?: number;
  verified?: boolean;
  featured?: boolean;
  status?: PropertyStatus;
  search?: string;
  sortBy?: "price_asc" | "price_desc" | "roi_desc" | "newest" | "featured";
  page?: number;
  limit?: number;
}

export interface PaginatedProperties {
  properties: PropertyListing[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface CreatePropertyInput {
  title: string;
  description: string;
  price: number;
  location: string;
  city: string;
  state: string;
  country?: string;
  propertyType: PropertyType;
  bedrooms?: number;
  bathrooms?: number;
  area: number;
  roi?: number;
  amenities?: string[];
  images?: string[];
  featured?: boolean;
  riskLevel?: RiskLevel;
}

export interface UpdatePropertyInput extends Partial<CreatePropertyInput> {
  status?: PropertyStatus;
  verified?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
