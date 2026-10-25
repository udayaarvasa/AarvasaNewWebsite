// @ts-ignore
import { prisma } from "@/lib/prisma";
import { isPubliclyVisible, publicListingWhere } from "@/lib/listing-visibility";
import { listingEditData, newListingData } from "@/lib/listing-moderation";
import type { PropertyFilters, CreatePropertyInput, UpdatePropertyInput } from "@/lib/validations/property";
import {
  PRIVILEGED_OWNER_SELECT,
  PUBLIC_PROPERTY_SELECT,
  toPublicProperty,
} from "./property-projection";

/* Public vs privileged shapes live in ./property-projection, which is free of
   Prisma so the security contract can be asserted without a database. */

const PROPERTY_SELECT = {
  id: true,
  title: true,
  description: true,
  price: true,
  location: true,
  city: true,
  state: true,
  country: true,
  propertyType: true,
  bedrooms: true,
  bathrooms: true,
  area: true,
  roi: true,
  amenities: true,
  images: true,
  featured: true,
  verified: true,
  status: true,
  riskLevel: true,
  aiScore: true,
  blockchainTxHash: true,
  tokenized: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: PRIVILEGED_OWNER_SELECT },
  _count: { select: { favorites: true, inquiries: true } },
};

// ─── Get paginated properties with filters ─────────────────────────────────

export async function getProperties(filters: PropertyFilters, userId?: string) {
  const {
    city, propertyType, minPrice, maxPrice, bedrooms,
    minRoi, verified, featured,
    search, sortBy = "newest", page = 1, limit = 12,
  } = filters;

  // The public catalogue: active, non-hidden listings only. A `status` filter
  // from the query string is deliberately ignored here — it let anyone list
  // inactive listings. Admins use /api/admin/properties.
  const where: any = { ...publicListingWhere() };

  if (city) where.city = { contains: city, mode: "insensitive" };
  if (propertyType) where.propertyType = propertyType;
  if (minPrice !== undefined || maxPrice !== undefined)
    where.price = { ...(minPrice ? { gte: minPrice } : {}), ...(maxPrice ? { lte: maxPrice } : {}) };
  if (bedrooms !== undefined) where.bedrooms = { gte: bedrooms };
  if (minRoi !== undefined) where.roi = { gte: minRoi };
  if (verified !== undefined) where.verified = verified;
  if (featured !== undefined) where.featured = featured;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy: any =
    sortBy === "price_asc" ? { price: "asc" }
    : sortBy === "price_desc" ? { price: "desc" }
    : sortBy === "roi_desc" ? { roi: "desc" }
    : sortBy === "featured" ? { featured: "desc" }
    : { createdAt: "desc" };

  const skip = (Number(page) - 1) * Number(limit);

  const [total, rawProperties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({ where, select: PUBLIC_PROPERTY_SELECT, orderBy, skip, take: Number(limit) }),
  ]);

  // Attach isFavorited if user is logged in
  let favoritedIds = new Set<string>();
  if (userId) {
    const favs = await prisma.favorite.findMany({
      where: { userId, propertyId: { in: rawProperties.map((p: any) => p.id) } },
      select: { propertyId: true },
    });
    favoritedIds = new Set(favs.map((f: any) => f.propertyId));
  }

  const properties = rawProperties.map((p: any) =>
    toPublicProperty({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      isFavorited: favoritedIds.has(p.id),
    }),
  );

  return {
    properties,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    hasMore: skip + Number(limit) < total,
  };
}

// ─── Get single property by ID ──────────────────────────────────────────────

/**
 * A single property.
 *
 * Authorization, not concealment: the full record — owner contact, internal
 * scoring, ledger reference — is returned only to the account that owns the
 * listing or to an admin. Everyone else, including anonymous callers, gets the
 * public projection. The caller's identity is established server-side from the
 * session; it is never taken from the request body or a query parameter.
 */
export async function getPropertyById(
  id: string,
  userId?: string,
  viewerRole?: string,
) {
  // Who owns it decides which projection the caller may see, so read that first.
  const ownership = await prisma.property.findUnique({
    where: { id },
    select: { ownerId: true, status: true },
  });
  if (!ownership) return null;

  const privileged =
    viewerRole === "ADMIN" || (!!userId && ownership.ownerId === userId);
  // Inactive and hidden listings exist only for their owner and admins.
  if (!privileged && !isPubliclyVisible({ id, status: ownership.status })) return null;

  const property = await prisma.property.findUnique({
    where: { id },
    select: privileged ? PROPERTY_SELECT : PUBLIC_PROPERTY_SELECT,
  });

  if (!property) return null;

  let isFavorited = false;
  if (userId) {
    const fav = await prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId: id } },
    });
    isFavorited = !!fav;
  }

  const shaped = {
    ...property,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    isFavorited,
  };
  return privileged ? shaped : toPublicProperty(shaped);
}

// ─── Create property ────────────────────────────────────────────────────────

/** A new listing waits for an admin: PENDING, unverified, unfeatured (see listing-moderation). */
export async function createProperty(data: CreatePropertyInput, ownerId: string) {
  const property = await prisma.property.create({
    data: newListingData(data, ownerId),
    select: PROPERTY_SELECT,
  });
  return {
    ...property,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
  };
}

// ─── Update property ────────────────────────────────────────────────────────

export async function updateProperty(id: string, data: UpdatePropertyInput, requesterId: string, requesterRole: string) {
  const existing = await prisma.property.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing) return { error: "Property not found", status: 404 };
  if (existing.ownerId !== requesterId && requesterRole !== "ADMIN")
    return { error: "Forbidden", status: 403 };

  // An owner's edit goes back to review; an admin's keeps the listing's standing.
  const property = await prisma.property.update({
    where: { id },
    data: listingEditData(data, requesterRole),
    select: PROPERTY_SELECT,
  });
  return {
    data: {
      ...property,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    },
  };
}

// ─── Delete property ────────────────────────────────────────────────────────

export async function deleteProperty(id: string, requesterId: string, requesterRole: string) {
  const existing = await prisma.property.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing) return { error: "Property not found", status: 404 };
  if (existing.ownerId !== requesterId && requesterRole !== "ADMIN")
    return { error: "Forbidden", status: 403 };

  await prisma.property.delete({ where: { id } });
  return { data: { deleted: true } };
}

// ─── Get user's own properties ──────────────────────────────────────────────

export async function getUserProperties(ownerId: string) {
  const properties = await prisma.property.findMany({
    where: { ownerId },
    select: PROPERTY_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return properties.map((p: any) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

// ─── Toggle favorite ────────────────────────────────────────────────────────

/** Returns null when the listing is not publicly visible: a pending, inactive or
 *  hidden listing cannot be saved. Removing an existing save is always allowed. */
export async function toggleFavorite(userId: string, propertyId: string) {
  const existing = await prisma.favorite.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { isFavorited: false };
  }
  const listing = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, status: true } });
  if (!listing || !isPubliclyVisible(listing)) return null;
  await prisma.favorite.create({ data: { userId, propertyId } });
  return { isFavorited: true };
}

// ─── Get user favorites ─────────────────────────────────────────────────────

/**
 * Saved listings, in the public projection: a saved listing is someone else's,
 * so its owner's email, id and internal scoring are not the saver's to read.
 * Listings no longer public (pending, inactive, hidden) drop out; the save
 * itself is kept and reappears if the listing is approved again.
 */
export async function getUserFavorites(userId: string) {
  const favs = await prisma.favorite.findMany({
    where: { userId, property: publicListingWhere() },
    include: { property: { select: PUBLIC_PROPERTY_SELECT } },
    orderBy: { createdAt: "desc" },
  });
  return favs.map((f: any) =>
    toPublicProperty({
      ...f.property,
      createdAt: f.property.createdAt.toISOString(),
      updatedAt: f.property.updatedAt.toISOString(),
      isFavorited: true,
    }),
  );
}

// ─── Create inquiry ─────────────────────────────────────────────────────────

/** Returns null when the listing is not publicly visible: no inquiry may be
 *  sent about a hidden, inactive or non-existent listing. */
export async function createInquiry(data: { name: string; email: string; phone?: string; message: string; propertyId: string; userId?: string }) {
  const listing = await prisma.property.findUnique({ where: { id: data.propertyId }, select: { id: true, status: true } });
  if (!listing || !isPubliclyVisible(listing)) return null;
  return prisma.inquiry.create({ data });
}

// ─── Seed data helper ───────────────────────────────────────────────────────

export async function getPropertyStats(ownerId: string) {
  const [total, active, favorites] = await Promise.all([
    prisma.property.count({ where: { ownerId } }),
    prisma.property.count({ where: { ownerId, status: "ACTIVE" } }),
    prisma.favorite.count({ where: { property: { ownerId } } }),
  ]);
  return { total, active, favorites };
}
