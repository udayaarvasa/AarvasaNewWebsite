// ─── Property Types ────────────────────────────────────────────────────────────

export type PropertyType = "APARTMENT" | "VILLA" | "OFFICE" | "LAND" | "STUDIO" | "PENTHOUSE" | "PLOT" | "COMMERCIAL";
export type PropertyStatus = "ACTIVE" | "INACTIVE" | "SOLD" | "RENTED" | "PENDING";
export type RiskLevel = "LOW" | "MODERATE" | "BALANCED" | "HIGH";
export type Role = "USER" | "AGENT" | "BUILDER" | "ADMIN";

export interface PropertyOwner {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
}

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
  riskLevel: RiskLevel;
  aiScore: number | null;
  blockchainTxHash: string | null;
  tokenized: boolean;
  ownerId: string;
  owner: PropertyOwner;
  _count?: { favorites: number; inquiries: number };
  isFavorited?: boolean;
  createdAt: string;
  updatedAt: string;
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
