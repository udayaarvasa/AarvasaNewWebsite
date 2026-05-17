// @ts-ignore
import { prisma } from "@/lib/prisma";
import type { PropertyFilters, CreatePropertyInput, UpdatePropertyInput } from "@/lib/validations/property";

const OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
};

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
  owner: { select: OWNER_SELECT },
  _count: { select: { favorites: true, inquiries: true } },
};

// ─── Get paginated properties with filters ─────────────────────────────────

export async function getProperties(filters: PropertyFilters, userId?: string) {
  const {
    city, propertyType, minPrice, maxPrice, bedrooms,
    minRoi, verified, featured, status = "ACTIVE",
    search, sortBy = "newest", page = 1, limit = 12,
  } = filters;

  const where: any = { status };

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
    prisma.property.findMany({ where, select: PROPERTY_SELECT, orderBy, skip, take: Number(limit) }),
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

  const properties = rawProperties.map((p: any) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    isFavorited: favoritedIds.has(p.id),
  }));

  return {
    properties,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    hasMore: skip + Number(limit) < total,
  };
}

// ─── Get single property by ID ──────────────────────────────────────────────

export async function getPropertyById(id: string, userId?: string) {
  const property = await prisma.property.findUnique({
    where: { id },
    select: PROPERTY_SELECT,
  });

  if (!property) return null;

  let isFavorited = false;
  if (userId) {
    const fav = await prisma.favorite.findUnique({
      where: { userId_propertyId: { userId, propertyId: id } },
    });
    isFavorited = !!fav;
  }

  return {
    ...property,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    isFavorited,
  };
}

// ─── Create property ────────────────────────────────────────────────────────

export async function createProperty(data: CreatePropertyInput, ownerId: string) {
  const property = await prisma.property.create({
    data: { ...data, ownerId },
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

  const property = await prisma.property.update({
    where: { id },
    data,
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

export async function toggleFavorite(userId: string, propertyId: string) {
  const existing = await prisma.favorite.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { isFavorited: false };
  }
  await prisma.favorite.create({ data: { userId, propertyId } });
  return { isFavorited: true };
}

// ─── Get user favorites ─────────────────────────────────────────────────────

export async function getUserFavorites(userId: string) {
  const favs = await prisma.favorite.findMany({
    where: { userId },
    include: { property: { select: PROPERTY_SELECT } },
    orderBy: { createdAt: "desc" },
  });
  return favs.map((f: any) => ({
    ...f.property,
    createdAt: f.property.createdAt.toISOString(),
    updatedAt: f.property.updatedAt.toISOString(),
    isFavorited: true,
  }));
}

// ─── Create inquiry ─────────────────────────────────────────────────────────

export async function createInquiry(data: { name: string; email: string; phone?: string; message: string; propertyId: string; userId?: string }) {
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
