import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  HttpVersion,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { LoadBalancerV2Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { CfnSecurityGroupIngress, Peer, Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Repository } from "aws-cdk-lib/aws-ecr";
import {
  Cluster,
  ContainerImage,
  ContainerInsights,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDrivers,
  OperatingSystemFamily,
  Secret as EcsSecret,
} from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancer, ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

/**
 * The production web runtime that reaches the database privately.
 *
 * WHY. Amplify Hosting's SSR compute cannot join a VPC, so while the site runs
 * there the database must accept connections from the internet. This stack is
 * the replacement path: the same Next.js app as a container on ECS Fargate in
 * the database's own VPC and region, so the database can later drop its public
 * endpoint and its 0.0.0.0/0 rule.
 *
 * SHAPE, chosen for the fewest moving parts and no NAT gateway:
 *   CloudFront -> ALB (accepts only CloudFront's origin-facing range)
 *              -> Fargate tasks in the VPC's public subnets with public IPs
 *                 (outbound to Google, Gemini and Cloudinary needs no NAT)
 *              -> RDS on 5432, admitted from the task security group only.
 *
 * WHAT IT DOES NOT DO. It never removes the database's public access or its
 * existing rules: it only ADDS an ingress rule from the task security group.
 * Closing the public path is a separate, later step in
 * docs/private-database-runbook.md, taken only after the cutover is proven.
 *
 * Secrets are read at task start: DATABASE_URL from the existing restricted
 * aarvasa_app secret (its `url` field), everything else from one app-config
 * secret. Nothing secret is a plain environment variable or in the image.
 */

export const APP_RUNTIME_PROD_STACK_ID = "AarvasaAppRuntimeProd";

/** Keys the app-config secret must hold (DATABASE_URL comes from the database secret). */
export const APP_CONFIG_SECRET_KEYS = [
  "AUTH_SECRET",
  "AUTH_URL",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "GEMINI_API_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_UPLOAD_PRESET",
] as const;

export const CONTAINER_PORT = 3000;

export interface AppRuntimeProdStackProps extends StackProps {
  readonly namePrefix: string;
  /** The VPC the database lives in. */
  readonly vpcId: string;
  readonly availabilityZones: readonly string[];
  /** Public subnets of that VPC, one per availability zone, in the same order. */
  readonly publicSubnetIds: readonly string[];
  /** The database's security group, which gains one ingress rule from the tasks. */
  readonly databaseSecurityGroupId: string;
  /** The restricted aarvasa_app secret; its `url` field becomes DATABASE_URL. */
  readonly databaseSecretName: string;
  /** JSON secret holding APP_CONFIG_SECRET_KEYS. */
  readonly appConfigSecretName: string;
  /** CloudFront's managed origin-facing prefix list in this region. */
  readonly cloudFrontPrefixListId: string;
  readonly imageRepositoryName: string;
  readonly imageTag: string;
  /** Tasks to run. Two keeps the site up through a task replacement. */
  readonly desiredCount?: number;
}

export class AppRuntimeProdStack extends Stack {
  public readonly service: FargateService;
  public readonly loadBalancer: ApplicationLoadBalancer;
  public readonly distribution: Distribution;
  public readonly taskSecurityGroup: SecurityGroup;

  constructor(scope: Construct, id: string, props: AppRuntimeProdStackProps) {
    super(scope, id, props);

    if (props.availabilityZones.length !== props.publicSubnetIds.length || props.publicSubnetIds.length < 2) {
      throw new Error("Give at least two public subnets, one per availability zone, in matching order.");
    }

    const vpc = Vpc.fromVpcAttributes(this, "Vpc", {
      vpcId: props.vpcId,
      availabilityZones: [...props.availabilityZones],
      publicSubnetIds: [...props.publicSubnetIds],
    });

    const albSecurityGroup = new SecurityGroup(this, "AlbSecurityGroup", {
      vpc,
      description: "ALB - HTTP from the CloudFront origin-facing range only",
      allowAllOutbound: false,
    });
    albSecurityGroup.addIngressRule(Peer.prefixList(props.cloudFrontPrefixListId), Port.tcp(80), "CloudFront origin-facing");

    this.taskSecurityGroup = new SecurityGroup(this, "TaskSecurityGroup", {
      vpc,
      description: "Web tasks: from the ALB only; outbound for the database and third-party APIs",
      allowAllOutbound: true,
    });
    this.taskSecurityGroup.addIngressRule(albSecurityGroup, Port.tcp(CONTAINER_PORT), "ALB to web tasks");
    albSecurityGroup.addEgressRule(this.taskSecurityGroup, Port.tcp(CONTAINER_PORT), "ALB to web tasks");

    // The one change to the database: admit the tasks. Nothing is removed.
    new CfnSecurityGroupIngress(this, "DatabaseFromTasks", {
      groupId: props.databaseSecurityGroupId,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: this.taskSecurityGroup.securityGroupId,
      description: "Aarvasa web tasks (private path)",
    });

    const databaseSecret = Secret.fromSecretNameV2(this, "DatabaseSecret", props.databaseSecretName);
    const appConfigSecret = Secret.fromSecretNameV2(this, "AppConfigSecret", props.appConfigSecretName);

    const logGroup = new LogGroup(this, "Logs", {
      logGroupName: `/${props.namePrefix}/web`,
      retention: RetentionDays.THREE_MONTHS,
    });

    const taskDefinition = new FargateTaskDefinition(this, "Task", {
      cpu: 512,
      memoryLimitMiB: 1024,
      runtimePlatform: { cpuArchitecture: CpuArchitecture.X86_64, operatingSystemFamily: OperatingSystemFamily.LINUX },
    });
    taskDefinition.addContainer("web", {
      image: ContainerImage.fromEcrRepository(
        Repository.fromRepositoryName(this, "Images", props.imageRepositoryName),
        props.imageTag,
      ),
      portMappings: [{ containerPort: CONTAINER_PORT }],
      environment: { NODE_ENV: "production", AUTH_TRUST_HOST: "true" },
      secrets: {
        DATABASE_URL: EcsSecret.fromSecretsManager(databaseSecret, "url"),
        ...Object.fromEntries(APP_CONFIG_SECRET_KEYS.map((k) => [k, EcsSecret.fromSecretsManager(appConfigSecret, k)])),
      },
      logging: LogDrivers.awsLogs({ logGroup, streamPrefix: "web" }),
      readonlyRootFilesystem: false,
    });

    const cluster = new Cluster(this, "Cluster", {
      vpc,
      containerInsightsV2: ContainerInsights.ENABLED,
    });

    this.service = new FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: props.desiredCount ?? 2,
      assignPublicIp: true,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      securityGroups: [this.taskSecurityGroup],
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      circuitBreaker: { rollback: true },
    });

    this.loadBalancer = new ApplicationLoadBalancer(this, "Alb", {
      vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      dropInvalidHeaderFields: true,
    });
    const listener = this.loadBalancer.addListener("Http", {
      port: 80,
      protocol: ApplicationProtocol.HTTP,
      open: false,
    });
    listener.addTargets("Web", {
      port: CONTAINER_PORT,
      protocol: ApplicationProtocol.HTTP,
      targets: [this.service],
      healthCheck: { path: "/robots.txt", healthyHttpCodes: "200", interval: Duration.seconds(15) },
      deregistrationDelay: Duration.seconds(20),
    });

    this.distribution = new Distribution(this, "Cdn", {
      comment: `${props.namePrefix}: Aarvasa web (private database path)`,
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_ALL,
      defaultBehavior: {
        origin: new LoadBalancerV2Origin(this.loadBalancer, { protocolPolicy: OriginProtocolPolicy.HTTP_ONLY }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        // The app sets its own Cache-Control; sessions must never be cached.
        cachePolicy: CachePolicy.CACHING_DISABLED,
        originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
      },
    });

    new CfnOutput(this, "DistributionDomain", { value: this.distribution.distributionDomainName });
    new CfnOutput(this, "TaskSecurityGroupId", { value: this.taskSecurityGroup.securityGroupId });
  }
}
