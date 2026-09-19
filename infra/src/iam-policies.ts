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
 * uploads, and verify a completed upload (POST /api/media/{id}/complete).
 *
 * Verification uses HeadObject, and S3 authorizes HeadObject (and GetObjectAttributes)
 * with s3:GetObject: there is no header-only permission. So the role can technically
 * read upload bodies under uploads/*, and only there. It still cannot list the
 * bucket (a missing key therefore answers 403, which the app treats as "verification
 * unavailable"), touch the published bucket, delete anything, or change infrastructure.
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
      sid: "VerifyIngestUploads",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [uploads],
    }),
  ];
}

/**
 * For the processing worker (Phase 5C, infra/src/processing). It reads verified
 * uploads, writes derived objects under m/ (write-once: the published bucket's
 * policy denies any PutObject without If-None-Match), and reads back an existing
 * m/ object to confirm a rerun found identical bytes. It cannot touch originals/
 * (the passthrough-v1 profile publishes the verified source byte-for-byte, so no
 * separate original is kept; a transforming profile must add it back explicitly),
 * write decoders under lib/, delete anything or list buckets. Queue access is a
 * separate policy in the processing stack.
 */
export function processorStatements(ingestBucketArn: string, publishedBucketArn: string): PolicyStatement[] {
  const uploads = objects(ingestBucketArn, INGEST_PREFIX);
  const derivatives = objects(publishedBucketArn, "m");
  return [
    new PolicyStatement({
      sid: "ReadIngestUploads",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [uploads],
    }),
    new PolicyStatement({
      sid: "WriteOncePublishedDerivatives",
      effect: Effect.ALLOW,
      actions: ["s3:PutObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      resources: [derivatives],
    }),
    new PolicyStatement({
      sid: "ReadBackPublishedDerivatives",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [derivatives],
    }),
  ];
}
