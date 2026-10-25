/**
 * Who decides whether a listing is public.
 *
 * Until 25 Oct 2026 nobody did: any signed-up account could POST a listing that
 * the schema defaulted to ACTIVE — public on /listings at once, `featured` if it
 * asked to be — and then PATCH its own listing to `verified: true`. That is how
 * the "ZK9TEST Marker Villa" test record reached the catalogue.
 *
 * The rule now:
 *   - a new listing is PENDING, unverified and unfeatured, whatever was sent;
 *   - an owner's edit sends the listing back to PENDING and clears `verified`,
 *     so an approved listing cannot be rewritten into something unreviewed;
 *   - only an admin, through /api/admin/properties/[id], sets status, verified
 *     or featured.
 *
 * Kept free of Prisma and I/O so the rule can be tested directly.
 */

/** Moderation fields every new listing starts with. */
export const NEW_LISTING_MODERATION = {
  status: "PENDING",
  verified: false,
  featured: false,
} as const;

/** Moderation fields an owner's content edit resets. `featured` is left as the admin set it. */
export const OWNER_EDIT_MODERATION = {
  status: "PENDING",
  verified: false,
} as const;

const MODERATION_KEYS = ["status", "verified", "featured"] as const;
type Content<T> = Omit<T, (typeof MODERATION_KEYS)[number]>;

/** Drops any moderation field, whatever a caller managed to put in the object. */
function contentOnly<T extends object>(input: T): Content<T> {
  const out = { ...input } as Record<string, unknown>;
  for (const key of MODERATION_KEYS) delete out[key];
  return out as Content<T>;
}

/** Prisma `data` for a new listing. Moderation fields are set last, so they always win. */
export function newListingData<T extends object>(input: T, ownerId: string) {
  return { ...contentOnly(input), ownerId, ...NEW_LISTING_MODERATION };
}

/**
 * Prisma `data` for an edit through the owner route.
 *
 * An admin editing content there keeps the listing's standing; anyone else's
 * edit returns it to review.
 */
export function listingEditData<T extends object>(
  input: T,
  requesterRole: string,
): Content<T> & Partial<typeof OWNER_EDIT_MODERATION> {
  const content = contentOnly(input);
  return requesterRole === "ADMIN" ? content : { ...content, ...OWNER_EDIT_MODERATION };
}
