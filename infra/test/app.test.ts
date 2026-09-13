import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { App } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { assertDeployTarget, DEV_DEFAULTS, loadDevConfig, validateOrigin } from "../src/config";
import { buildMediaApp, STACK_IDS } from "../src/app";
import { synthMediaApp } from "./helpers";

describe("app: synthesis without AWS access", () => {
  const synthesized = synthMediaApp();
  const assembly = synthesized.app.synth();

  it("synthesizes all three stacks with cdk-nag and schema validation passing", () => {
    const ids = assembly.stacks.map((s) => s.stackName).sort();
    assert.deepEqual(ids, [STACK_IDS.edge, STACK_IDS.monitoring, STACK_IDS.storage].sort());
  });

  it("places stacks in the intended regions without pinning an account", () => {
    const env = Object.fromEntries(assembly.stacks.map((s) => [s.stackName, s.environment]));
    assert.equal(env[STACK_IDS.edge].region, "us-east-1");
    assert.equal(env[STACK_IDS.monitoring].region, "us-east-1");
    assert.equal(env[STACK_IDS.storage].region, "ap-south-1");
    for (const e of Object.values(env)) assert.equal(e.account, "unknown-account");
  });

  it("needs no CDK bootstrap: no assets, parameters, bootstrap roles or version checks", () => {
    for (const stack of assembly.stacks) {
      assert.equal(stack.assets.length, 0, `${stack.stackName} must not contain assets`);
      assert.equal(stack.assumeRoleArn, undefined, `${stack.stackName} must deploy with CLI credentials`);
      assert.equal(stack.cloudFormationExecutionRoleArn, undefined);
      assert.equal(stack.requiresBootstrapStackVersion, undefined);
      const template = stack.template as { Parameters?: object; Rules?: object };
      assert.equal(template.Parameters, undefined, `${stack.stackName} has parameters`);
      assert.equal(template.Rules, undefined, `${stack.stackName} has rules`);
    }
  });

  it("protects the storage stack from accidental deletion", () => {
    const storage = assembly.getStackByName(STACK_IDS.storage);
    assert.equal(storage.terminationProtection, true);
  });

  it("tags every stack for cost allocation", () => {
    for (const stack of assembly.stacks) {
      assert.deepEqual(stack.tags, { Environment: "dev", ManagedBy: "aws-cdk", Project: "aarvasa-media" });
    }
  });

  it("contains no Lambda functions, custom resources or NEXT_PUBLIC values", () => {
    for (const stack of assembly.stacks) {
      const json = JSON.stringify(stack.template);
      assert.ok(!json.includes("AWS::Lambda::Function"), stack.stackName);
      assert.ok(!json.includes("Custom::"), stack.stackName);
      assert.ok(!json.includes("NEXT_PUBLIC"), stack.stackName);
    }
  });
});

describe("app: policy validation is enforcing", () => {
  it("fails synthesis when a new, unacknowledged cdk-nag finding appears", () => {
    const app = new App({ context: { "@aws-cdk/core:validateAgainstDefaultRules": true } });
    const { storage } = buildMediaApp(app, {});
    // A bucket with none of the required controls must not synthesize silently.
    new Bucket(storage, "UnreviewedBucket");
    assert.throws(() => app.synth(), /AwsSolutions-S1|Validation failed|violation/i);
  });
});

describe("app: deployment guard", () => {
  it("allows offline synthesis when no credentials are present", () => {
    assert.doesNotThrow(() => assertDeployTarget(DEV_DEFAULTS, {}));
  });

  it("refuses to run against credentials when no target account was named", () => {
    assert.throws(() => assertDeployTarget(DEV_DEFAULTS, { CDK_DEFAULT_ACCOUNT: "210987654321" }), /no target was named/);
  });

  it("refuses to run against a different account than the named one", () => {
    const config = { ...DEV_DEFAULTS, accountId: "123456789012" };
    assert.throws(() => assertDeployTarget(config, { CDK_DEFAULT_ACCOUNT: "210987654321" }), /Refusing to continue/);
    assert.doesNotThrow(() => assertDeployTarget(config, { CDK_DEFAULT_ACCOUNT: "123456789012" }));
  });

  it("throws while building the app when credentials do not match", () => {
    assert.throws(
      () => synthMediaApp({ "aarvasa:accountId": "123456789012" }, { CDK_DEFAULT_ACCOUNT: "999999999999" }),
      /Refusing to continue/,
    );
  });
});

describe("app: configuration validation", () => {
  it("accepts exact https origins and local development origins", () => {
    for (const origin of ["http://localhost:3000", "http://127.0.0.1:3000", "https://dev.aarvasa.com", "https://main.d1abc2def3.amplifyapp.com"]) {
      assert.equal(validateOrigin(origin), origin);
    }
  });

  it("rejects wildcards, paths, trailing slashes, plain http and uppercase", () => {
    for (const origin of ["*", "https://*.aarvasa.com", "https://aarvasa.com/", "https://aarvasa.com/app", "http://aarvasa.com", "https://Aarvasa.com", "null", ""]) {
      assert.throws(() => validateOrigin(origin), `expected ${JSON.stringify(origin)} to be rejected`);
    }
  });

  it("rejects malformed account ids, web ACL ARNs and distribution ids", () => {
    const load = (context: Record<string, string>) => loadDevConfig(new App({ context }));
    assert.throws(() => load({ "aarvasa:accountId": "12345" }), /12-digit/);
    assert.throws(() => load({ "aarvasa:webAclArn": "arn:aws:wafv2:ap-south-1:123456789012:regional/webacl/x/1" }), /CloudFront-scoped/);
    assert.throws(() => load({ "aarvasa:distributionId": "not-an-id" }), /distribution id/);
  });

  it("defaults to the repository's only local origin", () => {
    assert.deepEqual(loadDevConfig(new App()).allowedOrigins, ["http://localhost:3000"]);
  });
});
