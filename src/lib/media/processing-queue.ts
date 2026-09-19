import { SendMessageCommand, SQSClient, type SQSClientConfig } from "@aws-sdk/client-sqs";
import { PROCESSING_JOB_MAX_BYTES, parseProcessingJob, serializeProcessingJob, type ProcessingJob, type ProcessingJobQueue } from "../../../shared/media-processing";

/**
 * SQS producer for processing jobs (server-side only; never imported by client code).
 *
 * The queue URL comes from server configuration (MEDIA_PROCESSING_QUEUE_URL), never
 * from a request. The body is exactly the versioned, identifiers-only job from
 * shared/media-processing.ts: no user content, URLs or secrets, at most 1 KiB (the
 * queue's MaximumMessageSize). Callers send only after UPLOADED → PROCESSING has
 * committed; a failed send leaves the database untouched and the sweeper re-sends.
 *
 * IAM: the processing stack's producer policy (sqs:SendMessage on this queue only).
 */

export interface ProcessingQueueConfig {
  readonly region: string;
  readonly queueUrl: string;
}

/** Test seams only; production passes nothing and uses the default credential chain. */
export interface ProcessingQueueOptions {
  readonly credentials?: { readonly accessKeyId: string; readonly secretAccessKey: string; readonly sessionToken?: string };
  readonly requestHandler?: SQSClientConfig["requestHandler"];
  readonly maxAttempts?: number;
}

const REGION_PATTERN = /^[a-z]{2}(-[a-z]+)+-\d$/;
/** https://sqs.{region}.amazonaws.com/{account}/{name}: the only URL shape accepted. */
const QUEUE_URL_PATTERN = /^https:\/\/sqs\.([a-z]{2}(?:-[a-z]+)+-\d)\.amazonaws\.com\/\d{12}\/[A-Za-z0-9_-]{1,80}$/;

/** MEDIA_REGION and MEDIA_PROCESSING_QUEUE_URL (same region), or null (fail closed: no dispatch). */
export function readProcessingQueueConfig(env: Readonly<Record<string, string | undefined>> = process.env): ProcessingQueueConfig | null {
  const region = env.MEDIA_REGION?.trim();
  const queueUrl = env.MEDIA_PROCESSING_QUEUE_URL?.trim();
  if (!region || !queueUrl || !REGION_PATTERN.test(region)) return null;
  const match = QUEUE_URL_PATTERN.exec(queueUrl);
  if (!match || match[1] !== region) return null;
  return { region, queueUrl };
}

export function createSqsProcessingJobQueue(config: ProcessingQueueConfig, options: ProcessingQueueOptions = {}): ProcessingJobQueue {
  const client = new SQSClient({
    region: config.region,
    ...(options.credentials ? { credentials: options.credentials } : {}),
    ...(options.requestHandler ? { requestHandler: options.requestHandler } : {}),
    ...(options.maxAttempts ? { maxAttempts: options.maxAttempts } : {}),
  });
  return {
    async send(job: ProcessingJob) {
      const body = serializeProcessingJob(job);
      // Re-validate: only a well-formed job ever leaves the server.
      const parsed = parseProcessingJob(body);
      if (!parsed.ok) throw new Error(`Refusing to send an invalid processing job: ${parsed.reason}`);
      if (Buffer.byteLength(body, "utf8") > PROCESSING_JOB_MAX_BYTES) throw new Error("Refusing to send an oversized processing job");
      await client.send(new SendMessageCommand({ QueueUrl: config.queueUrl, MessageBody: body }));
    },
  };
}

let cached: { readonly key: string; readonly queue: ProcessingJobQueue } | null = null;

/** The producer for the current environment, or null when no queue is configured. */
export function getProcessingJobQueue(env: Readonly<Record<string, string | undefined>> = process.env): ProcessingJobQueue | null {
  const config = readProcessingQueueConfig(env);
  if (!config) return null;
  const key = `${config.region}|${config.queueUrl}`;
  if (cached?.key !== key) cached = { key, queue: createSqsProcessingJobQueue(config) };
  return cached.queue;
}
