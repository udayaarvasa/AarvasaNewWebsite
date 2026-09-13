import { Stack } from "aws-cdk-lib";
import { AnyPrincipal, Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Topic } from "aws-cdk-lib/aws-sns";
import type { Construct } from "constructs";

/**
 * An alert topic with no subscriptions. Recipients are added by the team after
 * review (e.g. a shared on-call address or chat integration), never invented here.
 *
 * The topic policy replaces SNS's default policy, so it must explicitly let the
 * publishing services in, scoped to this account.
 */
export function createAlertTopic(
  scope: Construct,
  id: string,
  topicName: string,
  publishers: { readonly cloudWatch: boolean; readonly budgets: boolean },
): Topic {
  const stack = Stack.of(scope);
  const topic = new Topic(scope, id, { topicName, displayName: topicName, enforceSSL: true });

  if (publishers.cloudWatch) {
    topic.addToResourcePolicy(
      new PolicyStatement({
        sid: "AllowCloudWatchAlarmsFromThisAccount",
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("cloudwatch.amazonaws.com")],
        actions: ["sns:Publish"],
        resources: [topic.topicArn],
        conditions: {
          StringEquals: { "aws:SourceAccount": stack.account },
          ArnLike: { "aws:SourceArn": `arn:${stack.partition}:cloudwatch:${stack.region}:${stack.account}:alarm:*` },
        },
      }),
    );
  }

  if (publishers.budgets) {
    topic.addToResourcePolicy(
      new PolicyStatement({
        sid: "AllowBudgetsFromThisAccount",
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("budgets.amazonaws.com")],
        actions: ["sns:Publish"],
        resources: [topic.topicArn],
        conditions: {
          StringEquals: { "aws:SourceAccount": stack.account },
          ArnLike: { "aws:SourceArn": `arn:${stack.partition}:budgets::${stack.account}:*` },
        },
      }),
    );
  }

  // Nobody outside this account may subscribe or publish.
  topic.addToResourcePolicy(
    new PolicyStatement({
      sid: "DenyOtherAccounts",
      effect: Effect.DENY,
      principals: [new AnyPrincipal()],
      actions: ["sns:Publish", "sns:Subscribe", "sns:Receive"],
      resources: [topic.topicArn],
      conditions: {
        StringNotEquals: { "aws:PrincipalAccount": stack.account },
        Bool: { "aws:PrincipalIsAWSService": "false" },
      },
    }),
  );

  return topic;
}
