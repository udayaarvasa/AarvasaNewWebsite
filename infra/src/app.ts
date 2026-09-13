import { App, LegacyStackSynthesizer, Tags, Validations } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import { assertDeployTarget, loadDevConfig, type MediaEnvironmentConfig } from "./config";
import { applyNagSuppressions } from "./nag-suppressions";
import { MediaEdgeStack } from "./stacks/media-edge-stack";
import { MediaMonitoringStack } from "./stacks/media-monitoring-stack";
import { MediaStorageStack } from "./stacks/media-storage-stack";

export const STACK_IDS = {
  edge: "AarvasaMediaDev-Edge",
  storage: "AarvasaMediaDev-Storage",
  monitoring: "AarvasaMediaDev-Monitoring",
} as const;

export interface MediaApp {
  readonly config: MediaEnvironmentConfig;
  readonly edge: MediaEdgeStack;
  readonly storage: MediaStorageStack;
  readonly monitoring: MediaMonitoringStack;
}

/**
 * Defines the development media stacks. Nothing here deploys: the CDK CLI only
 * deploys when a person runs `cdk deploy <stack>` and approves the change set.
 *
 * Stacks carry no cross-stack references. Values that flow between regions (the
 * WAF ARN into Storage, the distribution id into Monitoring) are passed as
 * explicit, reviewed context values, so each stack deploys on its own.
 *
 * LegacyStackSynthesizer: deploys with the operator's own CLI credentials and
 * references no bootstrap roles, bucket or ECR repository. That holds only while
 * the stacks contain no file/Docker assets, which test/app.test.ts enforces, so
 * no `cdk bootstrap` resources are ever needed in the account. (The newer
 * Bootstrapless and CliCredentials synthesizers still reference bootstrap roles
 * or bucket names.)
 */
export function buildMediaApp(app: App, env: NodeJS.ProcessEnv): MediaApp {
  const config = loadDevConfig(app);
  assertDeployTarget(config, env);

  const global = { account: config.accountId, region: config.globalRegion };
  const storageEnv = { account: config.accountId, region: config.storageRegion };

  const edge = new MediaEdgeStack(app, STACK_IDS.edge, {
    env: global,
    synthesizer: new LegacyStackSynthesizer(),
    description: "Aarvasa immersive media (dev): CloudFront-scoped WAF web ACL",
    config,
  });

  const storage = new MediaStorageStack(app, STACK_IDS.storage, {
    env: storageEnv,
    synthesizer: new LegacyStackSynthesizer(),
    description: "Aarvasa immersive media (dev): private S3 buckets, CloudFront media CDN, unattached IAM policies",
    terminationProtection: true,
    config,
  });

  const monitoring = new MediaMonitoringStack(app, STACK_IDS.monitoring, {
    env: global,
    synthesizer: new LegacyStackSynthesizer(),
    description: "Aarvasa immersive media (dev): budgets and CDN/WAF alarms",
    config,
  });

  for (const [key, value] of Object.entries(config.tags)) Tags.of(app).add(key, value);

  // cdk-nag v3 runs as a CDK policy-validation plugin; findings fail synthesis.
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
  applyNagSuppressions({ edge, storage, monitoring });

  return { config, edge, storage, monitoring };
}
