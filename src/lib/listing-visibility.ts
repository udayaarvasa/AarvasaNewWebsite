/**
 * Which database listings the public may see.
 *
 * The Property table holds no real listing today. Six rows are the fictional
 * demo data from prisma/seed.js (stock photography, invented ROI and AI
 * scores, marked "verified" by the seed), and one is a test record created by
 * a wallet test account. All were served on /listings, /property/{id},
 * /api/properties and compare as if they were real investment opportunities.
 *
 * They are hidden here rather than deleted: the records — and the one inquiry
 * a visitor sent about a fictional listing — stay in the database for review.
 * Removing an id from this map makes that listing public again.
 *
 * Kept free of Prisma and I/O so the rule can be tested directly.
 */
export const HIDDEN_LISTINGS: Readonly<Record<string, string>> = {
  cmqe5wmfv0004ulvrbtgm4pyx: "Seed demo data (prisma/seed.js): Aarvasa Cliff Villas",
  cmqe5wn030006ulvrt149xeg0: "Seed demo data (prisma/seed.js): Skyline Residences 72",
  cmqe5wn8i0008ulvrxdx450vy: "Seed demo data (prisma/seed.js): Northstar Tech Park",
  cmqe5wnh0000aulvro60lza7n: "Seed demo data (prisma/seed.js): Kihim Waterfront Estate",
  cmqe5wnpk000culvr9n3n3ko5: "Seed demo data (prisma/seed.js): Sea Link Private Residences",
  cmqe5wny4000eulvr745cv2dz: "Seed demo data (prisma/seed.js): Hinjewadi Growth Homes",
  cmuel1f6k0002em0bjlfqdq6y: "Test record created by a wallet test account: ZK9TEST Marker Villa",
};

export const HIDDEN_LISTING_IDS: readonly string[] = Object.keys(HIDDEN_LISTINGS);

export const isHiddenListing = (id: string): boolean => Object.hasOwn(HIDDEN_LISTINGS, id);

/** The only listings anyone without a privileged role may see. */
export const publicListingWhere = () => ({
  status: "ACTIVE" as const,
  id: { notIn: [...HIDDEN_LISTING_IDS] },
});

/** Whether a listing record may be shown to a non-privileged viewer. */
export const isPubliclyVisible = (listing: { id: string; status: string }): boolean =>
  listing.status === "ACTIVE" && !isHiddenListing(listing.id);
