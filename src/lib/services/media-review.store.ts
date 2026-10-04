import type { Prisma, PrismaClient } from "@prisma/client";
import type { MediaReviewStore, ReviewAssetRow } from "./media-review.service";

/**
 * Prisma implementation of the admin review store (see media-review.service.ts).
 * A factory over a client so it can run against any database the caller chooses.
 * Decisions are single conditional updates on status PENDING_REVIEW, so concurrent
 * approvals and rejections cannot both win.
 */

const SELECT = {
  id: true,
  subjectType: true,
  propertyId: true,
  projectSlug: true,
  property: { select: { title: true } },
  kind: true,
  format: true,
  status: true,
  storageKey: true,
  entryFile: true,
  contentHash: true,
  mimeType: true,
  sizeBytes: true,
  fileCount: true,
  posterKey: true,
  dimensions: true,
  metrics: true,
  title: true,
  altText: true,
  provenance: true,
  visibility: true,
  sourceKey: true,
  sourceSizeBytes: true,
  sourceMimeType: true,
  sourceChecksumSha256: true,
  processorVersion: true,
  processingAttempts: true,
  processingStartedAt: true,
  failureCode: true,
  processingError: true,
  rejectionReason: true,
  uploadedBy: { select: { id: true, name: true, email: true } },
  reviewedAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Selected = Omit<ReviewAssetRow, "propertyTitle"> & { property: { title: string } | null };
const toRow = ({ property, ...rest }: Selected): ReviewAssetRow => ({ ...rest, propertyTitle: property?.title ?? null });

export function createPrismaReviewStore(prisma: PrismaClient): MediaReviewStore {
  return {
    findUser: (id) => prisma.user.findUnique({ where: { id }, select: { id: true, role: true } }),

    async listAssets({ status, limit }) {
      const rows = await prisma.mediaAsset.findMany({
        where: status ? { status } : {},
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: limit,
        select: SELECT,
      });
      return (rows as unknown as Selected[]).map(toRow);
    },

    async findAsset(id) {
      const row = await prisma.mediaAsset.findUnique({ where: { id }, select: SELECT });
      return row ? toRow(row as unknown as Selected) : null;
    },

    async approve(id, reviewerId, now, decision) {
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "PENDING_REVIEW" },
        data: {
          status: "PUBLISHED",
          reviewedAt: now,
          publishedAt: now,
          reviewedById: reviewerId,
          altText: decision.altText,
          provenance: decision.provenance,
          visibility: decision.visibility,
          // Omitted rather than nulled when the reviewer said nothing, so an
          // approval that is only correcting alt text does not wipe the cameras.
          ...(decision.viewDefaults
            ? { viewDefaults: decision.viewDefaults as Prisma.InputJsonValue }
            : {}),
        },
      });
      return count;
    },

    async release(id, reviewerId, now) {
      /* Conditional on BOTH the published status and the current INTERNAL
         visibility. Without the visibility clause a release racing an archive
         could publish something that had just been withdrawn. */
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "PUBLISHED", visibility: "INTERNAL" },
        data: { visibility: "PUBLIC", reviewedAt: now, reviewedById: reviewerId },
      });
      return count;
    },

    async archive(id, reviewerId, now, from, reason) {
      // Conditional on the status the caller actually read, so two withdrawals
      // racing cannot both count as the one that moved it.
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: from },
        data: { status: "ARCHIVED", reviewedAt: now, reviewedById: reviewerId, rejectionReason: reason },
      });
      return count;
    },

    async reject(id, reviewerId, now, reason) {
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "PENDING_REVIEW" },
        data: { status: "REJECTED", rejectionReason: reason, reviewedAt: now, reviewedById: reviewerId },
      });
      return count;
    },
  };
}
