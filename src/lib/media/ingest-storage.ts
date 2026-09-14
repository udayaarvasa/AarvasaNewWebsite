import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { INGEST_SOURCE_KEY_PATTERN, SHA256_BASE64_PATTERN, UPLOAD_INTENT_TTL_SECONDS } from "../../../shared/media-asset";

/**
 * Server-side signing for direct browser uploads to the media ingest bucket.
 *
 * Only the upload-intent route imports this. It reads server-only configuration
 * (never NEXT_PUBLIC_), hard-codes no bucket, region or credentials, and uses the
 * AWS SDK's default credential chain (an environment/profile locally, the compute
 * role when deployed). A presigned URL carries the signer's permissions, so the
 * signing identity should hold only the app-upload-intents policy
 * (ingest uploads/* only).
 */

export interface IngestStorageConfig {
  readonly region: string;
  readonly bucket: string;
}

const REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d$/;
const BUCKET_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

/** MEDIA_REGION and MEDIA_INGEST_BUCKET, or null when either is missing or malformed (fail closed). */
export function readIngestStorageConfig(env: Readonly<Record<string, string | undefined>> = process.env): IngestStorageConfig | null {
  const region = env.MEDIA_REGION?.trim();
  const bucket = env.MEDIA_INGEST_BUCKET?.trim();
  if (!region || !bucket || !REGION_PATTERN.test(region) || !BUCKET_PATTERN.test(bucket)) return null;
  return { region, bucket };
}

export interface SignUploadRequest {
  readonly key: string;
  readonly contentType: string;
  readonly contentLength: number;
  /** Required. Signed as the x-amz-checksum-sha256 header. */
  readonly sha256: string;
  readonly expiresInSeconds: number;
}

export interface SignedUpload {
  readonly method: "PUT";
  readonly url: string;
  /** Headers the browser must send exactly; they are part of the signature. */
  readonly headers: Readonly<Record<string, string>>;
}

export interface UploadSigner {
  /** Resolves credentials before anything is written, so misconfiguration fails before a row exists. */
  prepare(): Promise<void>;
  sign(request: SignUploadRequest): Promise<SignedUpload>;
}

type Credentials = { readonly accessKeyId: string; readonly secretAccessKey: string; readonly sessionToken?: string };

/**
 * Presigned PUT bound to one bucket, one generated key, the canonical Content-Type,
 * the exact Content-Length and the SHA-256 of the bytes.
 */
export function createIngestUploadSigner(config: IngestStorageConfig, options: { credentials?: Credentials } = {}): UploadSigner {
  const client = new S3Client({
    region: config.region,
    // The SDK's default ("when supported") presigns a CRC32 of an empty body into the
    // URL, which breaks every upload. Only checksums we set explicitly are signed.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    ...(options.credentials ? { credentials: options.credentials } : {}),
  });

  return {
    async prepare() {
      await client.config.credentials();
    },

    async sign({ key, contentType, contentLength, sha256, expiresInSeconds }) {
      if (!INGEST_SOURCE_KEY_PATTERN.test(key)) throw new Error("Refusing to sign a key outside the ingest source layout");
      if (!Number.isSafeInteger(contentLength) || contentLength <= 0) throw new Error("Invalid content length");
      if (typeof sha256 !== "string" || !SHA256_BASE64_PATTERN.test(sha256)) throw new Error("A valid SHA-256 is required");
      if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0 || expiresInSeconds > UPLOAD_INTENT_TTL_SECONDS) {
        throw new Error("Invalid expiry");
      }

      const command = new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
        ChecksumSHA256: sha256,
      });
      const url = await getSignedUrl(client, command, {
        expiresIn: expiresInSeconds,
        // The presigner leaves Content-Type unsigned by default; signing it pins the type.
        signableHeaders: new Set(["content-type", "content-length"]),
        // Kept as a signed header rather than a query parameter so S3 verifies the body against it.
        unhoistableHeaders: new Set(["x-amz-checksum-sha256"]),
      });

      // Fail closed if an SDK change ever stops signing what this upload relies on.
      const params = new URL(url).searchParams;
      const signed = new Set((params.get("X-Amz-SignedHeaders") ?? "").split(";"));
      const required = ["host", "content-type", "content-length", "x-amz-checksum-sha256"];
      if (!required.every((header) => signed.has(header))) throw new Error("Presigned URL is missing required signed headers");
      if ([...params.keys()].some((name) => /^x-amz-(sdk-)?checksum-/i.test(name))) throw new Error("Presigned URL carries an unexpected checksum parameter");

      return {
        method: "PUT",
        url,
        headers: { "Content-Type": contentType, "x-amz-checksum-sha256": sha256 },
      };
    },
  };
}

let cachedSigner: { readonly configKey: string; readonly signer: UploadSigner } | null = null;

/** The signer for the current environment, or null when media uploads are not configured. */
export function getIngestUploadSigner(env: Readonly<Record<string, string | undefined>> = process.env): UploadSigner | null {
  const config = readIngestStorageConfig(env);
  if (!config) return null;
  const configKey = `${config.region}/${config.bucket}`;
  if (cachedSigner?.configKey !== configKey) cachedSigner = { configKey, signer: createIngestUploadSigner(config) };
  return cachedSigner.signer;
}
