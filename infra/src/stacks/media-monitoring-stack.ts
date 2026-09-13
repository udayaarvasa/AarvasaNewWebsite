import { Annotations, CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import { CfnBudget } from "aws-cdk-lib/aws-budgets";
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import type { Construct } from "constructs";
import type { MediaEnvironmentConfig } from "../config";
import { createAlertTopic } from "./alarm-topic";

export interface MediaMonitoringStackProps extends StackProps {
  readonly config: MediaEnvironmentConfig;
}

/** Media-relevant AWS services, as named in AWS Billing's SERVICE dimension. */
export const MEDIA_BILLING_SERVICES = ["Amazon CloudFront", "Amazon Simple Storage Service", "AWS WAF"];

/**
 * Cost and traffic monitoring. Lives in us-east-1 because CloudFront metrics,
 * CloudFront-scoped WAF metrics and AWS Budgets are all global/us-east-1.
 *
 * Notifications go to an SNS topic with no subscriptions; the team subscribes a
 * shared destination after review.
 */
export class MediaMonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: MediaMonitoringStackProps) {
    super(scope, id, props);
    const cfg = props.config;
    const prefix = cfg.namePrefix;
    const m = cfg.monitoring;

    const topic = createAlertTopic(this, "CostAndTrafficAlertTopic", `${prefix}-cost-and-traffic-alerts`, {
      cloudWatch: true,
      budgets: true,
    });
    const action = new SnsAction(topic);

    // ── Budgets ─────────────────────────────────────────────────────────────────
    const notifications = (): CfnBudget.NotificationWithSubscribersProperty[] =>
      [
        { notificationType: "ACTUAL", threshold: 50 },
        { notificationType: "ACTUAL", threshold: 80 },
        { notificationType: "ACTUAL", threshold: 100 },
        { notificationType: "FORECASTED", threshold: 100 },
      ].map((n) => ({
        notification: { ...n, comparisonOperator: "GREATER_THAN", thresholdType: "PERCENTAGE" },
        subscribers: [{ subscriptionType: "SNS", address: topic.topicArn }],
      }));

    // Spend on resources tagged Project/Environment. Requires those tags to be
    // activated as cost allocation tags in the Billing console (a manual,
    // account-level step documented in the runbook).
    new CfnBudget(this, "TaggedMediaBudget", {
      budget: {
        budgetName: `${prefix}-tagged-monthly`,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: m.monthlyBudgetUsd, unit: "USD" },
        filterExpression: {
          and: [
            { tags: { key: "Project", values: [cfg.tags.Project], matchOptions: ["EQUALS"] } },
            { tags: { key: "Environment", values: [cfg.tags.Environment], matchOptions: ["EQUALS"] } },
          ],
        },
      },
      notificationsWithSubscribers: notifications(),
    });

    // Catches spend the tag filter misses (e.g. tags not yet activated). This is
    // account-wide for these services, so it may include non-media usage.
    new CfnBudget(this, "MediaServicesBudget", {
      budget: {
        budgetName: `${prefix}-cdn-storage-waf-services-monthly`,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: m.monthlyBudgetUsd * 2, unit: "USD" },
        filterExpression: {
          dimensions: { key: "SERVICE", values: MEDIA_BILLING_SERVICES, matchOptions: ["EQUALS"] },
        },
      },
      notificationsWithSubscribers: notifications(),
    });

    // ── CloudFront traffic ──────────────────────────────────────────────────────
    if (m.distributionId) {
      const cf = (metricName: string, statistic: string, period: Duration) =>
        new Metric({
          namespace: "AWS/CloudFront",
          metricName,
          dimensionsMap: { DistributionId: m.distributionId as string, Region: "Global" },
          statistic,
          period,
        });

      const alarms = [
        new Alarm(this, "RequestSpikeAlarm", {
          alarmName: `${prefix}-cdn-request-spike`,
          alarmDescription: "Unexpected request volume on the development media CDN.",
          metric: cf("Requests", "Sum", Duration.minutes(5)),
          threshold: m.requestsPerFiveMinutesAlarm,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
        }),
        new Alarm(this, "DataTransferSpikeAlarm", {
          alarmName: `${prefix}-cdn-bytes-downloaded-spike`,
          alarmDescription: "Unexpected data transfer out of the development media CDN.",
          metric: cf("BytesDownloaded", "Sum", Duration.hours(1)),
          threshold: m.bytesDownloadedPerHourAlarm,
          evaluationPeriods: 1,
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
        }),
        new Alarm(this, "Error4xxRateAlarm", {
          alarmName: `${prefix}-cdn-4xx-rate`,
          alarmDescription: "Sustained 4xx rate: broken keys, CORS/policy misconfiguration, or scanning.",
          metric: cf("4xxErrorRate", "Average", Duration.minutes(5)),
          threshold: m.error4xxRatePercentAlarm,
          evaluationPeriods: 3,
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
        }),
        new Alarm(this, "Error5xxRateAlarm", {
          alarmName: `${prefix}-cdn-5xx-rate`,
          alarmDescription: "Sustained 5xx rate: origin access or edge function failures.",
          metric: cf("5xxErrorRate", "Average", Duration.minutes(5)),
          threshold: m.error5xxRatePercentAlarm,
          evaluationPeriods: 3,
          comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
          treatMissingData: TreatMissingData.NOT_BREACHING,
        }),
      ];
      for (const alarm of alarms) alarm.addAlarmAction(action);
    } else {
      Annotations.of(this).addWarningV2(
        "aarvasa:media:no-distribution-alarms",
        "CloudFront alarms skipped: pass -c aarvasa:distributionId=<DistributionId output> after the Storage stack exists.",
      );
    }

    // ── WAF (CloudFront-scoped metrics have WebACL + Rule dimensions, no Region) ─
    const wafBlocked = new Alarm(this, "WafBlockedRequestsAlarm", {
      alarmName: `${prefix}-waf-blocked-requests`,
      alarmDescription: "The CDN web ACL is blocking an unusual number of requests (possible abuse or a threshold that is too low).",
      metric: new Metric({
        namespace: "AWS/WAFV2",
        metricName: "BlockedRequests",
        dimensionsMap: { WebACL: cfg.waf.webAclName, Rule: "ALL" },
        statistic: "Sum",
        period: Duration.minutes(5),
      }),
      threshold: m.wafBlockedPerFiveMinutesAlarm,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    wafBlocked.addAlarmAction(action);

    if (cfg.waf.action === "count") {
      const wafCounted = new Alarm(this, "WafRateRuleCountedAlarm", {
        alarmName: `${prefix}-waf-rate-rule-would-block`,
        alarmDescription: "The rate rule (count mode) matched requests it would have blocked.",
        metric: new Metric({
          namespace: "AWS/WAFV2",
          metricName: "CountedRequests",
          dimensionsMap: { WebACL: cfg.waf.webAclName, Rule: cfg.waf.rateRuleName },
          statistic: "Sum",
          period: Duration.minutes(5),
        }),
        threshold: 0,
        evaluationPeriods: 1,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: TreatMissingData.NOT_BREACHING,
      });
      wafCounted.addAlarmAction(action);
    }

    new CfnOutput(this, "CostAndTrafficAlertTopicArn", { value: topic.topicArn });
  }
}
