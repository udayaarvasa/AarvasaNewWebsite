import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROCESSING_POLICY } from "../../../shared/media-processing";
import { asArray, type PolicyStatementJson, renderToken, resourcesOfType, synthMediaApp } from "../helpers";

const { templates } = synthMediaApp();
const t = templates.processing;
const queues = resourcesOfType(t, "AWS::SQS::Queue");
const queue = queues.find((q) => q.properties.QueueName === "aarvasa-media-dev-processing")!;
const dlq = queues.find((q) => q.properties.QueueName === "aarvasa-media-dev-processing-dlq")!;
const policies = resourcesOfType(t, "AWS::IAM::ManagedPolicy");
const statementsOf = (name: string) =>
  (policies.find((p) => p.properties.ManagedPolicyName === name)!.properties.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement;

describe("processing stack: queues", () => {
  it("defines exactly a processing queue and its dead-letter queue, and nothing that runs code", () => {
    assert.equal(queues.length, 2);
    assert.ok(queue && dlq);
    const json = JSON.stringify(t.toJSON());
    for (const type of ["AWS::Lambda::Function", "AWS::Lambda::EventSourceMapping", "AWS::Events::Rule", "AWS::Scheduler::Schedule", "AWS::ECS::", "AWS::IAM::Role", "AWS::IAM::User", "AWS::S3::BucketNotification"]) {
      assert.ok(!json.includes(type), type);
    }
  });

  it("uses the shared timing policy: visibility, retention, long polling, 1 KiB messages", () => {
    assert.equal(queue.properties.VisibilityTimeout, PROCESSING_POLICY.queueVisibilityTimeoutSeconds);
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

  it("encrypts both queues at rest", () => {
    for (const q of [queue, dlq]) assert.equal(q.properties.SqsManagedSseEnabled, true);
  });

  it("is never public: TLS-only and same-account-only deny statements, no Allow to anyone", () => {
    const queuePolicies = resourcesOfType(t, "AWS::SQS::QueuePolicy");
    assert.equal(queuePolicies.length, 2);
    for (const p of queuePolicies) {
      const statements = (p.properties.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement;
      assert.ok(statements.every((s) => s.Effect === "Deny"), "queue policies only deny");
      assert.ok(statements.some((s) => JSON.stringify(s.Condition).includes("aws:SecureTransport")));
      assert.ok(statements.some((s) => JSON.stringify(s.Condition).includes("aws:PrincipalAccount")));
    }
  });
});

describe("processing stack: least-privilege, unattached policies", () => {
  it("producer may only send to the processing queue", () => {
    const s = statementsOf("aarvasa-media-dev-processing-producer");
    assert.equal(s.length, 1);
    assert.deepEqual(asArray(s[0].Action), ["sqs:SendMessage"]);
    assert.deepEqual(asArray(s[0].Resource).map(renderToken), ["<ProcessingQueue6DC600C3.Arn>"]);
  });

  it("consumer may only receive, delete, extend visibility and read attributes of the processing queue", () => {
    const s = statementsOf("aarvasa-media-dev-processing-consumer");
    assert.equal(s.length, 1);
    assert.deepEqual(asArray(s[0].Action).sort(), ["sqs:ChangeMessageVisibility", "sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:ReceiveMessage"]);
    assert.deepEqual(asArray(s[0].Resource).map(renderToken), ["<ProcessingQueue6DC600C3.Arn>"]);
  });

  it("grants no wildcard actions, no DLQ access and no S3 or infrastructure access", () => {
    for (const p of policies) {
      for (const s of (p.properties.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement) {
        assert.equal(s.Effect, "Allow");
        for (const action of asArray(s.Action)) {
          assert.ok(action.startsWith("sqs:") && !action.includes("*"), action);
          assert.ok(!/Purge|Delete Queue|DeleteQueue|SetQueueAttributes|CreateQueue|AddPermission|TagQueue/.test(action), action);
        }
        assert.ok(asArray(s.Resource).map(renderToken).every((r) => r === "<ProcessingQueue6DC600C3.Arn>"));
      }
    }
  });
});
