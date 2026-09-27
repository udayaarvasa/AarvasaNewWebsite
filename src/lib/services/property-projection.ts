/**
 * Public vs privileged shapes for the property catalogue.
 *
 * Kept in its own module, free of Prisma and any I/O, so the security contract
 * below can be asserted by a test without standing up a database.
 *
 * BACKGROUND. /api/properties and /api/properties/[id] are intentionally public
 * and unauthenticated. They previously selected the full owner record, so an
 * anonymous caller could page the catalogue (limit up to 50, page unbounded)
 * and harvest every lister's email address, internal user id and role —
 * including which account holds ADMIN, a direct targeting aid for credential
 * attacks. The projections here are the fix, applied at the query, so the
 * fields never leave the database rather than being hidden by the client.
 */

/** Owner fields safe to return to anyone: who listed it, and in what capacity. */
export const PUBLIC_OWNER_SELECT = {
  name: true,
  image: true,
  role: true,
} as const;

/** Full owner record. Only for a caller already proven entitled to it — the
 *  owner themselves, or an admin route. Never in a public response. */
export const PRIVILEGED_OWNER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
  role: true,
} as const;

/**
 * Fields that must never appear in a public catalogue response.
 * The test asserts this list against PUBLIC_PROPERTY_SELECT, so adding a
 * sensitive column to the public projection fails the build rather than
 * quietly shipping.
 */
export const PRIVILEGED_PROPERTY_FIELDS = [
  "ownerId",
  "aiScore",
  "riskLevel",
  "blockchainTxHash",
] as const;

/** Public catalogue projection: property facts, plus who listed it. */
export const PUBLIC_PROPERTY_SELECT = {
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
  tokenized: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: PUBLIC_OWNER_SELECT },
  _count: { select: { favorites: true, inquiries: true } },
} as const;

/**
 * Listing capacity as shown publicly. ADMIN is an internal privilege level,
 * not a listing capacity, so it is reported as the neutral OWNER rather than
 * telling an anonymous caller which named account administers the platform.
 */
export function toPublicRole(role: string): string {
  return role === "ADMIN" ? "OWNER" : role;
}

/** Coarsen the owner role on an outgoing public record. */
export function toPublicProperty<T extends { owner?: { role?: string } | null }>(p: T): T {
  if (p.owner?.role) {
    return { ...p, owner: { ...p.owner, role: toPublicRole(p.owner.role) } };
  }
  return p;
}
