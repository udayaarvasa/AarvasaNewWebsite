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
import { CONTENT_HASH_PATTERN, INGEST_PREFIX, MEDIA_ID_PATTERN, MEDIA_KEY_PATTERN, ORIGINAL_KEY_PATTERN, PUBLISHED_CONTENT_TYPES, publishedObjectMetadata } from "./media-contract";

export const MEDIA_SUBJECT_TYPES = ["PROPERTY", "PROJECT"] as const;
export const MEDIA_ASSET_KINDS = ["MODEL", "PANORAMA", "SPLAT"] as const;
export const MEDIA_ASSET_FORMATS = ["GLB", "EQUIRECT_JPEG", "EQUIRECT_WEBP", "SOG"] as const;
/**
 * UPLOADED means an upload was authorised and the row exists; the source bytes have
 * NOT been verified or processed and may not exist yet. An UPLOADED asset is never
 * processed, published or viewer-ready.
 *
 * PROCESSING means the server has independently verified the ingest object against
 * the row (POST /api/media/{id}/complete: size, Content-Type, SHA-256) and the
 * asset is eligible for, or undergoing, processing. The committed PROCESSING row is
 * the processing handoff; Phase 5C owns dispatch and the worker. Nothing is
 * processed yet, so a PROCESSING asset is never viewer-ready either.
 *
 * Only PUBLISHED assets may be shown.
 */
export const MEDIA_ASSET_STATUSES = ["UPLOADED", "PROCESSING", "PENDING_REVIEW", "PUBLISHED", "REJECTED", "FAILED", "ARCHIVED"] as const;

/**
 * Why an asset is FAILED: MediaAsset.failureCode, set exactly when status is FAILED
 * (CHECK constraint MediaAsset_processing_check). Each maps to a generic user-facing
 * message in media-processing.ts; processingError keeps the internal diagnostic.
 * Every FAILED state is terminal: a new upload is required.
 */
export const MEDIA_FAILURE_CODES = [
  "UPLOAD_AUTHORIZATION_FAILED",
  "UPLOAD_EXPIRED",
  "UPLOAD_VERIFICATION_FAILED",
  "INVALID_SOURCE",
  "SOURCE_MISSING",
  "SOURCE_INTEGRITY_FAILED",
  "UNSUPPORTED_CONTENT",
  "VALIDATION_FAILED",
  "SIZE_LIMIT_EXCEEDED",
  "PROCESSING_TIMEOUT",
  "RETRIES_EXHAUSTED",
  "INTERNAL_ERROR",
] as const;

export type MediaSubjectType = (typeof MEDIA_SUBJECT_TYPES)[number];
export type MediaFailureCode = (typeof MEDIA_FAILURE_CODES)[number];
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

// ── Source formats and upload limits ─────────────────────────────────────────

/** Decimal megabytes, as in infra/src/media-budgets.ts. */
const MB = 1_000_000;

export interface MediaFormatSpec {
  readonly kind: MediaAssetKind;
  /** Extension used in object keys, e.g. uploads/{mediaId}/{uploadId}/source.jpg. */
  readonly keyExtension: string;
  /** Extensions accepted on a client filename (lowercase, without the dot). */
  readonly filenameExtensions: readonly string[];
  /** The only Content-Type an upload of this format is signed with. */
  readonly contentType: string;
  /**
   * MIME types a browser may report for the file. Browsers have no registered type
   * for .glb and .sog and usually send "" or application/octet-stream, so those are
   * accepted for GLB and SOG. The client value is never used as the signed type.
   */
  readonly clientMimeTypes: readonly string[];
}

export const MEDIA_FORMAT_SPECS: Readonly<Record<MediaAssetFormat, MediaFormatSpec>> = {
  GLB: {
    kind: "MODEL",
    keyExtension: "glb",
    filenameExtensions: ["glb"],
    contentType: PUBLISHED_CONTENT_TYPES.glb,
    clientMimeTypes: ["model/gltf-binary", "application/octet-stream", ""],
  },
  EQUIRECT_JPEG: {
    kind: "PANORAMA",
    keyExtension: "jpg",
    filenameExtensions: ["jpg", "jpeg"],
    contentType: PUBLISHED_CONTENT_TYPES.jpg,
    clientMimeTypes: ["image/jpeg"],
  },
  EQUIRECT_WEBP: {
    kind: "PANORAMA",
    keyExtension: "webp",
    filenameExtensions: ["webp"],
    contentType: PUBLISHED_CONTENT_TYPES.webp,
    clientMimeTypes: ["image/webp"],
  },
  SOG: {
    kind: "SPLAT",
    keyExtension: "sog",
    filenameExtensions: ["sog"],
    contentType: PUBLISHED_CONTENT_TYPES.sog,
    clientMimeTypes: ["application/zip", "application/x-zip-compressed", "application/octet-stream", ""],
  },
};

/**
 * Largest source file accepted per kind. The media pipeline's budgets
 * (infra/src/media-budgets.ts, BYTE_BUDGETS.*.sourceMax) read these values.
 */
export const SOURCE_MAX_BYTES: Readonly<Record<MediaAssetKind, number>> = {
  MODEL: 250 * MB,
  PANORAMA: 50 * MB,
  SPLAT: 80 * MB,
};

/**
 * Phase 5A signs one presigned PUT per upload. S3 accepts single PUTs up to 5 GiB,
 * but a browser request that large is unreliable, so this path stops at 100 MB.
 * Larger sources (models up to SOURCE_MAX_BYTES.MODEL) need multipart upload, a
 * Phase 5 follow-up; until then they are refused rather than attempted.
 */
export const SINGLE_PUT_UPLOAD_MAX_BYTES = 100 * MB;

/** Lifetime of a presigned upload. S3 rejects the URL after this. */
export const UPLOAD_INTENT_TTL_SECONDS = 10 * 60;

/**
 * At most this many upload intents per uploader created within the window, whatever
 * their status now: completing an upload (UPLOADED → PROCESSING) does not free a slot.
 */
export const UPLOAD_INTENT_QUOTA = { maxRecent: 20, windowSeconds: 24 * 60 * 60 } as const;

export const UPLOAD_TEXT_LIMITS = { filename: 255, title: 150, altText: 500 } as const;

/**
 * Canonical base64 of a 32-byte SHA-256 digest, as S3's x-amz-checksum-sha256 expects.
 * Every upload intent must declare one; it is signed as a header (never a query
 * parameter), so S3 rejects any body whose digest differs.
 */
export const SHA256_BASE64_PATTERN = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;

/**
 * How long after an intent's URL expires a completion may still find the object. S3
 * checks a presigned URL's expiry when the request starts, so a slow upload can
 * finish well after UPLOAD_INTENT_TTL_SECONDS. Past createdAt + TTL + grace, a
 * missing object can never arrive and the asset is marked FAILED on completion.
 *
 * The ingest bucket's lifecycle rule (7 days after object creation, infra config)
 * is the ultimate retention boundary for every source, completed or not.
 */
export const UPLOAD_COMPLETION_GRACE_SECONDS = 60 * 60;

/** The last moment a completion may report a missing object as "not received yet". */
export function uploadCompletionDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + (UPLOAD_INTENT_TTL_SECONDS + UPLOAD_COMPLETION_GRACE_SECONDS) * 1000);
}

/** Statuses that are only reachable after a successful completion; completing again is a no-op. */
export const COMPLETED_UPLOAD_STATUSES: readonly MediaAssetStatus[] = ["PROCESSING", "PENDING_REVIEW", "PUBLISHED", "REJECTED"];
/** Statuses that can never be completed. */
export const NOT_COMPLETABLE_STATUSES: readonly MediaAssetStatus[] = ["FAILED", "ARCHIVED"];

/** Server-generated upload attempt id: the {uploadId} key segment. */
export const UPLOAD_ID_PATTERN = /^[a-z0-9]{16,64}$/;

/** uploads/{mediaId}/{uploadId}/source.{ext}: the only key shape an upload intent issues. */
export const INGEST_SOURCE_KEY_PATTERN = new RegExp(
  `^${INGEST_PREFIX}/[a-z0-9]{8,40}/[a-z0-9]{16,64}/source\\.(${[...new Set(Object.values(MEDIA_FORMAT_SPECS).map((s) => s.keyExtension))].join("|")})$`,
);

/** Builds the ingest key for a source upload. Every segment is server-generated; no client input reaches it. */
export function buildIngestSourceKey(mediaId: string, uploadId: string, format: MediaAssetFormat): string {
  if (!MEDIA_ID_PATTERN.test(mediaId)) throw new Error("Invalid media id");
  if (!UPLOAD_ID_PATTERN.test(uploadId)) throw new Error("Invalid upload id");
  return `${INGEST_PREFIX}/${mediaId}/${uploadId}/source.${MEDIA_FORMAT_SPECS[format].keyExtension}`;
}

export type UploadSourceCheck =
  | { readonly ok: true; readonly contentType: string }
  | { readonly ok: false; readonly status: 400 | 413; readonly error: string };

/** Validates what a client declares about a source file before any upload is authorised. */
export function checkUploadSource(source: {
  readonly kind: MediaAssetKind;
  readonly expectedFormat: MediaAssetFormat;
  readonly filename: string;
  readonly sourceSizeBytes: number;
  readonly sourceMimeType?: string;
}): UploadSourceCheck {
  const spec = MEDIA_FORMAT_SPECS[source.expectedFormat];
  if (!FORMATS_BY_KIND[source.kind].includes(source.expectedFormat) || spec.kind !== source.kind) {
    return { ok: false, status: 400, error: `${source.expectedFormat} is not a ${source.kind} format` };
  }
  const dot = source.filename.lastIndexOf(".");
  const extension = dot > 0 ? source.filename.slice(dot + 1).toLowerCase() : "";
  if (!spec.filenameExtensions.includes(extension)) {
    return { ok: false, status: 400, error: `filename must end in .${spec.filenameExtensions.join(" or .")} for ${source.expectedFormat}` };
  }
  if (source.sourceMimeType !== undefined && !spec.clientMimeTypes.includes(source.sourceMimeType.toLowerCase())) {
    return { ok: false, status: 400, error: `sourceMimeType is not valid for ${source.expectedFormat}` };
  }
  if (!Number.isSafeInteger(source.sourceSizeBytes) || source.sourceSizeBytes <= 0) {
    return { ok: false, status: 400, error: "sourceSizeBytes must be a positive integer" };
  }
  if (source.sourceSizeBytes > SOURCE_MAX_BYTES[source.kind]) {
    return { ok: false, status: 413, error: `${source.kind} sources are limited to ${SOURCE_MAX_BYTES[source.kind] / MB} MB` };
  }
  if (source.sourceSizeBytes > SINGLE_PUT_UPLOAD_MAX_BYTES) {
    return { ok: false, status: 413, error: `Uploads larger than ${SINGLE_PUT_UPLOAD_MAX_BYTES / MB} MB are not supported yet` };
  }
  return { ok: true, contentType: spec.contentType };
}

// ── Upload completion: source key and object verification ───────────────────

/** The row fields a completion verifies against. All of them were written by the server at intent time. */
export interface CompletableSource {
  readonly id: string;
  readonly kind: MediaAssetKind;
  readonly sourceKey: string;
  readonly sourceSizeBytes: number;
  readonly sourceMimeType: string;
  readonly sourceChecksumSha256: string | null;
}

/**
 * Why a row cannot be verified at all, or null when it is consistent with the Phase 5A
 * contract. The key is never repaired or reconstructed: only the stored key is inspected.
 */
export function checkCompletableSource(row: CompletableSource): string | null {
  if (!INGEST_SOURCE_KEY_PATTERN.test(row.sourceKey)) return "sourceKey is not an ingest source key";
  const [, mediaId, , file] = row.sourceKey.split("/");
  if (mediaId !== row.id) return "sourceKey belongs to another media asset";
  const extension = file.slice(file.lastIndexOf(".") + 1);
  const spec = Object.values(MEDIA_FORMAT_SPECS).find((s) => s.keyExtension === extension && s.kind === row.kind);
  if (!spec) return "sourceKey extension does not match the asset kind";
  if (spec.contentType !== row.sourceMimeType) return "sourceMimeType does not match the sourceKey format";
  if (!Number.isSafeInteger(row.sourceSizeBytes) || row.sourceSizeBytes <= 0 || row.sourceSizeBytes > SINGLE_PUT_UPLOAD_MAX_BYTES) {
    return "sourceSizeBytes is outside the single-PUT upload range";
  }
  if (row.sourceChecksumSha256 === null) return "sourceChecksumSha256 is missing";
  if (!SHA256_BASE64_PATTERN.test(row.sourceChecksumSha256)) return "sourceChecksumSha256 is not canonical base64 SHA-256";
  return null;
}

/** Server-side encryption every ingest object carries (the bucket default, SSE-S3). */
export const INGEST_SERVER_SIDE_ENCRYPTION = "AES256";

/** What HeadObject (ChecksumMode ENABLED) reports about an ingest object. ETag is deliberately absent. */
export interface IngestObjectHead {
  readonly contentLength?: number;
  readonly contentType?: string;
  readonly checksumSha256?: string;
  readonly checksumType?: string;
  readonly serverSideEncryption?: string;
  readonly contentEncoding?: string;
  readonly contentDisposition?: string;
  readonly cacheControl?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export type IngestObjectMismatch =
  | "content-length"
  | "content-type"
  | "checksum-missing"
  | "checksum"
  | "checksum-type"
  | "content-encoding"
  | "content-disposition"
  | "cache-control"
  | "metadata";

export type IngestObjectVerdict =
  | { readonly ok: true }
  /** The object is not the bytes that were authorised. Terminal for the asset. */
  | { readonly ok: false; readonly outcome: "MISMATCH"; readonly mismatch: IngestObjectMismatch }
  /** The object looks right but the bucket does not: configuration drift, never the uploader's fault. */
  | { readonly ok: false; readonly outcome: "MISCONFIGURED"; readonly problem: "server-side-encryption" };

const isBlank = (value: string | undefined) => value === undefined || value === "";

/**
 * Compares an ingest object with the row it was authorised for. Pure: no AWS, no
 * database. The SHA-256 is compared as the exact canonical base64 string S3 returns
 * and the intent stored (both are canonical, so no conversion is involved). ETag is
 * never used for integrity: it is not a SHA-256 and not even an MD5 for every upload.
 */
export function verifyIngestObject(expected: CompletableSource, head: IngestObjectHead): IngestObjectVerdict {
  const mismatch = (m: IngestObjectMismatch): IngestObjectVerdict => ({ ok: false, outcome: "MISMATCH", mismatch: m });
  if (head.contentLength !== expected.sourceSizeBytes) return mismatch("content-length");
  if (head.contentType !== expected.sourceMimeType) return mismatch("content-type");
  if (isBlank(head.checksumSha256)) return mismatch("checksum-missing");
  if (expected.sourceChecksumSha256 === null || head.checksumSha256 !== expected.sourceChecksumSha256) return mismatch("checksum");
  if (head.checksumType !== undefined && head.checksumType !== "FULL_OBJECT") return mismatch("checksum-type");
  if (!isBlank(head.contentEncoding)) return mismatch("content-encoding");
  if (!isBlank(head.contentDisposition)) return mismatch("content-disposition");
  if (!isBlank(head.cacheControl)) return mismatch("cache-control");
  if (head.metadata !== undefined && Object.keys(head.metadata).length > 0) return mismatch("metadata");
  if (head.serverSideEncryption !== INGEST_SERVER_SIDE_ENCRYPTION) return { ok: false, outcome: "MISCONFIGURED", problem: "server-side-encryption" };
  return { ok: true };
}

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
  /** Canonical base64 SHA-256 the uploader declared and S3 enforced; null for sources not uploaded through an intent. */
  readonly sourceChecksumSha256: string | null;
  readonly reviewedAt: Date | null;
  readonly publishedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly processingError: string | null;
  /** Absent means null. Set exactly when status is FAILED. */
  readonly failureCode?: string | null;
  /** Absent means null. Required while PROCESSING. */
  readonly processingStartedAt?: Date | null;
  /** Absent means null. Only a PROCESSING asset may hold a lease. */
  readonly processingLeaseExpiresAt?: Date | null;
  /** Absent means 0. */
  readonly processingAttempts?: number;
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
  if (r.sourceChecksumSha256 !== null && !SHA256_BASE64_PATTERN.test(r.sourceChecksumSha256)) {
    problem("sourceChecksumSha256 must be a canonical base64 SHA-256 digest (not hex, not contentHash)");
  }

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

  // Processing (mirrors MediaAsset_processing_check)
  const failureCode = r.failureCode ?? null;
  if ((r.status === "FAILED") !== (failureCode !== null)) problem("failureCode is required exactly when status is FAILED");
  if (failureCode !== null && !(MEDIA_FAILURE_CODES as readonly string[]).includes(failureCode)) problem(`failureCode ${failureCode} is not a known failure code`);
  if (r.status === "PROCESSING" && !r.processingStartedAt) problem("PROCESSING asset needs processingStartedAt");
  if ((r.processingLeaseExpiresAt ?? null) !== null && r.status !== "PROCESSING") problem("only a PROCESSING asset may hold a processing lease");
  if ((r.processingAttempts ?? 0) < 0 || !Number.isInteger(r.processingAttempts ?? 0)) problem("processingAttempts must be a non-negative integer");

  return problems;
}
