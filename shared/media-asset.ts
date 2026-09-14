/**
 * Application contract for the Prisma `MediaAsset` model (prisma/schema.prisma).
 *
 * Dependency-free like media-contract.ts, and deliberately not Prisma's generated
 * types: server code maps a database row onto these shapes, and only a viewer-safe
 * source descriptor (src/lib/viewer/types.ts) ever reaches the browser.
 *
 *   MediaAsset row → validateMediaAssetRecord → application mapping → ViewerSource → PlayCanvas
 *
 * The enum value lists must equal the Prisma enums; infra/test/media-asset.test.ts
 * checks that. The kind and format names are the media pipeline's (ItemManifest).
 */
import { CONTENT_HASH_PATTERN, INGEST_PREFIX, MEDIA_ID_PATTERN, MEDIA_KEY_PATTERN, ORIGINAL_KEY_PATTERN, publishedObjectMetadata } from "./media-contract";

export const MEDIA_SUBJECT_TYPES = ["PROPERTY", "PROJECT"] as const;
export const MEDIA_ASSET_KINDS = ["MODEL", "PANORAMA", "SPLAT"] as const;
export const MEDIA_ASSET_FORMATS = ["GLB", "EQUIRECT_JPEG", "EQUIRECT_WEBP", "SOG"] as const;
export const MEDIA_ASSET_STATUSES = ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "FAILED", "ARCHIVED"] as const;

export type MediaSubjectType = (typeof MEDIA_SUBJECT_TYPES)[number];
export type MediaAssetKind = (typeof MEDIA_ASSET_KINDS)[number];
export type MediaAssetFormat = (typeof MEDIA_ASSET_FORMATS)[number];
export type MediaAssetStatus = (typeof MEDIA_ASSET_STATUSES)[number];

export const FORMATS_BY_KIND: Readonly<Record<MediaAssetKind, readonly MediaAssetFormat[]>> = {
  MODEL: ["GLB"],
  PANORAMA: ["EQUIRECT_JPEG", "EQUIRECT_WEBP"],
  SPLAT: ["SOG"],
};

/** Statuses whose rows must carry the processed-asset fields. */
export const PROCESSED_STATUSES: readonly MediaAssetStatus[] = ["PENDING_REVIEW", "PUBLISHED"];

/** Static project slugs, as used in src/lib/projects.ts. */
export const PROJECT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

// ── JSON columns ─────────────────────────────────────────────────────────────

type Size = { readonly width: number; readonly height: number };

/**
 * `MediaAsset.dimensions`: pixel sizes where they exist.
 *
 *   { "entry": { "width": 8192, "height": 4096 }, "poster": { "width": 1280, "height": 640 } }  // panorama
 *   { "entry": null, "poster": { "width": 1280, "height": 720 } }                               // model
 */
export type MediaAssetDimensions = {
  readonly entry: Size | null;
  readonly poster: Size | null;
};

/**
 * `MediaAsset.metrics`: the pipeline's ItemManifest.metrics, stored as produced.
 *
 *   { "meshes": 2, "primitives": 2, "triangles": 24, "materials": 2, "textures": 0,
 *     "maxTextureDimension": 0, "compression.draco": false }                        // model
 *   { "gaussians": 850000, "shBands": 3 }                                             // splat
 */
export type MediaAssetMetrics = Readonly<Record<string, number | boolean | string | null>>;

/**
 * `MediaAsset.viewDefaults`: the initial view, all fields optional. Models and splats
 * orbit a target; panoramas look out from the centre.
 *
 *   { "yawDeg": 35, "pitchDeg": -20, "distance": 42, "target": [0, 12, 0], "autoRotate": false }  // model
 *   { "yawDeg": 180, "pitchDeg": 0, "fovDeg": 75 }                                                 // panorama
 */
export type MediaAssetViewDefaults = {
  readonly yawDeg?: number;
  readonly pitchDeg?: number;
  readonly fovDeg?: number;
  readonly distance?: number;
  readonly target?: readonly [number, number, number];
  readonly autoRotate?: boolean;
};

// ── Record invariants ────────────────────────────────────────────────────────

/** The MediaAsset columns that carry invariants, independent of Prisma's generated types. */
export interface MediaAssetRecord {
  readonly id: string;
  readonly subjectType: MediaSubjectType;
  readonly propertyId: string | null;
  readonly projectSlug: string | null;
  readonly kind: MediaAssetKind;
  readonly format: MediaAssetFormat | null;
  readonly status: MediaAssetStatus;
  readonly storageKey: string | null;
  readonly entryFile: string | null;
  readonly contentHash: string | null;
  readonly mimeType: string | null;
  readonly sizeBytes: number | null;
  readonly fileCount: number | null;
  readonly posterKey: string | null;
  readonly altText: string | null;
  readonly sourceKey: string;
  readonly sourceSizeBytes: number;
  readonly sourceMimeType: string;
  readonly reviewedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly processingError: string | null;
}

/**
 * Returns every violated invariant (empty when valid). Covers the database CHECK
 * constraints in the add_media_asset migration, plus the storage-contract rules
 * the database only approximates: exact key layout, key/id agreement and MIME types.
 */
export function validateMediaAssetRecord(r: MediaAssetRecord): string[] {
  const problems: string[] = [];
  const problem = (message: string) => problems.push(message);

  if (!MEDIA_ID_PATTERN.test(r.id)) problem("id must be a media id (8–40 lowercase letters/digits); it is the {mediaId} key segment");

  // Subject
  if (r.subjectType === "PROPERTY") {
    if (!r.propertyId) problem("PROPERTY asset needs propertyId");
    if (r.projectSlug !== null) problem("PROPERTY asset must not have projectSlug");
  } else {
    if (!r.projectSlug) problem("PROJECT asset needs projectSlug");
    else if (!PROJECT_SLUG_PATTERN.test(r.projectSlug)) problem("projectSlug is not a project slug");
    if (r.propertyId !== null) problem("PROJECT asset must not have propertyId");
  }

  // Source original: private ingest upload or original, never a URL.
  const ownIngest = r.sourceKey.startsWith(`${INGEST_PREFIX}/${r.id}/`) && !r.sourceKey.split("/").some((s) => s === "" || s === "." || s === "..");
  const ownOriginal = ORIGINAL_KEY_PATTERN.test(r.sourceKey) && r.sourceKey.split("/")[1] === r.id;
  if (!ownIngest && !ownOriginal) problem(`sourceKey must be ${INGEST_PREFIX}/${r.id}/… or originals/${r.id}/…`);
  if (r.sourceSizeBytes < 0) problem("sourceSizeBytes must be non-negative");

  // Processed asset
  const processed = [r.format, r.storageKey, r.entryFile, r.contentHash, r.mimeType, r.sizeBytes, r.fileCount];
  if (PROCESSED_STATUSES.includes(r.status) && processed.some((v) => v === null)) {
    problem(`${r.status} asset needs format, storageKey, entryFile, contentHash, mimeType, sizeBytes and fileCount`);
  }
  if (r.format !== null && !FORMATS_BY_KIND[r.kind].includes(r.format)) problem(`${r.format} is not a ${r.kind} format`);
  if (r.storageKey !== null) {
    // m/{mediaId}/{versionHash}: the version hash identifies everything published, not only the entry file.
    const [prefix, mediaId, versionHash, ...rest] = r.storageKey.split("/");
    if (prefix !== "m" || mediaId !== r.id || !CONTENT_HASH_PATTERN.test(versionHash ?? "") || rest.length > 0) {
      problem(`storageKey must be m/${r.id}/{versionHash}`);
    }
    if (r.entryFile !== null) {
      const entryKey = `${r.storageKey}/${r.entryFile}`;
      if (!MEDIA_KEY_PATTERN.test(entryKey)) problem("entryFile must be a relative file name inside storageKey");
      else if (r.mimeType !== null && publishedObjectMetadata(entryKey)?.contentType !== r.mimeType) problem("mimeType does not match the entry file type");
    }
    if (r.posterKey !== null && (!r.posterKey.startsWith(`${r.storageKey}/`) || !publishedObjectMetadata(r.posterKey)?.contentType.startsWith("image/"))) {
      problem("posterKey must be an image key inside storageKey");
    }
  } else if (r.posterKey !== null) {
    problem("posterKey requires storageKey");
  }
  if (r.contentHash !== null && !SHA256_HEX.test(r.contentHash)) problem("contentHash must be a lowercase SHA-256 hex digest");
  if (r.sizeBytes !== null && r.sizeBytes < 0) problem("sizeBytes must be non-negative");
  if (r.fileCount !== null && r.fileCount < 1) problem("fileCount must be at least 1");

  // Outcomes
  if (r.status === "PUBLISHED" && (!r.reviewedAt || !r.publishedAt || !r.altText?.trim())) problem("PUBLISHED asset needs reviewedAt, publishedAt and altText");
  if (r.status === "REJECTED" && !r.rejectionReason) problem("REJECTED asset needs rejectionReason");
  if (r.status === "FAILED" && !r.processingError) problem("FAILED asset needs processingError");

  return problems;
}
