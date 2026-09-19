import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Annotations, Match } from "aws-cdk-lib/assertions";
import { PROCESSING_POLICY } from "../../../shared/media-processing";
import { SWEEP_INTERVAL_MINUTES, WORKER_CONCURRENCY, WORKER_MEMORY_MB } from "../../src/stacks/media-processing-stack";
import { asArray, type PolicyStatementJson, renderToken, resourcesOfType, synthMediaApp } from "../helpers";

const SECRET_ARN = "arn:aws:secretsmanager:ap-south-1:123456789012:secret:aarvasa-media-dev/database-AbCdEf";
const { templates, processing } = synthMediaApp({ "aarvasa:databaseSecretArn": SECRET_ARN });
const t = templates.processing;
const queues = resourcesOfType(t, "AWS::SQS::Queue");
const queue = queues.find((q) => q.properties.QueueName === "aarvasa-media-dev-processing")!;
const dlq = queues.find((q) => q.properties.QueueName === "aarvasa-media-dev-processing-dlq")!;
const managed = resourcesOfType(t, "AWS::IAM::ManagedPolicy");
const statementsOf = (name: string) =>
  (managed.find((p) => p.properties.ManagedPolicyName === name)!.properties.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement;
const fn = (name: string) => resourcesOfType(t, "AWS::Lambda::Function").find((f) => f.properties.FunctionName === name)!.properties;
const role = (name: string) => resourcesOfType(t, "AWS::IAM::Role").find((r) => r.properties.RoleName === name)!;
const inlineStatements = (roleLogicalId: string) =>
  resourcesOfType(t, "AWS::IAM::Policy")
    .filter((p) => asArray(p.properties.Roles as unknown[]).map(renderToken).includes(`<${roleLogicalId}>`))
    .flatMap((p) => (p.properties.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement);

describe("processing stack: queues", () => {
  it("defines the processing queue and its dead-letter queue", () => {
    assert.equal(queues.length, 2);
    assert.ok(queue && dlq);
  });

  it("uses the shared timing policy: visibility 6 × the worker timeout, retention, long polling, 1 KiB messages", () => {
    assert.equal(queue.properties.VisibilityTimeout, PROCESSING_POLICY.queueVisibilityTimeoutSeconds);
    assert.ok(PROCESSING_POLICY.queueVisibilityTimeoutSeconds >= 6 * PROCESSING_POLICY.workerTimeoutSeconds);
    assert.equal(queue.properties.MessageRetentionPeriod, PROCESSING_POLICY.queueRetentionSeconds);
    assert.equal(queue.properties.ReceiveMessageWaitTimeSeconds, 20);
    assert.equal(queue.properties.MaximumMessageSize, 1024);
    assert.equal(dlq.properties.MessageRetentionPeriod, PROCESSING_POLICY.deadLetterRetentionSeconds);
  });

  it("redrives to the DLQ after maxReceiveCount, and the DLQ accepts only this queue", () => {
    const redrive = queue.properties.RedrivePolicy as { deadLetterTargetArn: unknown; maxReceiveCount: number };
    assert.equal(redrive.maxReceiveCount, PROCESSING_POLICY.queueMaxReceiveCount);
    assert.match(renderToken(redrive.deadLetterTargetArn), /ProcessingDeadLetterQueue.*\.Arn/);
    const allow = dlq.properties.RedriveAllowPolicy as { redrivePermission: string; sourceQueueArns: unknown[] };
    assert.equal(allow.redrivePermission, "byQueue");
    assert.deepEqual(allow.sourceQueueArns.map(renderToken), ["arn:aws:sqs:ap-south-1:<AWS::AccountId>:aarvasa-media-dev-processing"]);
  });

  it("encrypts both queues and is never public: TLS-only, same-account-only, deny statements only", () => {
    for (const q of [queue, dlq]) assert.equal(q.properties.SqsManagedSseEnabled, true);
    const queuePolicies = resourcesOfType(t, "AWS::SQS::QueuePolicy");
    assert.equal(queuePolicies.length, 2);
    for (const p of queuePolicies) {
      const statements = (p.properties.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement;
      assert.ok(statements.every((s) => s.Effect === "Deny"));
      assert.ok(statements.some((s) => JSON.stringify(s.Condition).includes("aws:SecureTransport")));
      assert.ok(statements.some((s) => JSON.stringify(s.Condition).includes("aws:PrincipalAccount")));
    }
  });
});

describe("processing stack: managed policies", () => {
  it("producer may only send to the processing queue", () => {
    const s = statementsOf("aarvasa-media-dev-processing-producer");
    assert.deepEqual(s.map((x) => [asArray(x.Action), asArray(x.Resource).map(renderToken)]), [[["sqs:SendMessage"], ["<ProcessingQueue6DC600C3.Arn>"]]]);
  });

  it("consumer may only receive, delete, extend visibility and read attributes of the processing queue", () => {
    const s = statementsOf("aarvasa-media-dev-processing-consumer");
    assert.equal(s.length, 1);
    assert.deepEqual(asArray(s[0].Action).sort(), ["sqs:ChangeMessageVisibility", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ReceiveMessage"]);
    assert.deepEqual(asArray(s[0].Resource).map(renderToken), ["<ProcessingQueue6DC600C3.Arn>"]);
  });
});

describe("processing stack: worker runtime", () => {
  const worker = fn("aarvasa-media-dev-processing-worker");

  it("is a Node.js 24 arm64 Lambda with a 5-minute timeout, bounded concurrency and memory", () => {
    assert.equal(worker.Runtime, "nodejs24.x");
    assert.deepEqual(worker.Architectures, ["arm64"]);
    assert.equal(worker.Timeout, PROCESSING_POLICY.workerTimeoutSeconds);
    assert.equal(worker.MemorySize, WORKER_MEMORY_MB);
    assert.equal(worker.ReservedConcurrentExecutions, WORKER_CONCURRENCY);
    assert.equal(worker.Handler, "index.workerHandler");
  });

  it("runs code from the private artifact bucket (no CDK assets or bootstrap)", () => {
    const code = worker.Code as { S3Bucket: unknown; S3Key: string };
    assert.match(renderToken(code.S3Bucket), /^<ArtifactBucket/);
    assert.equal(code.S3Key, "processing/processing-lambdas.zip");
    const artifact = resourcesOfType(t, "AWS::S3::Bucket")[0].properties;
    assert.deepEqual(artifact.PublicAccessBlockConfiguration, { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true });
    assert.deepEqual(artifact.VersioningConfiguration, { Status: "Enabled" });
  });

  it("gets configuration, never secrets, from its environment", () => {
    const env = (worker.Environment as { Variables: Record<string, unknown> }).Variables;
    assert.deepEqual(Object.keys(env).sort(), ["MEDIA_DATABASE_SECRET_ARN", "MEDIA_INGEST_BUCKET", "MEDIA_PROCESSING_QUEUE_URL", "MEDIA_PUBLISHED_BUCKET", "MEDIA_REGION", "NODE_OPTIONS"]);
    assert.equal(env.MEDIA_DATABASE_SECRET_ARN, SECRET_ARN);
    assert.ok(!JSON.stringify(t.toJSON()).match(/postgres(ql)?:\/\//), "no database URL anywhere in the template");
  });

  it("consumes the queue one job at a time with partial-batch failures", () => {
    const [esm] = resourcesOfType(t, "AWS::Lambda::EventSourceMapping").map((r) => r.properties);
    assert.equal(esm.BatchSize, 1);
    assert.deepEqual(esm.FunctionResponseTypes, ["ReportBatchItemFailures"]);
    assert.deepEqual(esm.ScalingConfig, { MaximumConcurrency: WORKER_CONCURRENCY });
    assert.match(renderToken(esm.EventSourceArn), /^<ProcessingQueue6DC600C3\.Arn>$/);
  });

  it("has a least-privilege role: processor + consumer policies, one secret, its own log group", () => {
    const r = role("aarvasa-media-dev-processing-worker");
    const attached = asArray(r.properties.ManagedPolicyArns as unknown[]).map(renderToken);
    assert.equal(attached.length, 2);
    assert.ok(attached.some((a) => a.endsWith(":policy/aarvasa-media-dev-processor")));
    assert.ok(attached.some((a) => a === "<ProcessingConsumerPolicy62CCFED3>"));
    const inline = inlineStatements(r.id);
    const secret = inline.find((s) => s.Sid === "ReadDatabaseSecret")!;
    assert.deepEqual(asArray(secret.Action), ["secretsmanager:GetSecretValue"]);
    assert.deepEqual(asArray(secret.Resource), [SECRET_ARN]);
    for (const s of inline) {
      for (const action of asArray(s.Action)) assert.ok(!/(^|:)\*$|^s3:|Delete[A-Z]*Queue|Purge|iam:|cloudformation:/.test(action) || action === "sqs:DeleteMessage", action);
    }
  });
});

describe("processing stack: sweeper runtime", () => {
  const sweeper = fn("aarvasa-media-dev-processing-sweeper");

  it("is a small scheduled Lambda (every 15 minutes, no retries, one at a time)", () => {
    assert.equal(sweeper.Runtime, "nodejs24.x");
    assert.equal(sweeper.Handler, "index.sweeperHandler");
    assert.equal(sweeper.ReservedConcurrentExecutions, 1);
    const [rule] = resourcesOfType(t, "AWS::Events::Rule").map((r) => r.properties);
    assert.equal(rule.ScheduleExpression, `rate(${SWEEP_INTERVAL_MINUTES} minutes)`);
    const [target] = rule.Targets as Array<{ Arn: unknown; RetryPolicy?: { MaximumRetryAttempts: number } }>;
    assert.match(renderToken(target.Arn), /^<SweeperFunction/);
    assert.equal(target.RetryPolicy?.MaximumRetryAttempts, 0);
  });

  it("may only check upload existence, send jobs, read the one secret and write its logs", () => {
    const r = role("aarvasa-media-dev-processing-sweeper");
    assert.deepEqual(asArray(r.properties.ManagedPolicyArns as unknown[]).map(renderToken), ["<ProcessingProducerPolicyD0F7E6C6>"]);
    const inline = inlineStatements(r.id);
    const s3 = inline.find((s) => s.Sid === "CheckUploadExistence")!;
    assert.deepEqual(asArray(s3.Action), ["s3:GetObject"]);
    assert.deepEqual(asArray(s3.Resource).map(renderToken), ["arn:aws:s3:::aarvasa-media-dev-ingest-<AWS::AccountId>-ap-south-1/uploads/*"]);
    assert.ok(!inline.some((s) => asArray(s.Action).some((a) => a.startsWith("sqs:Receive") || a === "s3:PutObject")));
  });
});

describe("processing stack: monitoring", () => {
  const alarms = resourcesOfType(t, "AWS::CloudWatch::Alarm").map((a) => a.properties);
  const byName = (name: string) => alarms.find((a) => a.AlarmName === `aarvasa-media-dev-${name}`)!;

  it("alarms on queue age and depth, DLQ messages, worker errors and duration, processing failures and sweeper errors", () => {
    assert.deepEqual(alarms.map((a) => a.AlarmName).sort(), [
      "aarvasa-media-dev-processing-dead-letters",
      "aarvasa-media-dev-processing-failures",
      "aarvasa-media-dev-processing-queue-depth",
      "aarvasa-media-dev-processing-queue-oldest-message",
      "aarvasa-media-dev-processing-sweeper-errors",
      "aarvasa-media-dev-processing-worker-duration",
      "aarvasa-media-dev-processing-worker-errors",
    ]);
    assert.equal(byName("processing-dead-letters").Threshold, 1);
    assert.equal(byName("processing-queue-oldest-message").MetricName, "ApproximateAgeOfOldestMessage");
    assert.equal(byName("processing-worker-duration").Threshold, PROCESSING_POLICY.workerTimeoutSeconds * 900);
    for (const a of alarms) {
      assert.equal(a.TreatMissingData, "notBreaching");
      assert.match(renderToken(asArray(a.AlarmActions as unknown[])[0]), /^<ProcessingAlertTopic/);
    }
  });

  it("counts FAILED processing results from the worker's structured logs", () => {
    const [filter] = resourcesOfType(t, "AWS::Logs::MetricFilter").map((f) => f.properties);
    assert.equal(filter.FilterPattern, '{ ($.event = "media.processing.job") && ($.result = "FAILED") }');
    assert.equal((filter.MetricTransformations as Array<{ MetricName: string }>)[0].MetricName, "ProcessingFailures");
  });

  it("keeps a month of logs for each function", () => {
    const groups = resourcesOfType(t, "AWS::Logs::LogGroup").map((g) => g.properties);
    assert.deepEqual(groups.map((g) => g.LogGroupName).sort(), ["/aws/lambda/aarvasa-media-dev-processing-sweeper", "/aws/lambda/aarvasa-media-dev-processing-worker"]);
    for (const g of groups) assert.equal(g.RetentionInDays, 30);
  });
});

describe("processing stack: configuration guard", () => {
  it("warns (and uses an obviously unconfigured placeholder) when no DEV database secret is given", () => {
    const { templates: unconfigured, processing: unconfiguredStack } = synthMediaApp();
    const worker = resourcesOfType(unconfigured.processing, "AWS::Lambda::Function").find((f) => f.properties.FunctionName === "aarvasa-media-dev-processing-worker")!;
    const env = (worker.properties.Environment as { Variables: Record<string, unknown> }).Variables;
    assert.match(renderToken(env.MEDIA_DATABASE_SECRET_ARN), /secret:aarvasa-media-dev\/database-NOT-CONFIGURED$/);
    const warnings = Annotations.fromStack(unconfiguredStack).findWarning("*", Match.stringLikeRegexp("No DEV database secret"));
    assert.equal(warnings.length, 1);
    assert.equal(Annotations.fromStack(processing).findWarning("*", Match.stringLikeRegexp("No DEV database secret")).length, 0);
  });

  it("pins the Lambda bundle's S3 object version when one is given", () => {
    const { templates: pinned } = synthMediaApp({ "aarvasa:databaseSecretArn": SECRET_ARN, "aarvasa:processingArtifactVersion": "3HL4kqtJlcpXroDTDmjVBH40Nrjfkd" });
    for (const f of resourcesOfType(pinned.processing, "AWS::Lambda::Function")) {
      assert.equal((f.properties.Code as { S3ObjectVersion?: string }).S3ObjectVersion, "3HL4kqtJlcpXroDTDmjVBH40Nrjfkd");
    }
    assert.throws(() => synthMediaApp({ "aarvasa:processingArtifactVersion": "bad version!" }), /object version/);
    assert.throws(() => synthMediaApp({ "aarvasa:processingArtifactKey": "../x.zip" }), /\.zip object key/);
    assert.throws(() => synthMediaApp({ "aarvasa:databaseSecretArn": "postgresql://u:p@h/db" }), /Secrets Manager secret ARN/);
  });

  it("exposes its resources to the rest of the app", () => {
    assert.ok(processing.worker && processing.sweeper && processing.artifactBucket);
  });
});
