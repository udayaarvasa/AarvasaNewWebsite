import { Token, type CfnElement, Validations } from "aws-cdk-lib";
import type { IConstruct } from "constructs";
import type { MediaEdgeStack } from "./stacks/media-edge-stack";
import type { MediaMonitoringStack } from "./stacks/media-monitoring-stack";
import type { MediaProcessingStack } from "./stacks/media-processing-stack";
import type { MediaStorageStack } from "./stacks/media-storage-stack";

/**
 * Every cdk-nag finding that is accepted for the development environment, with
 * the reason. Anything not listed here fails synthesis. Revisit each entry
 * before a production environment is defined.
 */

const DEV_ONLY = "Development environment.";

function resourceOf(construct: IConstruct): IConstruct {
  return construct.node.defaultChild ?? construct;
}

/** IAM5 findings are keyed by the unresolved resource string, e.g. <IngestBucket2B3522FA.Arn>/uploads/*. */
function objectWildcardId(stack: MediaStorageStack, bucket: IConstruct, prefix: string): string {
  const logicalId = stack.resolve(stack.getLogicalId(resourceOf(bucket) as CfnElement)) as string;
  return `AwsSolutions::AwsSolutions-IAM5[Resource::<${logicalId}.Arn>/${prefix}/*]`;
}

export function applyNagSuppressions(stacks: {
  edge: MediaEdgeStack;
  storage: MediaStorageStack;
  monitoring: MediaMonitoringStack;
  processing: MediaProcessingStack;
}): void {
  const { storage, processing } = stacks;

  // Processing stack. Queues need nothing: both are encrypted, TLS-only, and cdk-nag
  // recognises the dead-letter queue as one.
  /* cdk-nag reports the ARN as CloudFormation renders it, which differs by how
     the app was synthesized: "<AWS::AccountId>" when no account is supplied,
     and the literal account once one is. Only the first was covered, so this
     suppression silently stopped matching at exactly the moment it mattered —
     a real deploy, which always names an account. Both forms are registered. */
  const accountForms = Token.isUnresolved(processing.account)
    ? ["<AWS::AccountId>"]
    : ["<AWS::AccountId>", processing.account];
  for (const account of accountForms) {
    Validations.of(resourceOf(processing.sweeperRole.node.findChild("DefaultPolicy"))).acknowledge({
      id: `AwsSolutions::AwsSolutions-IAM5[Resource::arn:aws:s3:::${processing.namePrefix}-ingest-${account}-${processing.region}/uploads/*]`,
      reason:
        "HeadObject existence checks need s3:GetObject; scoped to the ingest bucket's uploads/ prefix only, whose keys are per upload.",
    });
  }

  /* Lambda creates the VPC network interface as the function's own role, and
     the interface has no id at the time permission is evaluated, so these five
     actions cannot be resource-scoped. The action list is the scope. */
  for (const role of ["workerRole", "sweeperRole"] as const) {
    Validations.of(resourceOf(processing[role].node.findChild("DefaultPolicy"))).acknowledge({
      id: "AwsSolutions::AwsSolutions-IAM5[Resource::*]",
      reason:
        "ec2 network-interface actions for VPC attachment cannot be resource-scoped: Lambda creates the ENI under this role and it has no identifier when the policy is evaluated.",
    });
  }

  /* An adopted artifact bucket is not a resource in this template, so it has
     no findings to acknowledge — and resourceOf would not resolve it. */
  const ownBuckets = [storage.ingestBucket, storage.publishedBucket];
  if (stacks.processing.ownsArtifactBucket) ownBuckets.push(stacks.processing.artifactBucket as never);
  for (const bucket of ownBuckets) {
    Validations.of(resourceOf(bucket)).acknowledge({
      id: "AwsSolutions::AwsSolutions-S1",
      reason: `${DEV_ONLY} S3 server access logs would need a separate log bucket; enable them (or CloudTrail S3 data events) for production.`,
    });
  }

  const distribution = resourceOf(storage.distribution);
  Validations.of(distribution).acknowledge(
    {
      id: "AwsSolutions::AwsSolutions-CFR3",
      reason: `${DEV_ONLY} CloudFront standard logging is off to avoid a log bucket in dev; enable it for production.`,
    },
    {
      id: "AwsSolutions::AwsSolutions-CFR4",
      reason: `${DEV_ONLY} The default *.cloudfront.net certificate cannot set a minimum TLS version. Production uses a custom domain with an ACM certificate and TLSv1.2_2021.`,
    },
    {
      id: "AwsSolutions::AwsSolutions-CFR7",
      reason:
        "False positive: an Origin Access Control IS attached, via a property override (see media-storage-stack.ts) so the bucket policy can be limited to m/ and lib/. Asserted by test/storage-stack.test.ts.",
    },
    {
      id: "AwsSolutions::AwsSolutions-CFR1",
      reason: "Media is intended for a global audience (India, UAE and beyond); no country restriction is required.",
    },
  );

  if (!storage.distribution.node.tryGetContext("aarvasa:webAclArn")) {
    Validations.of(distribution).acknowledge({
      id: "AwsSolutions::AwsSolutions-CFR2",
      reason:
        "WAF is defined in the Edge stack (us-east-1) and associated at deploy time via -c aarvasa:webAclArn. An explicit warning annotation is emitted when it is absent.",
    });
  }

  const wildcardReason =
    "Object-level wildcard is scoped to a single key prefix in a single bucket. Object keys are generated per upload/media id at runtime, so they cannot be enumerated in policy.";
  Validations.of(resourceOf(storage.node.findChild("AppUploadIntentPolicy"))).acknowledge({
    id: objectWildcardId(storage, storage.ingestBucket, "uploads"),
    reason: wildcardReason,
  });
  Validations.of(resourceOf(storage.node.findChild("ProcessorPolicy"))).acknowledge(
    { id: objectWildcardId(storage, storage.ingestBucket, "uploads"), reason: wildcardReason },
    { id: objectWildcardId(storage, storage.publishedBucket, "review"), reason: wildcardReason },
  );
  Validations.of(resourceOf(storage.node.findChild("AppMediaReviewPolicy"))).acknowledge(
    { id: objectWildcardId(storage, storage.publishedBucket, "review"), reason: wildcardReason },
    { id: objectWildcardId(storage, storage.publishedBucket, "m"), reason: wildcardReason },
  );
}
