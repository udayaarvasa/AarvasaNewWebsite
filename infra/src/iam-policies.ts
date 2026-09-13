import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { INGEST_PREFIX } from "../../shared/media-contract";

/**
 * Least-privilege policy documents for future workloads. They are created as
 * standalone managed policies and are NOT attached to any role in this phase.
 *
 * Both take bucket ARNs rather than bucket objects so tests can inspect exactly
 * what would be granted.
 */

const objects = (bucketArn: string, prefix: string) => `${bucketArn}/${prefix}/*`;

/**
 * For the Amplify SSR compute role, once upload intents exist (a later phase).
 *
 * Presigned URLs carry the signer's permissions, so the role needs PutObject on
 * the upload prefix to issue them. It can abort and inspect its own multipart
 * uploads, and read object attributes (size, checksum) to verify a completed
 * upload, but it cannot read object bodies, touch the published bucket, delete
 * anything, or change infrastructure.
 */
export function appUploadIntentStatements(ingestBucketArn: string): PolicyStatement[] {
  const uploads = objects(ingestBucketArn, INGEST_PREFIX);
  return [
    new PolicyStatement({
      sid: "PresignAndCompleteIngestUploads",
      effect: Effect.ALLOW,
      actions: ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      resources: [uploads],
    }),
    new PolicyStatement({
      sid: "InspectIngestUploadAttributes",
      effect: Effect.ALLOW,
      actions: ["s3:GetObjectAttributes"],
      resources: [uploads],
    }),
  ];
}

/**
 * For the future processing worker. Reads uploads, writes derivatives and
 * originals (write-once, enforced by the published bucket's policy), and reads
 * back what it wrote for verification. It cannot write decoders under lib/,
 * delete objects, or list buckets.
 */
export function processorStatements(ingestBucketArn: string, publishedBucketArn: string): PolicyStatement[] {
  const uploads = objects(ingestBucketArn, INGEST_PREFIX);
  const derivatives = objects(publishedBucketArn, "m");
  const originals = objects(publishedBucketArn, "originals");
  return [
    new PolicyStatement({
      sid: "ReadIngestUploads",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [uploads],
    }),
    new PolicyStatement({
      sid: "WritePublishedDerivativesAndOriginals",
      effect: Effect.ALLOW,
      actions: ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      resources: [derivatives, originals],
    }),
    new PolicyStatement({
      sid: "ReadBackPublishedObjects",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [derivatives, originals],
    }),
  ];
}
