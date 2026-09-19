import { Annotations, ArnFormat, CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction as LambdaTarget } from "aws-cdk-lib/aws-events-targets";
import { AnyPrincipal, Effect, ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Architecture, Code, Function as LambdaFunction, Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { FilterPattern, LogGroup, MetricFilter, RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import { Queue, QueueEncryption, RedrivePermission } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import { INGEST_PREFIX } from "../../../shared/media-contract";
import { PROCESSING_POLICY } from "../../../shared/media-processing";
import type { MediaEnvironmentConfig } from "../config";
import { createAlertTopic } from "./alarm-topic";

export interface MediaProcessingStackProps extends StackProps {
  readonly config: MediaEnvironmentConfig;
}

/** How many worker invocations may run at once (also bounds database connections). */
export const WORKER_CONCURRENCY = 2;
export const WORKER_MEMORY_MB = 2048;
export const SWEEPER_TIMEOUT_SECONDS = 120;
/** EventBridge rate for the sweeper. */
export const SWEEP_INTERVAL_MINUTES = 15;
export const METRIC_NAMESPACE = "AarvasaMedia/Processing";

/**
 * Processing runtime (Phase 5). Defined for review and synthesis; not deployed.
 *
 *   upload completion (after UPLOADED → PROCESSING commits) ─┐
 *   sweeper (EventBridge, every 15 min) ── re-send ───────────┴─► processing queue ─5 receives─► DLQ
 *                                                                     │ event source mapping, batch 1,
 *                                                                     ▼ ReportBatchItemFailures
 *                                                     worker Lambda (reserved concurrency 2)
 *
 * Both Lambdas run code from a private artifact bucket (Code.fromBucket), so the
 * app still needs no CDK assets or bootstrap. The bundle is built and uploaded
 * before deploying (infra/README.md section 14). The database URL is read at
 * cold start from one Secrets Manager secret, never from the environment.
 *
 * No cross-stack references: the Storage stack's bucket names and processor
 * policy are addressed by their deterministic names.
 */
export class MediaProcessingStack extends Stack {
  readonly queue: Queue;
  readonly deadLetterQueue: Queue;
  readonly producerPolicy: ManagedPolicy;
  readonly consumerPolicy: ManagedPolicy;
  readonly artifactBucket: Bucket;
  readonly worker: LambdaFunction;
  readonly sweeper: LambdaFunction;
  readonly workerRole: Role;
  readonly sweeperRole: Role;
  readonly namePrefix: string;

  constructor(scope: Construct, id: string, props: MediaProcessingStackProps) {
    super(scope, id, props);
    const cfg = props.config;
    const prefix = cfg.namePrefix;
    this.namePrefix = prefix;
    const queueName = `${prefix}-processing`;
    const ingestBucketName = `${prefix}-ingest-${this.account}-${this.region}`;
    const publishedBucketName = `${prefix}-published-${this.account}-${this.region}`;

    // ── Queues ──────────────────────────────────────────────────────────────
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

    // Least-privilege managed policies. The producer is for the Amplify SSR compute role
    // (upload completion); the consumer is attached to the worker role below.
    this.producerPolicy = new ManagedPolicy(this, "ProcessingProducerPolicy", {
      managedPolicyName: `${prefix}-processing-producer`,
      description: "Amplify SSR compute role and the sweeper: send processing jobs only.",
      statements: [
        new PolicyStatement({ sid: "SendProcessingJobs", effect: Effect.ALLOW, actions: ["sqs:SendMessage"], resources: [this.queue.queueArn] }),
      ],
    });
    this.consumerPolicy = new ManagedPolicy(this, "ProcessingConsumerPolicy", {
      managedPolicyName: `${prefix}-processing-consumer`,
      description: "Media processing worker: receive and acknowledge processing jobs only.",
      statements: [
        new PolicyStatement({
          sid: "ConsumeProcessingJobs",
          effect: Effect.ALLOW,
          actions: ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"],
          resources: [this.queue.queueArn],
        }),
      ],
    });

    // ── Code artifacts (private; no CDK assets or bootstrap) ────────────────
    this.artifactBucket = new Bucket(this, "ArtifactBucket", {
      bucketName: `${prefix}-artifacts-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    // Pin the bundle's S3 object version when deploying, so new code is an explicit, reviewed change.
    const code = Code.fromBucket(this.artifactBucket, cfg.processing.artifactKey, cfg.processing.artifactVersion);

    // ── Database secret (one ARN; value never in the template or environment) ─
    const databaseSecretArn =
      cfg.processing.databaseSecretArn ?? this.formatArn({ service: "secretsmanager", resource: "secret", resourceName: `${prefix}/database-NOT-CONFIGURED`, arnFormat: ArnFormat.COLON_RESOURCE_NAME });
    if (!cfg.processing.databaseSecretArn) {
      Annotations.of(this).addWarningV2(
        "aarvasa:media:no-database-secret",
        "No DEV database secret: pass -c aarvasa:databaseSecretArn=<Secrets Manager ARN holding a DEV DATABASE_URL>. The worker and sweeper cannot run without it.",
      );
    }
    const readSecret = new PolicyStatement({ sid: "ReadDatabaseSecret", effect: Effect.ALLOW, actions: ["secretsmanager:GetSecretValue"], resources: [databaseSecretArn] });
    const environment = {
      MEDIA_REGION: this.region,
      MEDIA_INGEST_BUCKET: ingestBucketName,
      MEDIA_PUBLISHED_BUCKET: publishedBucketName,
      MEDIA_PROCESSING_QUEUE_URL: this.queue.queueUrl,
      MEDIA_DATABASE_SECRET_ARN: databaseSecretArn,
      NODE_OPTIONS: "--enable-source-maps",
    };

    // ── Worker ──────────────────────────────────────────────────────────────
    const workerLogs = new LogGroup(this, "WorkerLogGroup", {
      logGroupName: `/aws/lambda/${prefix}-processing-worker`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.workerRole = new Role(this, "WorkerRole", {
      roleName: `${prefix}-processing-worker`,
      description: "Media processing worker Lambda: read uploads, write review copies, consume jobs, read the database secret.",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [ManagedPolicy.fromManagedPolicyName(this, "ProcessorPolicyRef", `${prefix}-processor`), this.consumerPolicy],
    });
    this.workerRole.addToPolicy(readSecret);
    this.workerRole.addToPolicy(
      new PolicyStatement({ sid: "WriteOwnLogs", effect: Effect.ALLOW, actions: ["logs:CreateLogStream", "logs:PutLogEvents"], resources: [`${workerLogs.logGroupArn}`] }),
    );
    this.worker = new LambdaFunction(this, "WorkerFunction", {
      functionName: `${prefix}-processing-worker`,
      description: "Processes one media job: verify source, run the media pipeline, write review copies, PENDING_REVIEW.",
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      code,
      handler: "index.workerHandler",
      memorySize: WORKER_MEMORY_MB,
      timeout: Duration.seconds(PROCESSING_POLICY.workerTimeoutSeconds),
      reservedConcurrentExecutions: WORKER_CONCURRENCY,
      role: this.workerRole,
      logGroup: workerLogs,
      environment,
    });
    this.worker.addEventSource(new SqsEventSource(this.queue, { batchSize: 1, reportBatchItemFailures: true, maxConcurrency: WORKER_CONCURRENCY }));

    // ── Sweeper ─────────────────────────────────────────────────────────────
    const sweeperLogs = new LogGroup(this, "SweeperLogGroup", {
      logGroupName: `/aws/lambda/${prefix}-processing-sweeper`,
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    this.sweeperRole = new Role(this, "SweeperRole", {
      roleName: `${prefix}-processing-sweeper`,
      description: "Media processing sweeper Lambda: check upload existence, re-send jobs, read the database secret.",
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [this.producerPolicy],
    });
    this.sweeperRole.addToPolicy(readSecret);
    this.sweeperRole.addToPolicy(
      new PolicyStatement({
        sid: "CheckUploadExistence",
        effect: Effect.ALLOW,
        // HeadObject is authorised by s3:GetObject; uploads/* in the ingest bucket only.
        actions: ["s3:GetObject"],
        resources: [`arn:${this.partition}:s3:::${ingestBucketName}/${INGEST_PREFIX}/*`],
      }),
    );
    this.sweeperRole.addToPolicy(
      new PolicyStatement({ sid: "WriteOwnLogs", effect: Effect.ALLOW, actions: ["logs:CreateLogStream", "logs:PutLogEvents"], resources: [`${sweeperLogs.logGroupArn}`] }),
    );
    this.sweeper = new LambdaFunction(this, "SweeperFunction", {
      functionName: `${prefix}-processing-sweeper`,
      description: "Fails stale uploads and stuck processing, re-sends unclaimed jobs. Conditional updates only; deletes nothing.",
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      code,
      handler: "index.sweeperHandler",
      memorySize: 512,
      timeout: Duration.seconds(SWEEPER_TIMEOUT_SECONDS),
      reservedConcurrentExecutions: 1,
      role: this.sweeperRole,
      logGroup: sweeperLogs,
      environment,
    });
    new Rule(this, "SweeperSchedule", {
      ruleName: `${prefix}-processing-sweeper`,
      description: `Run the media processing sweeper every ${SWEEP_INTERVAL_MINUTES} minutes.`,
      schedule: Schedule.rate(Duration.minutes(SWEEP_INTERVAL_MINUTES)),
      targets: [new LambdaTarget(this.sweeper, { retryAttempts: 0 })],
    });

    // ── Monitoring (DEV thresholds; SNS topic without subscribers) ──────────
    const topic = createAlertTopic(this, "ProcessingAlertTopic", `${prefix}-processing-alerts`, { cloudWatch: true, budgets: false });
    const failures = new MetricFilter(this, "ProcessingFailuresMetricFilter", {
      logGroup: workerLogs,
      filterPattern: FilterPattern.all(FilterPattern.stringValue("$.event", "=", "media.processing.job"), FilterPattern.stringValue("$.result", "=", "FAILED")),
      metricNamespace: METRIC_NAMESPACE,
      metricName: "ProcessingFailures",
      metricValue: "1",
      defaultValue: 0,
    });
    const alarm = (idSuffix: string, metric: Metric, threshold: number, description: string, evaluationPeriods = 1) =>
      new Alarm(this, `${idSuffix}Alarm`, {
        alarmName: `${prefix}-${idSuffix.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`,
        alarmDescription: description,
        metric,
        threshold,
        evaluationPeriods,
        comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new SnsAction(topic));
    const fiveMinutes = Duration.minutes(5);
    const hour = Duration.hours(1);
    alarm("ProcessingQueueOldestMessage", this.queue.metricApproximateAgeOfOldestMessage({ period: fiveMinutes, statistic: "Maximum" }), 3600, "A processing job has waited over an hour: the worker is failing or stopped.");
    alarm("ProcessingQueueDepth", this.queue.metricApproximateNumberOfMessagesVisible({ period: fiveMinutes, statistic: "Maximum" }), 100, "More than 100 processing jobs are waiting.");
    alarm("ProcessingDeadLetters", this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({ period: fiveMinutes, statistic: "Maximum" }), 1, "A processing job reached the dead-letter queue (invalid job or repeated crashes).");
    alarm("ProcessingWorkerErrors", this.worker.metricErrors({ period: Duration.minutes(15), statistic: "Sum" }), 1, "The processing worker threw or timed out.");
    alarm(
      "ProcessingWorkerDuration",
      this.worker.metricDuration({ period: fiveMinutes, statistic: "Maximum" }),
      PROCESSING_POLICY.workerTimeoutSeconds * 900,
      "A processing run used over 90% of its timeout.",
    );
    alarm("ProcessingFailures", failures.metric({ period: hour, statistic: "Sum" }), 5, "Five or more assets failed processing within an hour.");
    alarm("ProcessingSweeperErrors", this.sweeper.metricErrors({ period: hour, statistic: "Sum" }), 1, "The processing sweeper failed.");

    new CfnOutput(this, "ProcessingQueueUrl", { value: this.queue.queueUrl });
    new CfnOutput(this, "ProcessingQueueArn", { value: this.queue.queueArn });
    new CfnOutput(this, "ProcessingDeadLetterQueueArn", { value: this.deadLetterQueue.queueArn });
    new CfnOutput(this, "ProcessingProducerPolicyArn", { value: this.producerPolicy.managedPolicyArn });
    new CfnOutput(this, "ProcessingConsumerPolicyArn", { value: this.consumerPolicy.managedPolicyArn });
    new CfnOutput(this, "ProcessingArtifactBucketName", { value: this.artifactBucket.bucketName });
    new CfnOutput(this, "ProcessingWorkerFunctionName", { value: this.worker.functionName });
    new CfnOutput(this, "ProcessingSweeperFunctionName", { value: this.sweeper.functionName });
    new CfnOutput(this, "ProcessingAlertTopicArn", { value: topic.topicArn });
  }
}
