-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "failureCode" TEXT,
ADD COLUMN     "processingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processingLeaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "processingStartedAt" TIMESTAMP(3);


-- ─── Hand-written: processing invariants Prisma's schema language cannot express ─
-- Mirrored by validateMediaAssetRecord (shared/media-asset.ts) and the state machine
-- in shared/media-processing.ts.
--   * A PROCESSING asset records when processing started (timeout and redispatch use it).
--   * Only a PROCESSING asset can hold a worker lease.
--   * failureCode is set exactly when the asset is FAILED, and only to a known code.
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_processing_check" CHECK (
    "processingAttempts" >= 0
    AND ("status" <> 'PROCESSING' OR "processingStartedAt" IS NOT NULL)
    AND ("processingLeaseExpiresAt" IS NULL OR "status" = 'PROCESSING')
    AND (("status" = 'FAILED') = ("failureCode" IS NOT NULL))
    AND ("failureCode" IS NULL OR "failureCode" IN (
        'UPLOAD_AUTHORIZATION_FAILED', 'UPLOAD_EXPIRED', 'UPLOAD_VERIFICATION_FAILED',
        'INVALID_SOURCE', 'SOURCE_MISSING', 'SOURCE_INTEGRITY_FAILED', 'UNSUPPORTED_CONTENT',
        'VALIDATION_FAILED', 'SIZE_LIMIT_EXCEEDED', 'PROCESSING_TIMEOUT', 'RETRIES_EXHAUSTED',
        'INTERNAL_ERROR'))
);
