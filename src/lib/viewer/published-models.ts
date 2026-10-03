/* Explicit .ts specifiers, as src/lib/entitlements/decide.ts does: the test
   runner loads this module directly under node's ESM resolver, which does not
   guess extensions. infra/tsconfig.json emits JavaScript and so must keep bare
   specifiers — it lists the viewer files it compiles, and this is not one. */
import { MEDIA_KEY_PATTERN, publishedObjectMetadata } from "../../../shared/media-contract.ts";
import type { ProjectImmersiveMedia } from "../project-types.ts";

/**
 * The public face of a PUBLISHED model MediaAsset: the only fields a project
 * page may use. Everything private (sourceKey, review copies, source checksums,
 * processing diagnostics, uploader and reviewer ids) is never selected, so it
 * cannot leak into a page's props.
 *
 * Mirrors published-panoramas.ts deliberately — same allow-list select, same
 * re-validation on the way out. Pure: the database call lives in
 * src/lib/services/project-models.ts.
 *
 * Why this file exists at all: a creator's model reaches storage and the
 * database through upload → worker → review → publish, but the project page read
 * its model from a hand-copied constant in projects.ts. A published asset was
 * therefore invisible on the page it was published for, and the pilot
 * placeholder was the only model any project could ever show.
 */

/** Columns read from MediaAsset. Deliberately an allow-list; nothing private is selected. */
export const PUBLISHED_MODEL_SELECT = {
  id: true,
  status: true,
  kind: true,
  format: true,
  subjectType: true,
  projectSlug: true,
  storageKey: true,
  entryFile: true,
  contentHash: true,
  sizeBytes: true,
  posterKey: true,
  dimensions: true,
  altText: true,
  processorVersion: true,
} as const;

/**
 * Prisma arguments for a project's published model.
 *
 * Only a PUBLISHED MODEL belonging to this project can match: an asset of
 * another project, of another kind, or still PROCESSING / PENDING_REVIEW /
 * REJECTED / FAILED / ARCHIVED is not returned at all.
 *
 * `sortOrder` first so a curator can pin which model leads, then the most
 * recently published, so re-publishing a corrected export supersedes the old one
 * without anyone having to clear the previous row.
 */
export function publishedModelQuery(projectSlug: string) {
  return {
    where: {
      status: "PUBLISHED" as const,
      kind: "MODEL" as const,
      subjectType: "PROJECT" as const,
      projectSlug,
    },
    orderBy: [{ sortOrder: "asc" as const }, { publishedAt: "desc" as const }],
    take: 1,
    select: PUBLISHED_MODEL_SELECT,
  };
}

type Row = { [K in keyof typeof PUBLISHED_MODEL_SELECT]?: unknown };

const positiveInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isInteger(v) && v > 0;

/** Poster dimensions as the worker records them: metrics.dimensions.poster. */
function posterSize(dimensions: unknown): { width: number; height: number } | null {
  if (!dimensions || typeof dimensions !== "object") return null;
  const poster = (dimensions as Record<string, unknown>).poster;
  if (!poster || typeof poster !== "object") return null;
  const { width, height } = poster as Record<string, unknown>;
  return positiveInt(width) && positiveInt(height) ? { width, height } : null;
}

/**
 * Maps a row to the shape a project page already knows how to render, or null.
 *
 * Everything the query promised is checked again here — status, kind, subject,
 * the storage-key contract, and that the key really belongs to this asset — so a
 * mistaken query or a corrupt row can never produce a CDN URL. `review` is
 * "approved" because reaching PUBLISHED means a reviewer approved it; the
 * placeholder branch exists only for the hand-authored pilot asset.
 *
 * XR is deliberately absent. Offering AR means placing the model in a real room,
 * which needs the model's unit scale, and that is a fact about the export that
 * nothing in the pipeline measures. A project can still opt a model into AR by
 * stating the scale in projects.ts.
 */
export function toPublishedModel(row: Row | null | undefined, projectSlug: string): ProjectImmersiveMedia | null {
  if (!row) return null;
  if (row.status !== "PUBLISHED" || row.kind !== "MODEL" || row.format !== "GLB") return null;
  if (row.subjectType !== "PROJECT" || row.projectSlug !== projectSlug) return null;
  if (typeof row.id !== "string" || typeof row.storageKey !== "string" || typeof row.entryFile !== "string") return null;
  if (typeof row.contentHash !== "string" || !positiveInt(row.sizeBytes)) return null;
  // Alt text is required before approval, so its absence means a broken row, not
  // a model to render without a description.
  if (typeof row.altText !== "string" || !row.altText.trim()) return null;

  const entryKey = `${row.storageKey}/${row.entryFile}`;
  if (!MEDIA_KEY_PATTERN.test(entryKey) || entryKey.split("/")[1] !== row.id) return null;
  if (publishedObjectMetadata(entryKey)?.contentType !== "model/gltf-binary") return null;

  // A poster is optional for models (the pipeline cannot render one yet), and a
  // poster that fails the contract is dropped rather than failing the model.
  const size = posterSize(row.dimensions);
  const posterKey = typeof row.posterKey === "string" ? row.posterKey : null;
  const posterOk =
    posterKey !== null &&
    size !== null &&
    posterKey.startsWith(`${row.storageKey}/`) &&
    MEDIA_KEY_PATTERN.test(posterKey) &&
    (publishedObjectMetadata(posterKey)?.contentType ?? "").startsWith("image/");

  return {
    mediaId: row.id,
    kind: "MODEL",
    format: "GLB",
    storageKey: row.storageKey,
    entryFile: row.entryFile,
    contentHash: row.contentHash,
    sizeBytes: row.sizeBytes,
    poster: posterOk && posterKey && size ? { key: posterKey, width: size.width, height: size.height } : null,
    processingVersion: typeof row.processorVersion === "string" ? row.processorVersion : "unknown",
    altText: row.altText.trim(),
    review: "approved",
  };
}
