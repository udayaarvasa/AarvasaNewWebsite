#!/usr/bin/env node
import { App, Tags } from "aws-cdk-lib";
import { APP_RUNTIME_PROD_STACK_ID, AppRuntimeProdStack } from "../src/stacks/app-runtime-prod-stack";

/**
 * The private-database web runtime. Synthesizes only; an operator deploys it
 * after review, following docs/private-database-runbook.md. Every
 * environment-specific value is a context parameter, so no account, VPC or
 * security-group identifier is committed to this public repository:
 *
 *   npx cdk --app "node dist/infra/bin/aarvasa-app-runtime-prod.js" deploy AarvasaAppRuntimeProd \
 *     -c aarvasa:accountId=<account> -c vpcId=<vpc> -c azs=us-east-1a,us-east-1b \
 *     -c publicSubnetIds=<subnet-a>,<subnet-b> -c databaseSecurityGroupId=<sg> \
 *     -c cloudFrontPrefixListId=<pl> -c imageTag=<git sha>
 */
const app = new App();
const ctx = (k: string): string => {
  const v = app.node.tryGetContext(k) as string | undefined;
  if (!v) throw new Error(`Missing -c ${k}=…`);
  return v;
};

const accountId = ctx("aarvasa:accountId");
const detected = process.env.CDK_DEFAULT_ACCOUNT;
if (detected && detected !== accountId) {
  throw new Error(`Refusing to continue: credentials are for account ${detected}, but aarvasa:accountId is ${accountId}.`);
}

new AppRuntimeProdStack(app, APP_RUNTIME_PROD_STACK_ID, {
  env: { account: accountId, region: "us-east-1" },
  description: "Aarvasa web runtime with a private database path (ECS Fargate behind CloudFront)",
  terminationProtection: true,
  namePrefix: "aarvasa-web-prod",
  vpcId: ctx("vpcId"),
  availabilityZones: ctx("azs").split(","),
  publicSubnetIds: ctx("publicSubnetIds").split(","),
  databaseSecurityGroupId: ctx("databaseSecurityGroupId"),
  databaseSecretName: "aarvasa/prod/database/app-runtime",
  appConfigSecretName: "aarvasa/prod/web/app-config",
  cloudFrontPrefixListId: ctx("cloudFrontPrefixListId"),
  imageRepositoryName: "aarvasa-web",
  imageTag: ctx("imageTag"),
});

Tags.of(app).add("Project", "aarvasa");
Tags.of(app).add("Environment", "production");
Tags.of(app).add("Component", "web-runtime");
app.synth();
