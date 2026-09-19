import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getIngestObjectInspector } from "../../../src/lib/media/ingest-storage";
import { createSqsProcessingJobQueue } from "../../../src/lib/media/processing-queue";
import { createPrismaProcessingStore } from "../../../src/lib/services/media-processing.store";
import { loadSharpPosterGenerator } from "../pipeline/adapters";
import { createS3ObjectPublisher, createS3SourceReader } from "../processing/s3-adapters";
import { handleProcessingBatch, type SqsBatchResponse, type SqsRecordLike } from "../processing/sqs-handler";
import { runSweep, type SweepReport } from "../processing/sweeper";
import type { WorkerDependencies } from "../processing/worker";
import { readProcessingRuntimeConfig, type ProcessingRuntimeConfig } from "./config";
import { getDatabaseUrl, secretsManagerReader } from "./database";

/**
 * Lambda entry points for the processing stack (not deployed; see infra/README.md
 * section 14). Pure composition: the worker, sweeper, stores and adapters are the
 * tested Phase 5C/5 modules. Logs are one JSON object per line for CloudWatch
 * metric filters; they carry ids, counts and codes only.
 */

const log = (event: string, fields: Readonly<Record<string, unknown>>) => console.log(JSON.stringify({ event, ...fields }));

let prisma: PrismaClient | null = null;

async function database(config: ProcessingRuntimeConfig): Promise<PrismaClient> {
  if (!prisma) {
    const url = await getDatabaseUrl(secretsManagerReader(config.region), config.databaseSecretArn);
    // One connection per container: reserved concurrency keeps the total small.
    prisma = new PrismaClient({ datasourceUrl: url.includes("connection_limit=") ? url : `${url}${url.includes("?") ? "&" : "?"}connection_limit=1` });
  }
  return prisma;
}

export async function workerDependencies(env: NodeJS.ProcessEnv = process.env): Promise<WorkerDependencies> {
  const config = readProcessingRuntimeConfig(env);
  return {
    store: createPrismaProcessingStore(await database(config)),
    reader: createS3SourceReader({ region: config.region, bucket: config.ingestBucket }),
    publisher: createS3ObjectPublisher({ region: config.region, bucket: config.publishedBucket }),
    posterGenerator: loadSharpPosterGenerator(env),
    now: () => new Date(),
    log,
  };
}

/** SQS event source mapping (batch size 1, ReportBatchItemFailures). */
export async function workerHandler(event: { readonly Records: readonly SqsRecordLike[] }): Promise<SqsBatchResponse> {
  return handleProcessingBatch(event, await workerDependencies());
}

/** EventBridge schedule (every 15 minutes). Throws on failure so the Errors alarm fires. */
export async function sweeperHandler(): Promise<SweepReport> {
  const config = readProcessingRuntimeConfig(process.env);
  const queue = createSqsProcessingJobQueue({ region: config.region, queueUrl: config.queueUrl });
  const inspector = getIngestObjectInspector({ MEDIA_REGION: config.region, MEDIA_INGEST_BUCKET: config.ingestBucket });
  return runSweep({
    store: createPrismaProcessingStore(await database(config)),
    inspector,
    dispatch: (job) => queue.send(job),
    newJobId: randomUUID,
    now: () => new Date(),
    log,
  });
}
