-- Visibility, separated from provenance.
--
-- Provenance said two things at once: what an asset is, and whether the public
-- may see it. That made "an Aarvasa reconstruction, not yet released"
-- inexpressible — the only way to withhold something was to mislabel it as a
-- test asset, and the only way to describe it honestly was to publish it.
--
-- Existing rows take the default, INTERNAL, which is the safe direction: every
-- row keeps whatever privacy it had, and nothing becomes public by migration.
-- The old index is replaced rather than kept because public lookups now filter
-- on visibility first.

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('INTERNAL', 'PUBLIC');

-- DropIndex
DROP INDEX "MediaAsset_projectSlug_status_provenance_sortOrder_idx";

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "visibility" "MediaVisibility" NOT NULL DEFAULT 'INTERNAL';

-- CreateIndex
CREATE INDEX "MediaAsset_projectSlug_status_visibility_provenance_sortOrd_idx" ON "MediaAsset"("projectSlug", "status", "visibility", "provenance", "sortOrder");
