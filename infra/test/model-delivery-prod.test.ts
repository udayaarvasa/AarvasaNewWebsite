import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { ModelDeliveryProdStack, PROD_MODEL_READ_ORIGINS } from "../src/stacks/model-delivery-prod-stack";

const app = new App();
const stack = new ModelDeliveryProdStack(app, "ModelsProdTest", {
  env: { account: "123456789012", region: "ap-south-1" },
  namePrefix: "aarvasa-models-prod",
});
const t = Template.fromStack(stack).toJSON() as { Resources: Record<string, { Type: string; Properties: Record<string, unknown> }> };
const ofType = (type: string) => Object.values(t.Resources).filter((r) => r.Type === type).map((r) => r.Properties);

describe("production model delivery", () => {
  it("creates only delivery resources: no Lambda, no custom resource, no IAM principal for the app", () => {
    const types = new Set(Object.values(t.Resources).map((r) => r.Type));
    assert.deepEqual([...types].sort(), [
      "AWS::CloudFront::CachePolicy",
      "AWS::CloudFront::Distribution",
      "AWS::CloudFront::Function",
      "AWS::CloudFront::OriginAccessControl",
      "AWS::CloudFront::ResponseHeadersPolicy",
      "AWS::S3::Bucket",
      "AWS::S3::BucketPolicy",
    ]);
  });

  it("keeps the bucket private, encrypted and versioned", () => {
    const [bucket] = ofType("AWS::S3::Bucket");
    assert.deepEqual(bucket.PublicAccessBlockConfiguration, {
      BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true,
    });
    assert.deepEqual(bucket.VersioningConfiguration, { Status: "Enabled" });
  });

  it("lets only this distribution read, and only under m/", () => {
    const [policy] = ofType("AWS::S3::BucketPolicy");
    const statements = (policy.PolicyDocument as { Statement: Array<Record<string, unknown>> }).Statement;
    const allows = statements.filter((s) => s.Effect === "Allow");
    assert.equal(allows.length, 1);
    assert.deepEqual(allows[0].Principal, { Service: "cloudfront.amazonaws.com" });
    assert.equal(allows[0].Action, "s3:GetObject");
    assert.match(JSON.stringify(allows[0].Resource), /\/m\/\*"/);
    assert.ok((allows[0].Condition as Record<string, unknown>).StringEquals, "scoped to the distribution ARN");
  });

  it("allows exactly the production site origins, credentialed, never a wildcard or localhost", () => {
    const [headers] = ofType("AWS::CloudFront::ResponseHeadersPolicy");
    const cors = (headers.ResponseHeadersPolicyConfig as { CorsConfig: Record<string, { Items: string[] } | boolean> }).CorsConfig;
    assert.deepEqual((cors.AccessControlAllowOrigins as { Items: string[] }).Items, [...PROD_MODEL_READ_ORIGINS]);
    assert.equal(cors.AccessControlAllowCredentials, true);
    assert.deepEqual((cors.AccessControlAllowHeaders as { Items: string[] }).Items, ["Range", "Accept"]);
    const [fn] = ofType("AWS::CloudFront::Function");
    assert.ok(!/localhost|127\.0\.0\.1|\*/.test(JSON.stringify(PROD_MODEL_READ_ORIGINS)));
    assert.ok(String(fn.FunctionCode).includes("https://www.aarvasa.com"));
    assert.ok(!String(fn.FunctionCode).includes("localhost"));
  });

  it("reads S3 through origin access control, not a legacy identity", () => {
    const [dist] = ofType("AWS::CloudFront::Distribution");
    const origin = (dist.DistributionConfig as { Origins: Array<Record<string, unknown>> }).Origins[0];
    assert.ok(origin.OriginAccessControlId);
    assert.ok(!(origin.S3OriginConfig as { OriginAccessIdentity?: string } | undefined)?.OriginAccessIdentity);
  });
});
