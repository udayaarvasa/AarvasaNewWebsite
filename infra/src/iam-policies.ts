import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { INGEST_PREFIX, REVIEW_PREFIX } from "../../shared/media-contract";

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
 * For the processing worker (infra/src/processing, Lambda in the processing stack).
 * It reads verified uploads and writes processed files to the private review/
 * prefix (write-once: the published bucket's policy denies any PutObject without
 * If-None-Match), reading back an existing review/ object to confirm a rerun found
 * identical bytes. It cannot write m/ (only an admin approval publishes), touch
 * originals/ (passthrough-v1 keeps no separate original), write decoders under
 * lib/, delete anything or list buckets. Queue access is a separate policy.
 */
export function processorStatements(ingestBucketArn: string, publishedBucketArn: string): PolicyStatement[] {
  const uploads = objects(ingestBucketArn, INGEST_PREFIX);
  const review = objects(publishedBucketArn, REVIEW_PREFIX);
  return [
    new PolicyStatement({
      sid: "ReadIngestUploads",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [uploads],
    }),
    new PolicyStatement({
      sid: "WriteOnceReviewCopies",
      effect: Effect.ALLOW,
      actions: ["s3:PutObject"],
      resources: [review],
    }),
    new PolicyStatement({
      sid: "ReadBackReviewCopies",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [review],
    }),
  ];
}

/**
 * For the Amplify SSR compute role, next to app-upload-intents: admin review.
 * Presigned preview GETs of review/ copies (5-minute URLs), and publication on
 * approval: read the review copy and write it once to the same path under m/
 * (PutObject with If-None-Match and the SHA-256, streamed, never buffered), reading
 * back an existing m/ object to confirm an idempotent re-publish. No originals/,
 * lib/, ingest, deletes or listing.
 */
export function appMediaReviewStatements(publishedBucketArn: string): PolicyStatement[] {
  const review = objects(publishedBucketArn, REVIEW_PREFIX);
  const media = objects(publishedBucketArn, "m");
  return [
    new PolicyStatement({
      sid: "ReadReviewCopies",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [review],
    }),
    new PolicyStatement({
      sid: "PublishApprovedMediaWriteOnce",
      effect: Effect.ALLOW,
      actions: ["s3:PutObject"],
      resources: [media],
    }),
    new PolicyStatement({
      sid: "ReadBackPublishedMedia",
      effect: Effect.ALLOW,
      actions: ["s3:GetObject", "s3:GetObjectAttributes"],
      resources: [media],
    }),
  ];
}
