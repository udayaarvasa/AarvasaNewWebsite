-- Provenance for immersive media.
--
-- Existing rows take the default, INTERNAL_TEST, and that is the correct
-- backfill rather than a shortcut: the only PUBLISHED asset at the time of this
-- migration is the 952-byte engineering cube used to prove the pipeline, which
-- was being served on a project page as that project's architecture. Anything
-- genuinely official is re-stated by a reviewer, which is a deliberate human
-- step; nothing is promoted to public by a migration.

-- CreateEnum
CREATE TYPE "MediaProvenance" AS ENUM ('OFFICIAL_MODEL', 'DEVELOPER_RENDER', 'SHOW_APARTMENT_PHOTO', 'PHOTO_360', 'RENDERED_360', 'AARVASA_RECONSTRUCTION', 'INTERNAL_TEST');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "provenance" "MediaProvenance" NOT NULL DEFAULT 'INTERNAL_TEST';

-- CreateIndex
CREATE INDEX "MediaAsset_projectSlug_status_provenance_sortOrder_idx" ON "MediaAsset"("projectSlug", "status", "provenance", "sortOrder");
