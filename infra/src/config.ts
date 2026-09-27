import type { App } from "aws-cdk-lib";
import { PriceClass } from "aws-cdk-lib/aws-cloudfront";

/**
 * Development environment configuration. Values that identify a real AWS account
 * or already-deployed resources are never hard-coded: they are supplied with
 * `-c key=value` only when someone deliberately runs diff/deploy.
 */
export type WafRuleAction = "block" | "count";

export interface MediaEnvironmentConfig {
  readonly envName: "dev";
  /** Resource name prefix, e.g. aarvasa-media-dev. */
  readonly namePrefix: string;
  /** Region for the S3 buckets and the distribution's stack. */
  readonly storageRegion: string;
  /** CloudFront-scoped WAF, CloudFront metrics and Budgets live in us-east-1. */
  readonly globalRegion: "us-east-1";
  /** Target AWS account. Required before any diff or deploy; absent for offline synth. */
  readonly accountId: string | undefined;
  /** Exact browser origins allowed to fetch media with CORS. No wildcards, no credentials. */
  readonly allowedOrigins: readonly string[];
  readonly ingest: {
    readonly expireAfterDays: number;
    readonly abortIncompleteMultipartAfterDays: number;
  };
  readonly published: {
    readonly noncurrentVersionExpireAfterDays: number;
    readonly abortIncompleteMultipartAfterDays: number;
    /** Private review copies (review/*) are removed after this; review must happen before. */
    readonly reviewExpireAfterDays: number;
  };
  readonly cdn: {
    readonly priceClass: PriceClass;
    /** Short TTLs so a key requested before it is published is not negatively cached for long. */
    readonly errorCachingSeconds: { readonly notFound: number; readonly forbidden: number; readonly serverError: number };
    /** WAF web ACL ARN from the edge stack's output. Absent until the edge stack exists. */
    readonly webAclArn: string | undefined;
  };
  readonly waf: {
    readonly webAclName: string;
    readonly rateRuleName: string;
    /** Requests per client IP per evaluation window before the rule matches. */
    readonly rateLimit: number;
    readonly evaluationWindowSeconds: 60 | 120 | 300 | 600;
    readonly action: WafRuleAction;
  };
  readonly monitoring: {
    /** Distribution id from the storage stack's output. Absent until that stack exists. */
    readonly distributionId: string | undefined;
    readonly monthlyBudgetUsd: number;
    readonly requestsPerFiveMinutesAlarm: number;
    readonly bytesDownloadedPerHourAlarm: number;
    readonly error4xxRatePercentAlarm: number;
    readonly error5xxRatePercentAlarm: number;
    readonly wafBlockedPerFiveMinutesAlarm: number;
    readonly publishedBucketBytesAlarm: number;
    readonly ingestObjectCountAlarm: number;
  };
  readonly processing: {
    /** Key of the processing Lambda bundle in the artifact bucket (uploaded before deploying). */
    readonly artifactKey: string;
    /** S3 object version of that bundle, so a new upload is an explicit, reviewed deploy. */
    readonly artifactVersion: string | undefined;
    /** Secrets Manager secret holding the DEV application DATABASE_URL. Absent until one exists. */
    readonly databaseSecretArn: string | undefined;
    /**
     * VPC the processing functions join so they can reach a PRIVATE database.
     * Absent leaves them outside a VPC, which means no database access at all —
     * the alternative, a publicly reachable Postgres, is not one worth having.
     */
    readonly vpcId: string | undefined;
    /** Security group for those functions; the database admits only this group. */
    readonly lambdaSecurityGroupId: string | undefined;
  };
  readonly tags: Readonly<Record<string, string>>;
}

/** The only local origin the repository uses: `next dev` on its default port. */
const REPO_DEV_ORIGINS = ["http://localhost:3000"];

const GIB = 1024 ** 3;

export const DEV_DEFAULTS: MediaEnvironmentConfig = {
  envName: "dev",
  namePrefix: "aarvasa-media-dev",
  storageRegion: "ap-south-1",
  globalRegion: "us-east-1",
  accountId: undefined,
  allowedOrigins: REPO_DEV_ORIGINS,
  ingest: { expireAfterDays: 7, abortIncompleteMultipartAfterDays: 1 },
  published: { noncurrentVersionExpireAfterDays: 30, abortIncompleteMultipartAfterDays: 1, reviewExpireAfterDays: 30 },
  cdn: {
    // Dev traffic is negligible; All keeps India and UAE edges in play without assumptions.
    priceClass: PriceClass.PRICE_CLASS_ALL,
    errorCachingSeconds: { notFound: 10, forbidden: 10, serverError: 0 },
    webAclArn: undefined,
  },
  waf: {
    webAclName: "aarvasa-media-dev-cdn",
    rateRuleName: "aarvasa-media-dev-rate-per-ip",
    rateLimit: 3000,
    evaluationWindowSeconds: 300,
    action: "block",
  },
  monitoring: {
    distributionId: undefined,
    monthlyBudgetUsd: 25,
    requestsPerFiveMinutesAlarm: 50_000,
    bytesDownloadedPerHourAlarm: 20 * GIB,
    error4xxRatePercentAlarm: 25,
    error5xxRatePercentAlarm: 5,
    wafBlockedPerFiveMinutesAlarm: 500,
    publishedBucketBytesAlarm: 50 * GIB,
    ingestObjectCountAlarm: 5_000,
  },
  processing: {
    artifactKey: "processing/processing-lambdas.zip",
    artifactVersion: undefined,
    databaseSecretArn: undefined,
    vpcId: undefined,
    lambdaSecurityGroupId: undefined,
  },
  tags: {
    Project: "aarvasa-media",
    Environment: "dev",
    ManagedBy: "aws-cdk",
  },
};

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/;
const HTTPS_ORIGIN = /^https:\/\/[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{2,5})?$/;

/** Throws for anything that is not an exact, lowercase, path-free origin. */
export function validateOrigin(origin: string): string {
  if (origin.includes("*")) throw new Error(`Wildcard origins are not allowed: ${origin}`);
  if (!LOCAL_ORIGIN.test(origin) && !HTTPS_ORIGIN.test(origin)) {
    throw new Error(
      `Invalid origin "${origin}". Use https://host[:port] (or http://localhost[:port] for local development), lowercase, with no path or trailing slash.`,
    );
  }
  return origin;
}

const ACCOUNT_ID = /^\d{12}$/;
const DISTRIBUTION_ID = /^E[A-Z0-9]{8,20}$/;
const ARTIFACT_KEY = /^[A-Za-z0-9][A-Za-z0-9/_.-]{0,200}\.zip$/;
const SECRET_ARN = /^arn:aws:secretsmanager:[a-z]{2}(-[a-z]+)+-\d:\d{12}:secret:[A-Za-z0-9/_+=.@-]{1,512}$/;
const WEB_ACL_ARN = /^arn:aws:wafv2:us-east-1:\d{12}:global\/webacl\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}$/;

function contextString(app: App, key: string): string | undefined {
  const value: unknown = app.node.tryGetContext(key);
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`Context "${key}" must be a string`);
  return value.trim();
}

/**
 * Builds the dev config from defaults plus explicit context overrides:
 *
 *   -c aarvasa:accountId=123456789012
 *   -c aarvasa:allowedOrigins=http://localhost:3000,https://dev.example.com
 *   -c aarvasa:webAclArn=arn:aws:wafv2:us-east-1:...
 *   -c aarvasa:distributionId=E123...
 *   -c aarvasa:processingArtifactKey=processing/processing-lambdas-<version>.zip
 *   -c aarvasa:processingArtifactVersion=<S3 object version id of that zip>
 *   -c aarvasa:databaseSecretArn=arn:aws:secretsmanager:ap-south-1:...:secret:...
 */
export function loadDevConfig(app: App): MediaEnvironmentConfig {
  const accountId = contextString(app, "aarvasa:accountId");
  if (accountId !== undefined && !ACCOUNT_ID.test(accountId)) {
    throw new Error("aarvasa:accountId must be a 12-digit AWS account id");
  }

  const originsRaw = contextString(app, "aarvasa:allowedOrigins");
  const allowedOrigins = originsRaw
    ? [...new Set(originsRaw.split(",").map((o) => validateOrigin(o.trim())))]
    : DEV_DEFAULTS.allowedOrigins.map(validateOrigin);
  if (allowedOrigins.length === 0) throw new Error("At least one allowed origin is required");

  const webAclArn = contextString(app, "aarvasa:webAclArn");
  if (webAclArn !== undefined && !WEB_ACL_ARN.test(webAclArn)) {
    throw new Error("aarvasa:webAclArn must be a CloudFront-scoped (us-east-1, global) WAFv2 web ACL ARN");
  }

  const distributionId = contextString(app, "aarvasa:distributionId");
  if (distributionId !== undefined && !DISTRIBUTION_ID.test(distributionId)) {
    throw new Error("aarvasa:distributionId must be a CloudFront distribution id (E...)");
  }

  const artifactKey = contextString(app, "aarvasa:processingArtifactKey") ?? DEV_DEFAULTS.processing.artifactKey;
  if (!ARTIFACT_KEY.test(artifactKey) || artifactKey.includes("..")) throw new Error("aarvasa:processingArtifactKey must be a .zip object key");
  const artifactVersion = contextString(app, "aarvasa:processingArtifactVersion");
  if (artifactVersion !== undefined && !/^[A-Za-z0-9._-]{1,1024}$/.test(artifactVersion)) throw new Error("aarvasa:processingArtifactVersion must be an S3 object version id");
  const databaseSecretArn = contextString(app, "aarvasa:databaseSecretArn");
  if (databaseSecretArn !== undefined && !SECRET_ARN.test(databaseSecretArn)) {
    throw new Error("aarvasa:databaseSecretArn must be a Secrets Manager secret ARN");
  }

  /* Networking for the processing functions. Both are optional: without them
     the functions stay outside a VPC and simply cannot reach a database, which
     is the safe default — the alternative is a Postgres open to the internet. */
  const vpcId = contextString(app, "aarvasa:vpcId");
  if (vpcId !== undefined && !/^vpc-[0-9a-f]{8,17}$/.test(vpcId)) {
    throw new Error("aarvasa:vpcId must be a VPC id, e.g. vpc-0123456789abcdef0");
  }
  const lambdaSecurityGroupId = contextString(app, "aarvasa:lambdaSecurityGroupId");
  if (lambdaSecurityGroupId !== undefined && !/^sg-[0-9a-f]{8,17}$/.test(lambdaSecurityGroupId)) {
    throw new Error("aarvasa:lambdaSecurityGroupId must be a security group id, e.g. sg-0123456789abcdef0");
  }
  if (vpcId === undefined && lambdaSecurityGroupId !== undefined) {
    throw new Error("aarvasa:lambdaSecurityGroupId needs aarvasa:vpcId as well");
  }

  return {
    ...DEV_DEFAULTS,
    accountId,
    allowedOrigins,
    cdn: { ...DEV_DEFAULTS.cdn, webAclArn },
    monitoring: { ...DEV_DEFAULTS.monitoring, distributionId },
    processing: { artifactKey, artifactVersion, databaseSecretArn, vpcId, lambdaSecurityGroupId },
  };
}

/**
 * Refuses to synthesize against real credentials unless the target account was
 * named explicitly and matches. The CDK CLI sets CDK_DEFAULT_ACCOUNT whenever it
 * finds credentials (diff, deploy), and leaves it unset for offline synth.
 */
export function assertDeployTarget(config: MediaEnvironmentConfig, env: NodeJS.ProcessEnv): void {
  const detected = env.CDK_DEFAULT_ACCOUNT;
  if (!detected) return;
  if (!config.accountId) {
    throw new Error(
      `AWS credentials for account ${detected} are active, but no target was named. ` +
        "Pass -c aarvasa:accountId=<dev account id> to confirm this is the development account.",
    );
  }
  if (detected !== config.accountId) {
    throw new Error(
      `Refusing to continue: credentials are for account ${detected}, but aarvasa:accountId is ${config.accountId}.`,
    );
  }
}
