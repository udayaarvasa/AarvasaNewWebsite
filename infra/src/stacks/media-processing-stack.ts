import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { AnyPrincipal, Effect, ManagedPolicy, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Queue, QueueEncryption, RedrivePermission } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import { PROCESSING_POLICY } from "../../../shared/media-processing";
import type { MediaEnvironmentConfig } from "../config";

export interface MediaProcessingStackProps extends StackProps {
  readonly config: MediaEnvironmentConfig;
}

/**
 * Processing handoff queue (Phase 5C). Defined for review and synthesis only: not
 * deployed, and nothing produces to or consumes from it yet.
 *
 *   upload completion (after UPLOADED → PROCESSING commits) ─┐
 *   sweeper redispatch (unclaimed PROCESSING rows) ──────────┴─► processing queue ─► worker
 *                                                                     │ 5 receives
 *                                                                     ▼
 *                                                           dead-letter queue (14 days)
 *
 * Messages carry identifiers only (shared/media-processing.ts). Timings come from
 * PROCESSING_POLICY: visibility (15 min) outlasts the worker lease (10 min), which
 * outlasts one worker run (5 min), so SQS never hands a message to a second worker
 * while the first may still hold the asset. Both queues are private: encrypted at
 * rest, TLS-only, and usable only by principals in this account that hold one of
 * the two managed policies below (neither is attached). No Lambda or schedule is
 * defined; see infra/README.md for how the worker and sweeper would be triggered.
 */
export class MediaProcessingStack extends Stack {
  readonly queue: Queue;
  readonly deadLetterQueue: Queue;
  readonly producerPolicy: ManagedPolicy;
  readonly consumerPolicy: ManagedPolicy;

  constructor(scope: Construct, id: string, props: MediaProcessingStackProps) {
    super(scope, id, props);
    const prefix = props.config.namePrefix;
    const queueName = `${prefix}-processing`;

    this.deadLetterQueue = new Queue(this, "ProcessingDeadLetterQueue", {
      queueName: `${prefix}-processing-dlq`,
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.seconds(PROCESSING_POLICY.deadLetterRetentionSeconds),
      // Only the processing queue may redrive into this one. The ARN is built from the
      // name (not a reference) because the processing queue itself refers to this queue.
      redriveAllowPolicy: {
        redrivePermission: RedrivePermission.BY_QUEUE,
        sourceQueues: [Queue.fromQueueArn(this, "ProcessingQueueArnRef", this.formatArn({ service: "sqs", resource: queueName }))],
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.queue = new Queue(this, "ProcessingQueue", {
      queueName,
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      visibilityTimeout: Duration.seconds(PROCESSING_POLICY.queueVisibilityTimeoutSeconds),
      retentionPeriod: Duration.seconds(PROCESSING_POLICY.queueRetentionSeconds),
      receiveMessageWaitTime: Duration.seconds(20),
      maxMessageSizeBytes: 1024,
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: PROCESSING_POLICY.queueMaxReceiveCount },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Never public: deny every principal outside this account, on top of enforceSSL.
    for (const queue of [this.queue, this.deadLetterQueue]) {
      queue.addToResourcePolicy(
        new PolicyStatement({
          sid: "DenyOtherAccounts",
          effect: Effect.DENY,
          principals: [new AnyPrincipal()],
          actions: ["sqs:*"],
          resources: [queue.queueArn],
          conditions: { StringNotEquals: { "aws:PrincipalAccount": this.account } },
        }),
      );
    }

    // Least-privilege, unattached policies: the app (completion + sweeper) sends; the worker receives.
    this.producerPolicy = new ManagedPolicy(this, "ProcessingProducerPolicy", {
      managedPolicyName: `${prefix}-processing-producer`,
      description: "FUTURE: Amplify SSR compute role / sweeper. Send processing jobs only. Not attached.",
      statements: [
        new PolicyStatement({ sid: "SendProcessingJobs", effect: Effect.ALLOW, actions: ["sqs:SendMessage"], resources: [this.queue.queueArn] }),
      ],
    });
    this.consumerPolicy = new ManagedPolicy(this, "ProcessingConsumerPolicy", {
      managedPolicyName: `${prefix}-processing-consumer`,
      description: "FUTURE: media processing worker. Receive and acknowledge processing jobs only. Not attached.",
      statements: [
        new PolicyStatement({
          sid: "ConsumeProcessingJobs",
          effect: Effect.ALLOW,
          actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"],
          resources: [this.queue.queueArn],
        }),
      ],
    });

    new CfnOutput(this, "ProcessingQueueUrl", { value: this.queue.queueUrl });
    new CfnOutput(this, "ProcessingQueueArn", { value: this.queue.queueArn });
    new CfnOutput(this, "ProcessingDeadLetterQueueArn", { value: this.deadLetterQueue.queueArn });
    new CfnOutput(this, "ProcessingProducerPolicyArn", { value: this.producerPolicy.managedPolicyArn });
    new CfnOutput(this, "ProcessingConsumerPolicyArn", { value: this.consumerPolicy.managedPolicyArn });
  }
}
