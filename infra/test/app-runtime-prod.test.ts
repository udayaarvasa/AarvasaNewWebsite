import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { APP_CONFIG_SECRET_KEYS, AppRuntimeProdStack, CONTAINER_PORT } from "../src/stacks/app-runtime-prod-stack";

const app = new App();
const stack = new AppRuntimeProdStack(app, "AppRuntimeTest", {
  env: { account: "123456789012", region: "us-east-1" },
  namePrefix: "aarvasa-web-prod",
  vpcId: "vpc-0123456789abcdef0",
  availabilityZones: ["us-east-1a", "us-east-1b"],
  publicSubnetIds: ["subnet-aaaaaaaaaaaaaaaaa", "subnet-bbbbbbbbbbbbbbbbb"],
  databaseSecurityGroupId: "sg-0databasedatabase",
  databaseSecretName: "aarvasa/prod/database/app-runtime",
  appConfigSecretName: "aarvasa/prod/web/app-config",
  cloudFrontPrefixListId: "pl-3b927c52",
  imageRepositoryName: "aarvasa-web",
  imageTag: "abc1234",
});
type Res = { Type: string; Properties: Record<string, any> };
const t = Template.fromStack(stack).toJSON() as { Resources: Record<string, Res> };
const ofType = (type: string) => Object.values(t.Resources).filter((r) => r.Type === type).map((r) => r.Properties);

describe("private-database web runtime", () => {
  it("only ADDS a database ingress rule — from the task group, on 5432, never a CIDR", () => {
    const rules = ofType("AWS::EC2::SecurityGroupIngress").filter((r) => r.GroupId === "sg-0databasedatabase");
    assert.equal(rules.length, 1);
    assert.equal(rules[0].FromPort, 5432);
    assert.ok(rules[0].SourceSecurityGroupId, "source is a security group");
    assert.equal(rules[0].CidrIp, undefined);
    // No resource in this stack touches the database instance itself.
    assert.equal(ofType("AWS::RDS::DBInstance").length, 0);
  });

  it("admits the ALB from CloudFront's origin-facing range only, and the tasks from the ALB only", () => {
    const [alb] = ofType("AWS::ElasticLoadBalancingV2::LoadBalancer");
    assert.equal(alb.Scheme, "internet-facing");
    const groups = ofType("AWS::EC2::SecurityGroup");
    for (const g of groups) {
      assert.match(String(g.GroupDescription), /^[a-zA-Z0-9. _\-:/()#,@[\]+=&;{}!$*]*$/, "CloudFormation-valid description");
      assert.equal((g.SecurityGroupIngress ?? []).length, 0, "no inline ingress");
    }
    const ingress = ofType("AWS::EC2::SecurityGroupIngress");
    assert.equal(ingress.some((r) => r.CidrIp || r.CidrIpv6), false, "no CIDR ingress anywhere");
    assert.deepEqual(ingress.filter((r) => r.FromPort === 80).map((r) => r.SourcePrefixListId), ["pl-3b927c52"]);
    const taskIngress = ofType("AWS::EC2::SecurityGroupIngress").filter((r) => r.FromPort === CONTAINER_PORT);
    assert.equal(taskIngress.length, 1);
    assert.ok(taskIngress[0].SourceSecurityGroupId);
  });

  it("injects every secret from Secrets Manager; none is a plain environment variable", () => {
    const [task] = ofType("AWS::ECS::TaskDefinition");
    const [web] = task.ContainerDefinitions;
    const names = web.Secrets.map((s: any) => s.Name).sort();
    assert.deepEqual(names, ["DATABASE_URL", ...APP_CONFIG_SECRET_KEYS].sort());
    const env = Object.fromEntries(web.Environment.map((e: any) => [e.Name, e.Value]));
    for (const k of ["DATABASE_URL", ...APP_CONFIG_SECRET_KEYS]) assert.equal(env[k], undefined, k);
  });

  it("runs two tasks with public IPs (no NAT gateway) and rolls back a failed deployment", () => {
    const [svc] = ofType("AWS::ECS::Service");
    assert.equal(svc.DesiredCount, 2);
    assert.equal(svc.NetworkConfiguration.AwsvpcConfiguration.AssignPublicIp, "ENABLED");
    assert.deepEqual(svc.DeploymentConfiguration.DeploymentCircuitBreaker, { Enable: true, Rollback: true });
    assert.equal(ofType("AWS::EC2::NatGateway").length, 0);
  });

  it("never caches through CloudFront, so a session cookie cannot be replayed", () => {
    const [cdn] = ofType("AWS::CloudFront::Distribution");
    const b = cdn.DistributionConfig.DefaultCacheBehavior;
    assert.equal(b.CachePolicyId, "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"); // Managed-CachingDisabled
    assert.equal(b.ViewerProtocolPolicy, "redirect-to-https");
  });
});
