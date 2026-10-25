import { z } from "zod";

export const PropertyTypeEnum = z.enum([
  "APARTMENT", "VILLA", "OFFICE", "LAND", "STUDIO", "PENTHOUSE", "PLOT", "COMMERCIAL",
]);

export const RiskLevelEnum = z.enum(["LOW", "MODERATE", "BALANCED", "HIGH"]);
export const PropertyStatusEnum = z.enum(["ACTIVE", "INACTIVE", "SOLD", "RENTED", "PENDING"]);

/**
 * What a lister may say about their own listing: its content, nothing about its
 * standing. `status`, `verified` and `featured` are moderation decisions and are
 * absent here on purpose; zod drops unknown keys, so a request that sends them
 * has them stripped before it reaches the database. The server sets them
 * (src/lib/listing-moderation.ts) and only an admin changes them afterwards
 * (adminListingReviewSchema, via /api/admin/properties/[id]).
 */
/** The listing's content fields, with no defaults (see updatePropertySchema). */
const listingFields = {
  title: z.string().min(5, "Title must be at least 5 characters").max(150),
  description: z.string().min(20, "Description must be at least 20 characters").max(2000),
  price: z.number().positive("Price must be positive").max(1_000_000_000),
  location: z.string().min(3, "Location is required").max(200),
  city: z.string().min(2, "City is required").max(100),
  state: z.string().min(2, "State is required").max(100),
  country: z.string(),
  propertyType: PropertyTypeEnum,
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  area: z.number().positive("Area must be positive").max(1_000_000),
  roi: z.number().min(0).max(100),
  amenities: z.array(z.string()),
  images: z.array(z.string().url()),
  riskLevel: RiskLevelEnum,
};

export const createPropertySchema = z.object({
  ...listingFields,
  country: listingFields.country.default("India"),
  bedrooms: listingFields.bedrooms.default(0),
  bathrooms: listingFields.bathrooms.default(0),
  roi: listingFields.roi.default(0),
  amenities: listingFields.amenities.default([]),
  images: listingFields.images.default([]),
  riskLevel: listingFields.riskLevel.default("MODERATE"),
});

/**
 * An owner's edit: content only, like creation, and only the fields sent.
 *
 * Built from the fields WITHOUT their defaults. In zod 4 a default still
 * applies inside .partial(), so createPropertySchema.partial() turned a
 * title-only edit into one that also reset images, amenities, bedrooms,
 * bathrooms, ROI, country and risk level — silently, for any client that did
 * not resend every field.
 */
export const updatePropertySchema = z.object(listingFields).partial();

/**
 * Status changes an owner may make themselves, each from specific states only
 * (see src/lib/listing-moderation.ts). Approval is never one of them.
 */
export const ownerListingActionSchema = z.object({
  action: z.enum(["withdraw", "mark_sold", "mark_rented", "resubmit"]),
});

/** An admin's review decision. At least one field, each validated. */
export const adminListingReviewSchema = z
  .object({
    status: PropertyStatusEnum.optional(),
    verified: z.boolean().optional(),
    featured: z.boolean().optional(),
  })
  .refine((d) => d.status !== undefined || d.verified !== undefined || d.featured !== undefined, {
    message: "Nothing to update",
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

export type CreatePropertyInput = z.input<typeof createPropertySchema>;
export type UpdatePropertyInput = z.input<typeof updatePropertySchema>;
export type OwnerListingAction = z.infer<typeof ownerListingActionSchema>["action"];
export type PropertyFilters = z.input<typeof propertyFiltersSchema>;
export type InquiryInput = z.input<typeof inquirySchema>;
