import { acknowledges, processJob, type WorkerDependencies } from "./worker";

/**
 * SQS consumer shape (Lambda event source mapping with ReportBatchItemFailures, or
 * any poller that behaves the same). Needs no AWS SDK: SQS hands the batch in and
 * deletes every message not listed in batchItemFailures.
 *
 * A message is acknowledged (deleted) when the worker COMPLETED, FAILED the asset
 * permanently, or SKIPPED it; it is left for redelivery on RETRY and on REJECTED
 * (an invalid job), so SQS moves it to the dead-letter queue after
 * PROCESSING_POLICY.queueMaxReceiveCount receives. Records are processed one at a
 * time: a batch never holds more than one worker's worth of memory.
 *
 * Not deployed: there is no Lambda in the CDK app yet (Phase 5C scope).
 */

export interface SqsRecordLike {
  readonly messageId: string;
  readonly body: string;
  readonly attributes?: { readonly ApproximateReceiveCount?: string };
}

export interface SqsBatchResponse {
  readonly batchItemFailures: Array<{ readonly itemIdentifier: string }>;
}

export async function handleProcessingBatch(event: { readonly Records: readonly SqsRecordLike[] }, deps: WorkerDependencies): Promise<SqsBatchResponse> {
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];
  for (const record of event.Records) {
    const receiveCount = Number(record.attributes?.ApproximateReceiveCount ?? "1");
    try {
      const outcome = await processJob(record.body, { messageId: record.messageId, receiveCount: Number.isFinite(receiveCount) ? receiveCount : 1 }, deps);
      if (!acknowledges(outcome)) batchItemFailures.push({ itemIdentifier: record.messageId });
    } catch {
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures };
}
