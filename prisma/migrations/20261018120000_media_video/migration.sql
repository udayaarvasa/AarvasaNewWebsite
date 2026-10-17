-- Video as a first-class media kind.
--
-- Additive only: three enum values, no new tables and no new columns. A tour
-- film already has everywhere it needs to live on MediaAsset — projectSlug,
-- title, sortOrder, posterKey, mimeType, sizeBytes and the source checksum —
-- so nothing about the row changes shape.
--
-- No existing row is touched. Every new upload still defaults to INTERNAL
-- visibility and INTERNAL_TEST provenance until a reviewer says otherwise, so
-- nothing becomes public by migration.
--
-- SITE_FOOTAGE is the one provenance value video needed that did not exist.
-- Films made of renders already have DEVELOPER_RENDER; real footage of a
-- construction site had nothing that was true of it.

-- AlterEnum
ALTER TYPE "MediaAssetKind" ADD VALUE 'VIDEO';

-- AlterEnum
ALTER TYPE "MediaAssetFormat" ADD VALUE 'MP4';

-- AlterEnum
ALTER TYPE "MediaProvenance" ADD VALUE 'SITE_FOOTAGE';
