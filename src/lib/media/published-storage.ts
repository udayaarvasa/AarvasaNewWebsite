import { createHash } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  IMMUTABLE_CACHE_CONTROL,
  MEDIA_KEY_PATTERN,
  publishedKeyFor,
  publishedObjectMetadata,
  REVIEW_KEY_PATTERN,
  reviewObjectMetadata,
} from "../../../shared/media-contract";

/**
 * Server-side access to the published media bucket (never imported by client code).
 *
 *   review/{mediaId}/{hash}/{file}   private: written by the processing worker, previewed by admins
 *   m/{mediaId}/{hash}/{file}        CDN-served: written only when an admin approves
 *
 * Every write is write-once (If-None-Match: * plus the object's SHA-256); an
 * existing key is accepted only when it already holds byte-identical content.
 * Used by the worker (review copies, infra/src/processing) and by the admin review
 * API (preview URLs and publication), under separate IAM policies.
 */

export interface PublishedStorageConfig {
  readonly region: string;
  readonly bucket: string;
}

/** Test seams only; production passes nothing and uses the default credential chain. */
export interface PublishedStorageOptions {
  readonly credentials?: { readonly accessKeyId: string; readonly secretAccessKey: string; readonly sessionToken?: string };
  readonly requestHandler?: S3ClientConfig["requestHandler"];
  readonly maxAttempts?: number;
}

/** Transient: S3 5xx/throttling/network/permissions, a conditional-write conflict. */
export class RetryableProcessingError extends Error {
  override readonly name = "RetryableProcessingError";
}

/** Permanent: an immutable key already holds different bytes (a bug or tampering, never retried). */
export class ImmutableObjectConflictError extends Error {
  override readonly name = "ImmutableObjectConflictError";
}

/** Permanent for this attempt: the review copy no longer exists (expired or never written). */
export class ReviewCopyMissingError extends Error {
  override readonly name = "ReviewCopyMissingError";
}

export interface WriteOncePublisher {
  publish(object: { key: string; bytes: Uint8Array; contentType: string; cacheControl: string; sha256: string }): Promise<"created" | "exists">;
}

export interface ReviewAccess {
  /** Whether a review copy exists (HEAD). Review keys only. */
  exists(reviewKey: string): Promise<boolean>;
  /** Short-lived presigned GET for one review copy. Review keys only; never sources or originals. */
  presignGet(reviewKey: string, expiresInSeconds: number): Promise<string>;
  /**
   * Streams a review copy to its m/ key, write-once. When `expectedSha256Hex` is
   * given (the entry file's contentHash), the review copy must carry exactly that
   * SHA-256. Returns "exists" when the m/ object is already identical.
   */
  publish(reviewKey: string, expectedSha256Hex: string | null): Promise<"created" | "exists">;
}

/** The longest a preview URL may live. */
export const REVIEW_PREVIEW_MAX_SECONDS = 300;

const REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d$/;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/** MEDIA_REGION and MEDIA_PUBLISHED_BUCKET, or null when missing or malformed (fail closed). */
export function readPublishedStorageConfig(env: Readonly<Record<string, string | undefined>> = process.env): PublishedStorageConfig | null {
  const region = env.MEDIA_REGION?.trim();
  const bucket = env.MEDIA_PUBLISHED_BUCKET?.trim();
  if (!region || !bucket || !REGION_PATTERN.test(region) || !BUCKET_PATTERN.test(bucket)) return null;
  return { region, bucket };
}

function client(config: PublishedStorageConfig, options: PublishedStorageOptions): S3Client {
  return new S3Client({
    region: config.region,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    ...(options.credentials ? { credentials: options.credentials } : {}),
    ...(options.requestHandler ? { requestHandler: options.requestHandler } : {}),
    ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
  });
}

const httpStatusOf = (error: unknown) => (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
const describe = (error: unknown) => {
  const status = httpStatusOf(error);
  const name = error instanceof Error ? error.name : "UnknownError";
  return status ? `${name} (HTTP ${status})` : name;
};
const hexToBase64 = (hex: string) => Buffer.from(hex, "hex").toString("base64");

/** Metadata the contract assigns to a key under m/ (CDN) or review/ (private), or null. */
function contractMetadata(key: string) {
  if (MEDIA_KEY_PATTERN.test(key)) return publishedObjectMetadata(key);
  if (REVIEW_KEY_PATTERN.test(key)) return reviewObjectMetadata(key);
  return null;
}

async function confirmExisting(s3: S3Client, bucket: string, key: string, checksum: string, length: number, contentType: string): Promise<"exists"> {
  let existing;
  try {
    existing = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key, ChecksumMode: "ENABLED" }));
  } catch (error) {
    throw new RetryableProcessingError(`existing object check failed: ${describe(error)}`);
  }
  if (existing.ChecksumSHA256 === checksum && existing.ContentLength === length && existing.ContentType === contentType) return "exists";
  throw new ImmutableObjectConflictError("An immutable key already holds different content");
}

/** Write-once PutObject for m/… and review/… keys, with the metadata the contract assigns. */
export function createWriteOncePublisher(config: PublishedStorageConfig, options: PublishedStorageOptions = {}): WriteOncePublisher {
  const s3 = client(config, options);
  return {
    async publish({ key, bytes, contentType, cacheControl, sha256 }) {
      const metadata = contractMetadata(key);
      if (!metadata) throw new Error("Refusing to publish outside m/ or review/{mediaId}/{contentHash}/");
      if (metadata.contentType !== contentType || metadata.cacheControl !== cacheControl) throw new Error("Refusing to publish with metadata the media contract does not assign");
      if (createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("Refusing to publish bytes that do not match their SHA-256");
      const checksum = hexToBase64(sha256);
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: bytes,
            ContentLength: bytes.length,
            ContentType: contentType,
            CacheControl: cacheControl,
            ChecksumSHA256: checksum,
            IfNoneMatch: "*",
          }),
        );
        return "created";
      } catch (error) {
        if (httpStatusOf(error) !== 412) throw new RetryableProcessingError(`publish failed: ${describe(error)}`);
      }
      return confirmExisting(s3, config.bucket, key, checksum, bytes.length, contentType);
    },
  };
}

export function createReviewAccess(config: PublishedStorageConfig, options: PublishedStorageOptions = {}): ReviewAccess {
  const s3 = client(config, options);
  return {
    async exists(reviewKey) {
      if (!REVIEW_KEY_PATTERN.test(reviewKey)) throw new Error("Refusing to inspect a key outside review/");
      try {
        await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: reviewKey }));
        return true;
      } catch (error) {
        if (httpStatusOf(error) === 404) return false;
        throw new RetryableProcessingError(`review copy check failed: ${describe(error)}`);
      }
    },

    async presignGet(reviewKey, expiresInSeconds) {
      if (!REVIEW_KEY_PATTERN.test(reviewKey) || !reviewObjectMetadata(reviewKey)) throw new Error("Refusing to presign a key outside review/");
      if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0 || expiresInSeconds > REVIEW_PREVIEW_MAX_SECONDS) throw new Error("Invalid preview lifetime");
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.bucket, Key: reviewKey, ResponseCacheControl: "private, no-store" }), { expiresIn: expiresInSeconds });
    },

    async publish(reviewKey, expectedSha256Hex) {
      if (!REVIEW_KEY_PATTERN.test(reviewKey)) throw new Error("Refusing to publish from outside review/");
      const target = publishedKeyFor(reviewKey);
      const metadata = publishedObjectMetadata(target);
      if (!metadata) throw new Error("Refusing to publish a key the CDN contract does not allow");

      let source;
      try {
        source = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: reviewKey, ChecksumMode: "ENABLED" }));
      } catch (error) {
        if (httpStatusOf(error) === 404) throw new ReviewCopyMissingError("The review copy no longer exists");
        throw new RetryableProcessingError(`review copy unavailable: ${describe(error)}`);
      }
      const body = source.Body as (NonNullable<typeof source.Body> & { destroy?: () => void }) | undefined;
      const checksum = source.ChecksumSHA256;
      const length = source.ContentLength;
      if (!body || !checksum || typeof length !== "number" || source.ContentType !== metadata.contentType || (expectedSha256Hex !== null && checksum !== hexToBase64(expectedSha256Hex))) {
        body?.destroy?.();
        throw new ImmutableObjectConflictError("The review copy does not match the processed asset");
      }
      try {
        // Streamed: S3 verifies the SHA-256 of what arrives against the review copy's checksum.
        await s3.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: target,
            Body: body,
            ContentLength: length,
            ContentType: metadata.contentType,
            CacheControl: IMMUTABLE_CACHE_CONTROL,
            ChecksumSHA256: checksum,
            IfNoneMatch: "*",
          }),
        );
        return "created";
      } catch (error) {
        body.destroy?.();
        if (httpStatusOf(error) !== 412) throw new RetryableProcessingError(`publish failed: ${describe(error)}`);
      }
      return confirmExisting(s3, config.bucket, target, checksum, length, metadata.contentType);
    },
  };
}

let cached: { readonly key: string; readonly access: ReviewAccess } | null = null;

/** Review access for the current environment, or null when media publishing is not configured. */
export function getReviewAccess(env: Readonly<Record<string, string | undefined>> = process.env): ReviewAccess | null {
  const config = readPublishedStorageConfig(env);
  if (!config) return null;
  const key = `${config.region}/${config.bucket}`;
  if (cached?.key !== key) cached = { key, access: createReviewAccess(config) };
  return cached.access;
}
