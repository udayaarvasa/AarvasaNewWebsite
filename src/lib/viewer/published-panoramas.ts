import { isPubliclyShowable } from "../media/provenance";
import { MEDIA_KEY_PATTERN, publishedObjectMetadata } from "../../../shared/media-contract";
import type { PanoramaView } from "./types";

/**
 * The public face of a PUBLISHED panorama MediaAsset: the only fields a tour
 * may use. Everything private (sourceKey, review copies, checksums, processing
 * diagnostics, reviewer ids) is never selected, so it cannot be passed on.
 *
 * Pure: the database call lives in src/lib/services/project-panoramas.ts.
 */
export type PublishedPanorama = {
  id: string;
  /** Full object key of the equirectangular image, m/{mediaId}/{hash}/{file}. */
  entryKey: string;
  altText: string;
  initialView: Partial<PanoramaView> | null;
};

/** Columns read from MediaAsset. Deliberately an allow-list; nothing private is selected. */
export const PUBLISHED_PANORAMA_SELECT = {
  id: true,
  status: true,
  kind: true,
  subjectType: true,
  projectSlug: true,
  storageKey: true,
  entryFile: true,
  altText: true,
  viewDefaults: true,
  provenance: true,
} as const;

/**
 * Prisma arguments for the panoramas a project's tour references. Only
 * PUBLISHED PANORAMA assets that belong to this project can match: an id from
 * another project, or one still PROCESSING / PENDING_REVIEW / REJECTED /
 * FAILED / ARCHIVED, is simply not returned.
 */
export function publishedPanoramaQuery(projectSlug: string, ids: readonly string[]) {
  return {
    where: {
      id: { in: [...ids] },
      status: "PUBLISHED" as const,
      kind: "PANORAMA" as const,
      subjectType: "PROJECT" as const,
      projectSlug,
      // Engineering assets are excluded in the query, not filtered out later.
      provenance: { not: "INTERNAL_TEST" as const },
    },
    select: PUBLISHED_PANORAMA_SELECT,
  };
}

type Row = { [K in keyof typeof PUBLISHED_PANORAMA_SELECT]?: unknown };

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Maps rows to public panoramas, re-checking everything the query promised
 * (status, kind, subject) and the storage contract, so a wrong query or a
 * corrupt row can never produce a viewer URL.
 */
export function toPublishedPanoramas(rows: readonly Row[], projectSlug: string): Map<string, PublishedPanorama> {
  const out = new Map<string, PublishedPanorama>();
  for (const r of rows) {
    if (r.status !== "PUBLISHED" || r.kind !== "PANORAMA" || r.subjectType !== "PROJECT" || r.projectSlug !== projectSlug) continue;
    // Checked again here: a test panorama must not reach a public tour even if
    // the caller passed the wrong query.
    if (!isPubliclyShowable(r.provenance)) continue;
    if (typeof r.id !== "string" || typeof r.storageKey !== "string" || typeof r.entryFile !== "string") continue;
    if (typeof r.altText !== "string" || !r.altText.trim()) continue;
    const entryKey = `${r.storageKey}/${r.entryFile}`;
    if (!MEDIA_KEY_PATTERN.test(entryKey) || entryKey.split("/")[1] !== r.id) continue;
    const type = publishedObjectMetadata(entryKey)?.contentType;
    if (type !== "image/jpeg" && type !== "image/webp") continue;

    const v = r.viewDefaults as Record<string, unknown> | null | undefined;
    const initialView =
      v && typeof v === "object"
        ? {
            ...(finite(v.yawDeg) ? { yawDeg: v.yawDeg } : {}),
            ...(finite(v.pitchDeg) ? { pitchDeg: v.pitchDeg } : {}),
            ...(finite(v.fovDeg) ? { fovDeg: v.fovDeg } : {}),
          }
        : null;
    out.set(r.id, { id: r.id, entryKey, altText: r.altText.trim(), initialView });
  }
  return out;
}
