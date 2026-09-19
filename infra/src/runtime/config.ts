/**
 * Configuration for the processing Lambdas, from their (non-secret) environment.
 * Fails closed: a missing or malformed value stops the function before any work.
 * The database URL is never in the environment; only the Secrets Manager secret
 * ARN is, and the secret is read at cold start (see database.ts).
 */
export interface ProcessingRuntimeConfig {
  readonly region: string;
  readonly ingestBucket: string;
  readonly publishedBucket: string;
  readonly queueUrl: string;
  readonly databaseSecretArn: string;
}

const REGION = /^[a-z]{2}(-[a-z]+)+-\d$/;
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const QUEUE_URL = /^https:\/\/sqs\.([a-z]{2}(?:-[a-z]+)+-\d)\.amazonaws\.com\/\d{12}\/[A-Za-z0-9_-]{1,80}$/;
const SECRET_ARN = /^arn:aws:secretsmanager:([a-z]{2}(?:-[a-z]+)+-\d):\d{12}:secret:[A-Za-z0-9/_+=.@-]{1,512}$/;

export function readProcessingRuntimeConfig(env: Readonly<Record<string, string | undefined>>): ProcessingRuntimeConfig {
  const region = env.MEDIA_REGION?.trim() ?? "";
  const ingestBucket = env.MEDIA_INGEST_BUCKET?.trim() ?? "";
  const publishedBucket = env.MEDIA_PUBLISHED_BUCKET?.trim() ?? "";
  const queueUrl = env.MEDIA_PROCESSING_QUEUE_URL?.trim() ?? "";
  const databaseSecretArn = env.MEDIA_DATABASE_SECRET_ARN?.trim() ?? "";
  const problems: string[] = [];
  if (!REGION.test(region)) problems.push("MEDIA_REGION");
  if (!BUCKET.test(ingestBucket)) problems.push("MEDIA_INGEST_BUCKET");
  if (!BUCKET.test(publishedBucket) || publishedBucket === ingestBucket) problems.push("MEDIA_PUBLISHED_BUCKET");
  if (QUEUE_URL.exec(queueUrl)?.[1] !== region) problems.push("MEDIA_PROCESSING_QUEUE_URL");
  if (!SECRET_ARN.test(databaseSecretArn)) problems.push("MEDIA_DATABASE_SECRET_ARN");
  if (problems.length > 0) throw new Error(`Processing runtime is misconfigured: ${problems.join(", ")}`);
  return { region, ingestBucket, publishedBucket, queueUrl, databaseSecretArn };
}
