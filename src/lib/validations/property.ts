import { z } from "zod";

export const PropertyTypeEnum = z.enum([
  "APARTMENT", "VILLA", "OFFICE", "LAND", "STUDIO", "PENTHOUSE", "PLOT", "COMMERCIAL",
]);

export const RiskLevelEnum = z.enum(["LOW", "MODERATE", "BALANCED", "HIGH"]);
export const PropertyStatusEnum = z.enum(["ACTIVE", "INACTIVE", "SOLD", "RENTED", "PENDING"]);

export const createPropertySchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(150),
  description: z.string().min(20, "Description must be at least 20 characters").max(2000),
  price: z.number().positive("Price must be positive").max(1_000_000_000),
  location: z.string().min(3, "Location is required").max(200),
  city: z.string().min(2, "City is required").max(100),
  state: z.string().min(2, "State is required").max(100),
  country: z.string().default("India"),
  propertyType: PropertyTypeEnum,
  bedrooms: z.number().int().min(0).max(50).default(0),
  bathrooms: z.number().int().min(0).max(50).default(0),
  area: z.number().positive("Area must be positive").max(1_000_000),
  roi: z.number().min(0).max(100).default(0),
  amenities: z.array(z.string()).default([]),
  images: z.array(z.string().url()).default([]),
  featured: z.boolean().default(false),
  riskLevel: RiskLevelEnum.default("MODERATE"),
});

export const updatePropertySchema = createPropertySchema.partial().extend({
  status: PropertyStatusEnum.optional(),
  verified: z.boolean().optional(),
});

export const propertyFiltersSchema = z.object({
  city: z.string().optional(),
  propertyType: PropertyTypeEnum.optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  bedrooms: z.coerce.number().int().optional(),
  minRoi: z.coerce.number().optional(),
  verified: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  status: PropertyStatusEnum.optional(),
  search: z.string().optional(),
  sortBy: z.enum(["price_asc", "price_desc", "roi_desc", "newest", "featured"]).default("newest"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export const inquirySchema = z.object({
  name: z.string().min(2, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  message: z.string().min(10, "Message must be at least 10 characters").max(1000),
  propertyId: z.string().min(1),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyFilters = z.infer<typeof propertyFiltersSchema>;
export type InquiryInput = z.infer<typeof inquirySchema>;
