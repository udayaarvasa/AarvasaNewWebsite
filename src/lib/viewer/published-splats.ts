import { isPubliclyShowable } from "../media/provenance";
import { MEDIA_KEY_PATTERN, publishedObjectMetadata } from "../../../shared/media-contract";
import { SPLAT_LIMITS } from "./splat-budget";

/**
 * The public face of a PUBLISHED Gaussian splat MediaAsset: the only fields a
 * project page may use. Private columns (sourceKey, checksums, processing
 * diagnostics, reviewer ids, review copies) are never selected.
 *
 * Pure: the database call lives in src/lib/services/project-splats.ts.
 */
export type PublishedSplat = {
  id: string;
  /** Full object key of the .sog bundle, m/{mediaId}/{hash}/{file}.sog. */
  entryKey: string;
  altText: string;
  sizeBytes: number;
  /** From the Phase 2B-2 validator's metrics; null when absent. */
  gaussians: number | null;
  poster: { key: string; width: number; height: number } | null;
  initialView: { yawDeg?: number; pitchDeg?: number } | null;
};

/** Columns read from MediaAsset. Deliberately an allow-list; nothing private is selected. */
export const PUBLISHED_SPLAT_SELECT = {
  id: true,
  status: true,
  kind: true,
  format: true,
  subjectType: true,
  projectSlug: true,
  storageKey: true,
  entryFile: true,
  posterKey: true,
  altText: true,
  sizeBytes: true,
  metrics: true,
  dimensions: true,
  viewDefaults: true,
  provenance: true,
} as const;

/**
 * Prisma arguments for the splat a project names. Only a PUBLISHED SPLAT/SOG
 * asset of this project can match: UPLOADED, PROCESSING, PENDING_REVIEW,
 * REJECTED, FAILED and ARCHIVED assets, and other projects' assets, are not returned.
 */
export function publishedSplatQuery(projectSlug: string, id: string) {
  return {
    where: {
      id,
      status: "PUBLISHED" as const,
      kind: "SPLAT" as const,
      format: "SOG" as const,
      subjectType: "PROJECT" as const,
      projectSlug,
      // Engineering assets are excluded in the query, not filtered out later.
      provenance: { not: "INTERNAL_TEST" as const },
    },
    select: PUBLISHED_SPLAT_SELECT,
  };
}

type Row = { [K in keyof typeof PUBLISHED_SPLAT_SELECT]?: unknown };

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const positiveInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const record = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/**
 * Maps a row to a public splat, re-checking everything the query promised
 * (status, kind, format, subject) and the storage contract, or returns null.
 * A scene over the single-file hard limit is dropped: publishing refuses it,
 * so such a row is corrupt.
 */
export function toPublishedSplat(r: Row | null | undefined, projectSlug: string): PublishedSplat | null {
  if (!r) return null;
  if (r.status !== "PUBLISHED" || r.kind !== "SPLAT" || r.format !== "SOG" || r.subjectType !== "PROJECT" || r.projectSlug !== projectSlug) return null;
  // Checked again here: a test splat must not reach a public page even if the
  // caller passed the wrong query.
  if (!isPubliclyShowable(r.provenance)) return null;
  if (typeof r.id !== "string" || typeof r.storageKey !== "string" || typeof r.entryFile !== "string") return null;
  if (typeof r.altText !== "string" || !r.altText.trim()) return null;
  if (!positiveInt(r.sizeBytes) || r.sizeBytes > SPLAT_LIMITS.bytes.hardLimit) return null;
  const entryKey = `${r.storageKey}/${r.entryFile}`;
  if (!MEDIA_KEY_PATTERN.test(entryKey) || entryKey.split("/")[1] !== r.id) return null;
  if (publishedObjectMetadata(entryKey)?.contentType !== "application/zip" || !entryKey.toLowerCase().endsWith(".sog")) return null;

  const metrics = record(r.metrics);
  const gaussians = positiveInt(metrics?.gaussians) ? metrics.gaussians : null;

  let poster: PublishedSplat["poster"] = null;
  const posterSize = record(record(r.dimensions)?.poster);
  if (typeof r.posterKey === "string" && r.posterKey.startsWith(`${r.storageKey}/`) && MEDIA_KEY_PATTERN.test(r.posterKey)) {
    const type = publishedObjectMetadata(r.posterKey)?.contentType;
    if (type?.startsWith("image/") && positiveInt(posterSize?.width) && positiveInt(posterSize?.height)) {
      poster = { key: r.posterKey, width: posterSize.width, height: posterSize.height };
    }
  }

  const v = record(r.viewDefaults);
  const initialView = v ? { ...(finite(v.yawDeg) ? { yawDeg: v.yawDeg } : {}), ...(finite(v.pitchDeg) ? { pitchDeg: v.pitchDeg } : {}) } : null;

  return { id: r.id, entryKey, altText: r.altText.trim(), sizeBytes: r.sizeBytes, gaussians, poster, initialView };
}
