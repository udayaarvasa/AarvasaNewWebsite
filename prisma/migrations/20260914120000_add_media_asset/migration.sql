-- CreateEnum
CREATE TYPE "MediaSubjectType" AS ENUM ('PROPERTY', 'PROJECT');

-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('MODEL', 'PANORAMA', 'SPLAT');

-- CreateEnum
CREATE TYPE "MediaAssetFormat" AS ENUM ('GLB', 'EQUIRECT_JPEG', 'EQUIRECT_WEBP', 'SOG');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "subjectType" "MediaSubjectType" NOT NULL,
    "propertyId" TEXT,
    "projectSlug" TEXT,
    "kind" "MediaAssetKind" NOT NULL,
    "format" "MediaAssetFormat",
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADED',
    "storageKey" TEXT,
    "entryFile" TEXT,
    "contentHash" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "fileCount" INTEGER,
    "posterKey" TEXT,
    "dimensions" JSONB,
    "metrics" JSONB,
    "viewDefaults" JSONB,
    "title" TEXT,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceKey" TEXT NOT NULL,
    "sourceSizeBytes" INTEGER NOT NULL,
    "sourceMimeType" TEXT NOT NULL,
    "uploadedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "processingError" TEXT,
    "processorVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaAsset_propertyId_status_sortOrder_idx" ON "MediaAsset"("propertyId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaAsset_projectSlug_status_sortOrder_idx" ON "MediaAsset"("projectSlug", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_contentHash_idx" ON "MediaAsset"("contentHash");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedById_idx" ON "MediaAsset"("uploadedById");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Hand-written: invariants Prisma's schema language cannot express ─────────
-- Prisma does not introspect CHECK constraints, so these never show up as drift.
-- Mirrored for application code by validateMediaAssetRecord in shared/media-asset.ts.

-- Exactly one subject, and it matches subjectType. Projects are static (src/lib/projects.ts),
-- so projectSlug has no foreign key.
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_subject_check" CHECK (
    ("subjectType" = 'PROPERTY' AND "propertyId" IS NOT NULL AND "projectSlug" IS NULL)
    OR ("subjectType" = 'PROJECT' AND "projectSlug" IS NOT NULL AND "propertyId" IS NULL)
);

-- Lifecycle: processed fields exist once an asset reaches review or publication; each
-- outcome records why it happened.
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_lifecycle_check" CHECK (
    ("status" NOT IN ('PENDING_REVIEW', 'PUBLISHED') OR (
        "format" IS NOT NULL AND "storageKey" IS NOT NULL AND "entryFile" IS NOT NULL
        AND "contentHash" IS NOT NULL AND "mimeType" IS NOT NULL
        AND "sizeBytes" IS NOT NULL AND "fileCount" IS NOT NULL))
    AND ("status" <> 'PUBLISHED' OR (
        "reviewedAt" IS NOT NULL AND "publishedAt" IS NOT NULL AND "altText" IS NOT NULL))
    AND ("status" <> 'REJECTED' OR "rejectionReason" IS NOT NULL)
    AND ("status" <> 'FAILED' OR "processingError" IS NOT NULL)
);

-- Object keys, never URLs or absolute paths. The full key layout is validated in application code.
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_object_keys_check" CHECK (
    strpos("sourceKey", '://') = 0 AND left("sourceKey", 1) <> '/'
    AND ("storageKey" IS NULL OR (strpos("storageKey", '://') = 0 AND left("storageKey", 1) <> '/'))
    AND ("posterKey" IS NULL OR (strpos("posterKey", '://') = 0 AND left("posterKey", 1) <> '/'))
    AND ("entryFile" IS NULL OR (strpos("entryFile", '://') = 0 AND left("entryFile", 1) <> '/'))
);

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_sizes_check" CHECK (
    "sourceSizeBytes" >= 0
    AND ("sizeBytes" IS NULL OR "sizeBytes" >= 0)
    AND ("fileCount" IS NULL OR "fileCount" >= 1)
);
