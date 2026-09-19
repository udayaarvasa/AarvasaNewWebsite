import type { Prisma, PrismaClient } from "@prisma/client";
import type { ProcessingAssetRow, ProcessingFailureGuard, ProcessingStore } from "../../../shared/media-processing";

/**
 * Prisma implementation of the processing/sweeper data store (shared/media-processing.ts).
 *
 * A factory over a client rather than the app's `@/lib/prisma` singleton, so the
 * processing worker can run outside Next.js with the application database role.
 * Every write is a single conditional updateMany: the WHERE clause re-states the
 * state the caller observed (status, attempt/lease, source, age), so a newer state
 * is never overwritten and concurrent writers converge.
 */

const ROW = {
  id: true,
  subjectType: true,
  propertyId: true,
  projectSlug: true,
  kind: true,
  status: true,
  sourceKey: true,
  sourceSizeBytes: true,
  sourceMimeType: true,
  sourceChecksumSha256: true,
  processingStartedAt: true,
  processingAttempts: true,
  processingLeaseExpiresAt: true,
  altText: true,
  createdAt: true,
} satisfies Prisma.MediaAssetSelect;

const leaseFreeAt = (now: Date): Prisma.MediaAssetWhereInput => ({
  OR: [{ processingLeaseExpiresAt: null }, { processingLeaseExpiresAt: { lt: now } }],
});

function failureGuardWhere(guard: ProcessingFailureGuard): Prisma.MediaAssetWhereInput[] {
  const and: Prisma.MediaAssetWhereInput[] = [];
  if (guard.attempt !== undefined) and.push({ processingAttempts: guard.attempt });
  if (guard.leaseFreeAt) and.push(leaseFreeAt(guard.leaseFreeAt));
  if (guard.startedBefore) and.push({ processingStartedAt: { lt: guard.startedBefore } });
  if (guard.minAttempts !== undefined) and.push({ processingAttempts: { gte: guard.minAttempts } });
  if (guard.sourceKey !== undefined) and.push({ sourceKey: guard.sourceKey });
  return and;
}

export function createPrismaProcessingStore(prisma: PrismaClient): ProcessingStore {
  return {
    findAsset: (id) => prisma.mediaAsset.findUnique({ where: { id }, select: ROW }) as Promise<ProcessingAssetRow | null>,

    async claim(id, sourceKey, now, leaseExpiresAt, maxAttempts) {
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "PROCESSING", sourceKey, processingAttempts: { lt: maxAttempts }, ...leaseFreeAt(now) },
        data: { processingAttempts: { increment: 1 }, processingLeaseExpiresAt: leaseExpiresAt },
      });
      if (count !== 1) return null;
      // Nobody else can claim until this lease lapses, so the attempt read back is ours.
      const row = await prisma.mediaAsset.findUnique({ where: { id }, select: { processingAttempts: true, processingLeaseExpiresAt: true } });
      return row && row.processingLeaseExpiresAt?.getTime() === leaseExpiresAt.getTime() ? row.processingAttempts : null;
    },

    async release(id, attempt) {
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "PROCESSING", processingAttempts: attempt },
        data: { processingLeaseExpiresAt: null },
      });
      return count;
    },

    async completeProcessing(id, attempt, expected, data) {
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "PROCESSING", processingAttempts: attempt, sourceKey: expected.sourceKey, sourceChecksumSha256: expected.sourceChecksumSha256 },
        data: {
          status: "PENDING_REVIEW",
          format: data.format,
          storageKey: data.storageKey,
          entryFile: data.entryFile,
          contentHash: data.contentHash,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          fileCount: data.fileCount,
          posterKey: data.posterKey,
          dimensions: data.dimensions as Prisma.InputJsonValue,
          metrics: data.metrics as Prisma.InputJsonValue,
          processorVersion: data.processorVersion,
          processingError: null,
          failureCode: null,
          processingLeaseExpiresAt: null,
        },
      });
      return count;
    },

    async failProcessing(id, guard, failure) {
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "PROCESSING", AND: failureGuardWhere(guard) },
        data: { status: "FAILED", failureCode: failure.code, processingError: failure.diagnostic, processingLeaseExpiresAt: null },
      });
      return count;
    },

    async failUpload(id, createdBefore, failure) {
      const { count } = await prisma.mediaAsset.updateMany({
        where: { id, status: "UPLOADED", createdAt: { lt: createdBefore } },
        data: { status: "FAILED", failureCode: failure.code, processingError: failure.diagnostic },
      });
      return count;
    },

    listUploadedBefore: (createdBefore, limit) =>
      prisma.mediaAsset.findMany({
        where: { status: "UPLOADED", createdAt: { lt: createdBefore } },
        orderBy: { createdAt: "asc" },
        take: limit,
        select: ROW,
      }) as Promise<ProcessingAssetRow[]>,

    listProcessing: (limit) =>
      prisma.mediaAsset.findMany({
        where: { status: "PROCESSING" },
        orderBy: [{ processingStartedAt: "asc" }, { id: "asc" }],
        take: limit,
        select: ROW,
      }) as Promise<ProcessingAssetRow[]>,
  };
}
