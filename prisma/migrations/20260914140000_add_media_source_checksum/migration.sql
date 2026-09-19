-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN "sourceChecksumSha256" TEXT;


-- ─── Hand-written: invariant Prisma's schema language cannot express ──────────
-- The uploader's declared SHA-256, exactly as S3's x-amz-checksum-sha256 carries it:
-- canonical base64 of a 32-byte digest (43 characters and one "="). Never hex, never a
-- URL. Mirrored by validateMediaAssetRecord in shared/media-asset.ts.
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_source_checksum_check" CHECK (
    "sourceChecksumSha256" IS NULL
    OR "sourceChecksumSha256" ~ '^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$'
);
