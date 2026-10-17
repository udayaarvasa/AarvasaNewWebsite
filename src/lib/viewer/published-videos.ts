/* Explicit .ts specifiers, as published-models.ts does: the app test runner
   loads this module under node's ESM resolver, which does not guess extensions.
   It imports nothing from shared/media-asset.ts for the same reason — that file
   uses bare specifiers because infra compiles it to CommonJS. */
import {
  PROVENANCE_LABEL,
  PROVENANCE_NOTE,
  isMediaProvenance,
  isPubliclyResolvable,
  isPubliclyShowable,
} from "../media/provenance.ts";
import { MEDIA_KEY_PATTERN, publishedObjectMetadata } from "../../../shared/media-contract.ts";

/**
 * A PUBLISHED tour film, reduced to what a property page may use.
 *
 * Deliberately narrow. Everything private stays on the server: no storage key,
 * no source key or checksum, no visibility and no raw provenance enum. The
 * visitor is given a playable URL, an optional poster, the frame size, and the
 * provenance *as wording* — which is the part they are entitled to.
 */
export interface PublishedVideo {
  readonly mediaId: string;
  readonly url: string;
  readonly posterUrl: string | null;
  readonly mimeType: "video/mp4";
  /** As displayed, so a portrait clip is portrait. */
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number | null;
  readonly altText: string;
  readonly provenanceLabel: string;
  readonly provenanceNote: string | null;
}

export const PUBLISHED_VIDEO_SELECT = {
  id: true,
  status: true,
  kind: true,
  format: true,
  subjectType: true,
  projectSlug: true,
  storageKey: true,
  entryFile: true,
  sizeBytes: true,
  posterKey: true,
  dimensions: true,
  metrics: true,
  altText: true,
  provenance: true,
  visibility: true,
} as const;

/** How many films one project may contribute to its tour. */
export const PROJECT_VIDEO_LIMIT = 24;

/**
 * Prisma arguments for a project's published films.
 *
 * Only PUBLISHED VIDEO rows of this project can match. Withheld rows are
 * excluded in the query, not filtered afterwards, and the provenance floor
 * holds even in internal preview: an engineering test clip is not a tour.
 */
export function publishedVideosQuery(projectSlug: string, options: { includeInternal?: boolean } = {}) {
  return {
    where: {
      status: "PUBLISHED" as const,
      kind: "VIDEO" as const,
      format: "MP4" as const,
      subjectType: "PROJECT" as const,
      projectSlug,
      ...(options.includeInternal ? {} : { visibility: "PUBLIC" as const }),
      provenance: { not: "INTERNAL_TEST" as const },
    },
    orderBy: [{ sortOrder: "asc" as const }, { publishedAt: "desc" as const }],
    take: PROJECT_VIDEO_LIMIT,
    select: PUBLISHED_VIDEO_SELECT,
  };
}

type Row = { [K in keyof typeof PUBLISHED_VIDEO_SELECT]?: unknown };

const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

function frameSize(dimensions: unknown, part: "entry" | "poster"): { width: number; height: number } | null {
  if (!dimensions || typeof dimensions !== "object") return null;
  const box = (dimensions as Record<string, unknown>)[part];
  if (!box || typeof box !== "object") return null;
  const { width, height } = box as Record<string, unknown>;
  return positiveInt(width) && positiveInt(height) ? { width, height } : null;
}

function duration(metrics: unknown): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const value = (metrics as Record<string, unknown>).durationSeconds;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Map one row to a playable film, or null.
 *
 * Every promise the query made is checked again, because what this returns
 * becomes a URL served to anonymous visitors. A row from another project, of
 * another kind, unpublished, withheld, or whose key does not belong to it
 * produces nothing — returning it anyway would publish someone else's film or
 * one nobody approved.
 */
export function toPublishedVideo(
  row: Row | null | undefined,
  projectSlug: string,
  cdnOrigin: string,
  options: { includeInternal?: boolean } = {},
): PublishedVideo | null {
  if (!row) return null;
  if (row.status !== "PUBLISHED" || row.kind !== "VIDEO" || row.format !== "MP4") return null;
  if (row.subjectType !== "PROJECT" || row.projectSlug !== projectSlug) return null;
  if (!isPubliclyShowable(row.provenance)) return null;
  if (!options.includeInternal && !isPubliclyResolvable(row.visibility, row.provenance)) return null;
  if (typeof row.id !== "string" || typeof row.storageKey !== "string" || typeof row.entryFile !== "string") return null;
  if (!positiveInt(row.sizeBytes)) return null;
  // Alt text is required before approval; without it the row is broken, not undescribed.
  if (typeof row.altText !== "string" || !row.altText.trim()) return null;
  if (!isMediaProvenance(row.provenance)) return null;

  const entryKey = `${row.storageKey}/${row.entryFile}`;
  if (!MEDIA_KEY_PATTERN.test(entryKey) || entryKey.split("/")[1] !== row.id) return null;
  if (publishedObjectMetadata(entryKey)?.contentType !== "video/mp4") return null;

  const size = frameSize(row.dimensions, "entry");
  if (!size) return null;

  // Optional, and a poster that fails the contract is dropped rather than
  // failing the film: the player shows the first frame instead.
  const posterKey = typeof row.posterKey === "string" ? row.posterKey : null;
  const posterOk =
    posterKey !== null &&
    frameSize(row.dimensions, "poster") !== null &&
    posterKey.startsWith(`${row.storageKey}/`) &&
    MEDIA_KEY_PATTERN.test(posterKey) &&
    (publishedObjectMetadata(posterKey)?.contentType ?? "").startsWith("image/");

  return {
    mediaId: row.id,
    url: `${cdnOrigin}/${entryKey}`,
    posterUrl: posterOk ? `${cdnOrigin}/${posterKey}` : null,
    mimeType: "video/mp4",
    width: size.width,
    height: size.height,
    durationSeconds: duration(row.metrics),
    altText: row.altText.trim(),
    provenanceLabel: PROVENANCE_LABEL[row.provenance],
    provenanceNote: PROVENANCE_NOTE[row.provenance] ?? null,
  };
}
