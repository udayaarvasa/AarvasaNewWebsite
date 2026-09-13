import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DEV_DEFAULTS } from "../src/config";
import { MEDIA_BILLING_SERVICES } from "../src/stacks/media-monitoring-stack";
import { MediaEdgeStack } from "../src/stacks/media-edge-stack";
import { resourcesOfType, synthMediaApp } from "./helpers";

describe("edge stack: WAF", () => {
  const { templates } = synthMediaApp();
  const e = templates.edge;

  it("defines one CloudFront-scoped web ACL that allows by default", () => {
    e.resourceCountIs("AWS::WAFv2::WebACL", 1);
    e.hasResourceProperties("AWS::WAFv2::WebACL", {
      Name: "aarvasa-media-dev-cdn",
      Scope: "CLOUDFRONT",
      DefaultAction: { Allow: {} },
      VisibilityConfig: { CloudWatchMetricsEnabled: true, SampledRequestsEnabled: true, MetricName: "aarvasa-media-dev-cdn" },
    });
    e.resourceCountIs("AWS::WAFv2::WebACLAssociation", 0);
  });

  it("uses a single conservative per-IP rate rule", () => {
    const [acl] = resourcesOfType(e, "AWS::WAFv2::WebACL");
    const rules = acl.properties.Rules as Array<Record<string, unknown>>;
    assert.equal(rules.length, 1);
    assert.deepEqual(rules[0], {
      Name: "aarvasa-media-dev-rate-per-ip",
      Priority: 0,
      Action: { Block: {} },
      Statement: { RateBasedStatement: { AggregateKeyType: "IP", Limit: 3000, EvaluationWindowSec: 300 } },
      VisibilityConfig: { CloudWatchMetricsEnabled: true, MetricName: "aarvasa-media-dev-rate-per-ip", SampledRequestsEnabled: true },
    });
  });

  it("can run the rate rule in count mode without other changes", () => {
    const app = new App();
    const stack = new MediaEdgeStack(app, "CountMode", {
      env: { region: "us-east-1" },
      config: { ...DEV_DEFAULTS, waf: { ...DEV_DEFAULTS.waf, action: "count" } },
    });
    const [acl] = resourcesOfType(Template.fromStack(stack), "AWS::WAFv2::WebACL");
    assert.deepEqual((acl.properties.Rules as Array<{ Action: unknown }>)[0].Action, { Count: {} });
  });
});

describe("monitoring stack", () => {
  const { templates } = synthMediaApp();
  const m = templates.monitoring;

  it("sends alerts to a topic with no invented subscribers", () => {
    m.resourceCountIs("AWS::SNS::Topic", 1);
    m.resourceCountIs("AWS::SNS::Subscription", 0);
    const [topic] = resourcesOfType(m, "AWS::SNS::Topic");
    assert.equal(topic.properties.Subscription, undefined);
    assert.ok(!JSON.stringify(m.toJSON()).match(/"EMAIL"|@[a-z0-9-]+\.[a-z]{2,}/i), "no email subscriptions or addresses");
  });

  it("defines a tag-scoped budget and a service-scoped budget, both notifying SNS", () => {
    const budgets = resourcesOfType(m, "AWS::Budgets::Budget");
    assert.equal(budgets.length, 2);
    for (const b of budgets) {
      const notifications = b.properties.NotificationsWithSubscribers as Array<{
        Notification: { NotificationType: string; Threshold: number };
        Subscribers: Array<{ SubscriptionType: string }>;
      }>;
      assert.deepEqual(
        notifications.map((n) => `${n.Notification.NotificationType}:${n.Notification.Threshold}`),
        ["ACTUAL:50", "ACTUAL:80", "ACTUAL:100", "FORECASTED:100"],
      );
      assert.ok(notifications.every((n) => n.Subscribers.every((s) => s.SubscriptionType === "SNS")));
    }
    const services = budgets.find((b) => JSON.stringify(b.properties).includes('"SERVICE"'));
    assert.ok(services);
    assert.ok(JSON.stringify(services.properties).includes(JSON.stringify(MEDIA_BILLING_SERVICES)));
    const tagged = budgets.find((b) => JSON.stringify(b.properties).includes('"Project"'));
    assert.ok(tagged);
    assert.equal((tagged.properties.Budget as { BudgetLimit: { Amount: number } }).BudgetLimit.Amount, 25);
  });

  it("alarms on WAF blocks using CloudFront-scoped dimensions (no Region)", () => {
    m.hasResourceProperties("AWS::CloudWatch::Alarm", {
      Namespace: "AWS/WAFV2",
      MetricName: "BlockedRequests",
      Dimensions: [
        { Name: "Rule", Value: "ALL" },
        { Name: "WebACL", Value: "aarvasa-media-dev-cdn" },
      ],
    });
  });

  it("skips CloudFront alarms until a distribution id is supplied", () => {
    const cloudFrontAlarms = resourcesOfType(m, "AWS::CloudWatch::Alarm").filter((a) => a.properties.Namespace === "AWS/CloudFront");
    assert.equal(cloudFrontAlarms.length, 0);
  });

  it("adds request, transfer, 4xx and 5xx alarms once the distribution id is known", () => {
    const { templates: withId } = synthMediaApp({ "aarvasa:distributionId": "E1ABCDEFGH2IJK" });
    const alarms = resourcesOfType(withId.monitoring, "AWS::CloudWatch::Alarm").filter(
      (a) => a.properties.Namespace === "AWS/CloudFront",
    );
    assert.deepEqual(alarms.map((a) => a.properties.MetricName).sort(), ["4xxErrorRate", "5xxErrorRate", "BytesDownloaded", "Requests"]);
    for (const a of alarms) {
      assert.deepEqual(a.properties.Dimensions, [
        { Name: "DistributionId", Value: "E1ABCDEFGH2IJK" },
        { Name: "Region", Value: "Global" },
      ]);
      assert.equal((a.properties.AlarmActions as unknown[]).length, 1);
    }
  });
});
