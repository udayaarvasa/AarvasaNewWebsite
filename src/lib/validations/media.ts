import { z } from "zod";
import {
  MEDIA_ASSET_FORMATS,
  MEDIA_ASSET_KINDS,
  PROJECT_SLUG_PATTERN,
  SHA256_BASE64_PATTERN,
  UPLOAD_TEXT_LIMITS,
} from "../../../shared/media-asset";

// Control characters and path separators have no place in a display name.
const UNSAFE_FILENAME = /[\u0000-\u001f\u007f/\\]/;

/**
 * Fields shared by both subjects. Security-sensitive values (ids, keys, bucket,
 * uploader, status, origin) are deliberately absent: the objects are strict, so
 * sending any of them is a 400, and the server derives them all.
 */
const sourceFields = {
  kind: z.enum(MEDIA_ASSET_KINDS),
  expectedFormat: z.enum(MEDIA_ASSET_FORMATS),
  /** Display and extension check only. Never part of an object key. */
  filename: z
    .string()
    .min(1)
    .max(UPLOAD_TEXT_LIMITS.filename)
    .refine((name) => !UNSAFE_FILENAME.test(name), "filename contains invalid characters"),
  sourceSizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  /** As reported by the browser; checked against the format but never signed. */
  sourceMimeType: z.string().max(127).optional(),
  /**
   * Required base64 SHA-256 of the file. Signed as the x-amz-checksum-sha256 header,
   * so S3 accepts only these exact bytes, including on a repeated PUT of the same URL.
   */
  sha256: z.string().regex(SHA256_BASE64_PATTERN, "sha256 must be a base64 SHA-256 digest"),
  title: z.string().trim().min(1).max(UPLOAD_TEXT_LIMITS.title).optional(),
  altText: z.string().trim().min(1).max(UPLOAD_TEXT_LIMITS.altText).optional(),
};

// POST /api/media/upload-intent
export const uploadIntentSchema = z.discriminatedUnion("subjectType", [
  z.strictObject({
    subjectType: z.literal("PROPERTY"),
    propertyId: z.string().min(1).max(191).regex(/^[A-Za-z0-9_-]+$/, "Invalid propertyId"),
    ...sourceFields,
  }),
  z.strictObject({
    subjectType: z.literal("PROJECT"),
    projectSlug: z.string().min(1).max(100).regex(PROJECT_SLUG_PATTERN, "Invalid projectSlug"),
    ...sourceFields,
  }),
]);

export type UploadIntentInput = z.infer<typeof uploadIntentSchema>;
