/**
 * The storage contract shared by the Next.js app (src/), the infrastructure and
 * edge function (infra/src/) and the offline media pipeline (infra/src/pipeline/).
 * It lives outside both so neither imports the other's implementation, and it must
 * stay dependency-free. Changing anything here changes what the CDN will serve, so
 * every rule is covered by infra/test/media-contract.test.ts.
 *
 * Published bucket layout:
 *
 *   m/{mediaId}/{contentHash}/{file}         immutable derivatives, served by the CDN
 *   lib/{library}/{version}/{file}           immutable decoders (Draco, Basis), served by the CDN
 *   originals/{mediaId}/{contentHash}/{file} private source files, never served by the CDN
 *   review/{mediaId}/{contentHash}/{file}    private processed files awaiting review, never served by the CDN
 *
 * A processed asset's files are written to review/ first. Only an admin approval
 * copies them (write-once) to the same path under m/, so nothing unreviewed is
 * ever reachable through the CDN.
 *
 * Ingest bucket layout:
 *
 *   uploads/{mediaId}/{uploadId}/{file}      temporary, expires automatically
 */

/** Prefixes CloudFront may read. `originals/` is deliberately absent. */
export const CDN_PREFIXES = ["m", "lib"] as const;

/** Every prefix that may exist in the published bucket. */
export const PUBLISHED_BUCKET_PREFIXES = ["m", "lib", "originals", "review"] as const;

/** Private staging for processed files until an admin approves them. Never CDN-served. */
export const REVIEW_PREFIX = "review";

/** Review copies are fetched only through short-lived presigned URLs and must never be cached. */
export const REVIEW_CACHE_CONTROL = "private, no-store";

export const INGEST_PREFIX = "uploads";

/** Cache-Control for every object under a CDN prefix. Keys are content-addressed, so this is safe. */
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Content types for published assets, keyed by lowercase extension. Anything not
 * listed is refused at the edge, so a mis-uploaded .html or .svg can never be served.
 */
export const PUBLISHED_CONTENT_TYPES: Readonly<Record<string, string>> = {
  glb: "model/gltf-binary",
  ktx2: "image/ktx2",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  sog: "application/zip",
  json: "application/json",
  wasm: "application/wasm",
};

/**
 * Decoder glue scripts are only valid under lib/. They exist because the Draco
 * and Basis decoders ship as a JS loader plus a .wasm binary.
 */
export const LIB_ONLY_CONTENT_TYPES: Readonly<Record<string, string>> = {
  js: "text/javascript",
};

/** mediaId: cuid-style lowercase id. contentHash: 16–64 lowercase hex characters of a SHA-256. */
const MEDIA_ID = "[a-z0-9]{8,40}";
const CONTENT_HASH = "[a-f0-9]{16,64}";
/** One or more safe path segments; no dot-only segments, no empty segments. */
const SAFE_SEGMENTS = "(?:[A-Za-z0-9_-][A-Za-z0-9._-]*/)*[A-Za-z0-9_-][A-Za-z0-9._-]*";
const LIB_NAME = "[a-z0-9-]{1,40}";
const LIB_VERSION = "[0-9A-Za-z.+-]{1,40}";

export const MEDIA_ID_PATTERN = new RegExp(`^${MEDIA_ID}$`);
export const CONTENT_HASH_PATTERN = new RegExp(`^${CONTENT_HASH}$`);

/**
 * Hex characters of the version hash used in object keys. The contract allows
 * 16–64; 16 (64 bits) is the Phase 2A choice, and the full SHA-256 is kept in metadata.
 */
export const CONTENT_HASH_KEY_LENGTH = 16;

export const MEDIA_KEY_PATTERN = new RegExp(`^m/${MEDIA_ID}/${CONTENT_HASH}/${SAFE_SEGMENTS}$`);
export const LIB_KEY_PATTERN = new RegExp(`^lib/${LIB_NAME}/${LIB_VERSION}/${SAFE_SEGMENTS}$`);
export const ORIGINAL_KEY_PATTERN = new RegExp(`^originals/${MEDIA_ID}/${CONTENT_HASH}/${SAFE_SEGMENTS}$`);
export const REVIEW_KEY_PATTERN = new RegExp(`^${REVIEW_PREFIX}/${MEDIA_ID}/${CONTENT_HASH}/${SAFE_SEGMENTS}$`);

export function extensionOf(key: string): string {
  const name = key.slice(key.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export type PublishedObjectMetadata = {
  readonly contentType: string;
  readonly cacheControl: string;
};

/**
 * Metadata a publisher must set when writing a CDN-served object. Returns null
 * for keys that are not valid CDN keys, so callers cannot publish outside the layout.
 */
export function publishedObjectMetadata(key: string): PublishedObjectMetadata | null {
  const ext = extensionOf(key);
  if (MEDIA_KEY_PATTERN.test(key)) {
    const contentType = PUBLISHED_CONTENT_TYPES[ext];
    return contentType ? { contentType, cacheControl: IMMUTABLE_CACHE_CONTROL } : null;
  }
  if (LIB_KEY_PATTERN.test(key)) {
    const contentType = PUBLISHED_CONTENT_TYPES[ext] ?? LIB_ONLY_CONTENT_TYPES[ext];
    return contentType ? { contentType, cacheControl: IMMUTABLE_CACHE_CONTROL } : null;
  }
  return null;
}

/** Metadata for a private review copy: the published content type, but never cacheable. */
export function reviewObjectMetadata(key: string): PublishedObjectMetadata | null {
  if (!REVIEW_KEY_PATTERN.test(key)) return null;
  const contentType = PUBLISHED_CONTENT_TYPES[extensionOf(key)];
  return contentType ? { contentType, cacheControl: REVIEW_CACHE_CONTROL } : null;
}

/** m/{mediaId}/{hash}/{file} → review/{mediaId}/{hash}/{file}: where a processed file waits for review. */
export function reviewKeyFor(publishedKey: string): string {
  if (!MEDIA_KEY_PATTERN.test(publishedKey)) throw new Error("Not a published media key");
  return `${REVIEW_PREFIX}/${publishedKey.slice("m/".length)}`;
}

/** review/{mediaId}/{hash}/{file} → m/{mediaId}/{hash}/{file}: where an approved file is published. */
export function publishedKeyFor(reviewKey: string): string {
  if (!REVIEW_KEY_PATTERN.test(reviewKey)) throw new Error("Not a review key");
  return `m/${reviewKey.slice(REVIEW_PREFIX.length + 1)}`;
}

/** The immutable version directory for one media item: m/{mediaId}/{keyHash}. */
export function mediaVersionPrefix(mediaId: string, keyHash: string): string {
  if (!MEDIA_ID_PATTERN.test(mediaId)) throw new Error(`Invalid mediaId "${mediaId}"`);
  if (!CONTENT_HASH_PATTERN.test(keyHash)) throw new Error(`Invalid content hash "${keyHash}"`);
  return `m/${mediaId}/${keyHash}`;
}

/** Extensions the edge function allows under m/ and lib/ respectively. */
export function edgeExtensionAllowlist(): { media: string[]; lib: string[] } {
  const media = Object.keys(PUBLISHED_CONTENT_TYPES).sort();
  const lib = [...media, ...Object.keys(LIB_ONLY_CONTENT_TYPES)].sort();
  return { media, lib };
}
