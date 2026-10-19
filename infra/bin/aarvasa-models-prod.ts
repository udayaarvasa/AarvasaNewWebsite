#!/usr/bin/env node
import { App, LegacyStackSynthesizer, Tags, Validations } from "aws-cdk-lib";
import { AwsSolutionsChecks } from "cdk-nag";
import type { IConstruct } from "constructs";
import { MODEL_DELIVERY_PROD_STACK_ID, ModelDeliveryProdStack } from "../src/stacks/model-delivery-prod-stack";

/**
 * Production delivery of approved public building models. Synthesizes only;
 * an operator deploys it after review, as with the DEV stacks:
 *
 *   npx cdk --app "node dist/infra/bin/aarvasa-models-prod.js" deploy AarvasaModelsProd-Delivery -c aarvasa:accountId=<account id>
 */
const app = new App();

const accountId = app.node.tryGetContext("aarvasa:accountId") as string | undefined;
const detected = process.env.CDK_DEFAULT_ACCOUNT;
if (detected && !accountId) {
  throw new Error(`AWS credentials for account ${detected} are active, but no target was named. Pass -c aarvasa:accountId=<account id>.`);
}
if (detected && accountId && detected !== accountId) {
  throw new Error(`Refusing to continue: credentials are for account ${detected}, but aarvasa:accountId is ${accountId}.`);
}

const stack = new ModelDeliveryProdStack(app, MODEL_DELIVERY_PROD_STACK_ID, {
  env: { account: accountId, region: "ap-south-1" },
  synthesizer: new LegacyStackSynthesizer(),
  description: "Aarvasa approved public building models (production): private S3 bucket and CloudFront",
  terminationProtection: true,
  namePrefix: "aarvasa-models-prod",
});

Tags.of(app).add("Project", "aarvasa");
Tags.of(app).add("Environment", "production");
Tags.of(app).add("Component", "approved-models");

const resourceOf = (c: IConstruct): IConstruct => c.node.defaultChild ?? c;
const PROD = "Production, approved-models delivery only.";
Validations.of(resourceOf(stack.bucket)).acknowledge({
  id: "AwsSolutions::AwsSolutions-S1",
  reason: `${PROD} Operator-written, read only via CloudFront; server access logs need a separate log bucket and are a recorded follow-up.`,
});
Validations.of(resourceOf(stack.distribution)).acknowledge(
  { id: "AwsSolutions::AwsSolutions-CFR1", reason: "Public building models for a global audience; no country restriction." },
  { id: "AwsSolutions::AwsSolutions-CFR2", reason: `${PROD} Immutable public files of about 1 MB behind Shield Standard; a WAF rate rule is a recorded follow-up.` },
  { id: "AwsSolutions::AwsSolutions-CFR3", reason: `${PROD} Standard logging needs a log bucket; a recorded follow-up.` },
  { id: "AwsSolutions::AwsSolutions-CFR4", reason: "The default *.cloudfront.net certificate cannot set a minimum TLS version; a custom domain with ACM is a recorded follow-up." },
  { id: "AwsSolutions::AwsSolutions-CFR7", reason: "False positive: an Origin Access Control is attached by property override so the bucket policy can be limited to m/." },
);

Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
app.synth();
