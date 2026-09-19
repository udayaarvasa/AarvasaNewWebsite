import { GetObjectCommand, S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";
import { INGEST_SOURCE_KEY_PATTERN } from "../../../shared/media-asset";
import { createWriteOncePublisher } from "../../../src/lib/media/published-storage";
import type { ObjectPublisher } from "../pipeline/adapters";
import type { SourceRead, SourceReader } from "./ports";

/**
 * S3 implementations of the worker's storage ports. Not deployed and not wired to
 * a runtime yet; tests drive them offline through a stub transport.
 *
 * IAM (processor policy, infra/src/iam-policies.ts): GetObject on ingest uploads/*,
 * PutObject + GetObject on published review/*. Nothing else: no m/, no listing, no
 * deletes, no originals/, no lib/.
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
 * Write-once publisher (src/lib/media/published-storage.ts, shared with the admin
 * publication path). The worker uses it for review/ copies only; its IAM policy
 * cannot write m/.
 */
export function createS3ObjectPublisher(config: S3AdapterConfig, options: S3AdapterOptions = {}): ObjectPublisher {
  return createWriteOncePublisher(config, options);
}
