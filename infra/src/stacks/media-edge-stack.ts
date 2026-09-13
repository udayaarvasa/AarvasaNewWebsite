import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import { CfnWebACL } from "aws-cdk-lib/aws-wafv2";
import type { Construct } from "constructs";
import type { MediaEnvironmentConfig } from "../config";

export interface MediaEdgeStackProps extends StackProps {
  readonly config: MediaEnvironmentConfig;
}

/**
 * CloudFront-scoped WAF web ACL. CloudFront web ACLs must be created in
 * us-east-1, which is why this is a separate stack from the storage stack.
 *
 * Deliberately minimal: one per-IP rate rule. Managed rule groups (IP reputation,
 * bot control) are left for production hardening.
 */
export class MediaEdgeStack extends Stack {
  readonly webAcl: CfnWebACL;

  constructor(scope: Construct, id: string, props: MediaEdgeStackProps) {
    super(scope, id, props);
    const { waf } = props.config;

    this.webAcl = new CfnWebACL(this, "CdnWebAcl", {
      name: waf.webAclName,
      scope: "CLOUDFRONT",
      // CloudFormation restricts this field's character set (no parentheses).
      description: "Aarvasa immersive media CDN, development. Per-IP rate limiting only.",
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: waf.webAclName,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: waf.rateRuleName,
          priority: 0,
          action: waf.action === "block" ? { block: {} } : { count: {} },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: "IP",
              limit: waf.rateLimit,
              evaluationWindowSec: waf.evaluationWindowSeconds,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: waf.rateRuleName,
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    new CfnOutput(this, "WebAclArn", {
      value: this.webAcl.attrArn,
      description: "Pass to the storage stack with -c aarvasa:webAclArn=<value>",
    });
  }
}
