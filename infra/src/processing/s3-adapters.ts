import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { INGEST_SOURCE_KEY_PATTERN } from "../../../shared/media-asset";
import { MEDIA_KEY_PATTERN, publishedObjectMetadata } from "../../../shared/media-contract";
import type { ObjectPublisher } from "../pipeline/adapters";
import { sha256Hex } from "../pipeline/formats";
import { ImmutableObjectConflictError, RetryableProcessingError } from "./errors";
import type { SourceRead, SourceReader } from "./ports";

/**
 * S3 implementations of the worker's storage ports. Not deployed and not wired to
 * a runtime yet; tests drive them offline through a stub transport.
 *
 * IAM (processor policy, infra/src/iam-policies.ts): GetObject on ingest uploads/*,
 * PutObject + GetObject on published m/*. Nothing else: no listing, no deletes, no
 * originals/, no lib/.
 */

export interface S3AdapterConfig {
  readonly region: string;
  readonly bucket: string;
}

/** Test seams only; production passes nothing and uses the default credential chain. */
export interface S3AdapterOptions {
  readonly credentials?: { readonly accessKeyId: string; readonly secretAccessKey: string; readonly sessionToken?: string };
  readonly requestHandler?: S3ClientConfig["requestHandler"];
  readonly maxAttempts?: number;
}

function client(config: S3AdapterConfig, options: S3AdapterOptions): S3Client {
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

/**
 * GetObject with ChecksumMode ENABLED on one ingest source. The body is only read
 * when S3 reports exactly the verified length (at most the 100 MB single-PUT cap),
 * so a replaced or oversized object is never pulled into memory.
 */
export function createS3SourceReader(config: S3AdapterConfig, options: S3AdapterOptions = {}): SourceReader {
  const s3 = client(config, options);
  return {
    async read(key, expectedBytes): Promise<SourceRead> {
      if (!INGEST_SOURCE_KEY_PATTERN.test(key)) throw new Error("Refusing to read a key outside the ingest source layout");
      let response;
      try {
        response = await s3.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, ChecksumMode: "ENABLED" }));
      } catch (error) {
        if (httpStatusOf(error) === 404) return { status: "NOT_FOUND" };
        return { status: "UNAVAILABLE", reason: describe(error) };
      }
      const head = {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        checksumSha256: response.ChecksumSHA256,
        checksumType: response.ChecksumType,
        serverSideEncryption: response.ServerSideEncryption,
        contentEncoding: response.ContentEncoding,
        contentDisposition: response.ContentDisposition,
        cacheControl: response.CacheControl,
        metadata: response.Metadata,
      };
      if (response.ContentLength !== expectedBytes || !response.Body) {
        (response.Body as { destroy?: () => void } | undefined)?.destroy?.();
        return { status: "FOUND", head, bytes: null };
      }
      try {
        const bytes = await response.Body.transformToByteArray();
        return { status: "FOUND", head, bytes: bytes.length === expectedBytes ? bytes : null };
      } catch (error) {
        // The SDK validates the stored checksum while streaming; a mismatch is an integrity failure, not an outage.
        if (/checksum/i.test(error instanceof Error ? `${error.name} ${error.message}` : "")) return { status: "FOUND", head, bytes: null };
        return { status: "UNAVAILABLE", reason: describe(error) };
      }
    },
  };
}

/**
 * Write-once publisher for m/{mediaId}/{keyHash}/… objects. PutObject carries
 * If-None-Match: * (the published bucket's policy denies writes without it) and the
 * object's SHA-256, so S3 verifies the bytes. HTTP 412 means the key exists: it is
 * accepted only if the stored object is byte-identical (same SHA-256, size and type);
 * otherwise ImmutableObjectConflictError. Everything else transient is retryable.
 */
export function createS3ObjectPublisher(config: S3AdapterConfig, options: S3AdapterOptions = {}): ObjectPublisher {
  const s3 = client(config, options);
  return {
    async publish({ key, bytes, contentType, cacheControl, sha256 }) {
      const metadata = publishedObjectMetadata(key);
      if (!MEDIA_KEY_PATTERN.test(key) || !metadata) throw new Error("Refusing to publish outside m/{mediaId}/{contentHash}/");
      if (metadata.contentType !== contentType || metadata.cacheControl !== cacheControl) throw new Error("Refusing to publish with metadata the media contract does not assign");
      if (sha256Hex(bytes) !== sha256) throw new Error("Refusing to publish bytes that do not match their SHA-256");
      const checksum = Buffer.from(sha256, "hex").toString("base64");
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
      let existing;
      try {
        existing = await s3.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key, ChecksumMode: "ENABLED" }));
      } catch (error) {
        throw new RetryableProcessingError(`existing object check failed: ${describe(error)}`);
      }
      if (existing.ChecksumSHA256 === checksum && existing.ContentLength === bytes.length && existing.ContentType === contentType) return "exists";
      throw new ImmutableObjectConflictError("An immutable published key already holds different content");
    },
  };
}
