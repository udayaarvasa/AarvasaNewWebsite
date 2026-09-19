import { Annotations, CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import {
  AllowedMethods,
  CachedMethods,
  CachePolicy,
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CacheQueryStringBehavior,
  type CfnDistribution,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  HttpVersion,
  ResponseHeadersPolicy,
  S3OriginAccessControl,
  Signing,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { AnyPrincipal, Effect, ManagedPolicy, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
  ObjectOwnership,
} from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { MediaEnvironmentConfig } from "../config";
import { renderViewerRequestFunction } from "../edge-function";
import { appUploadIntentStatements, processorStatements } from "../iam-policies";
import { CDN_PREFIXES, INGEST_PREFIX, PUBLISHED_BUCKET_PREFIXES } from "../../../shared/media-contract";
import { createAlertTopic } from "./alarm-topic";

export interface MediaStorageStackProps extends StackProps {
  readonly config: MediaEnvironmentConfig;
}

/** Exposed to the browser for debugging and for engines that inspect sizes/ranges. */
export const CORS_EXPOSED_HEADERS = ["Content-Length", "Content-Range", "Accept-Ranges", "ETag"];

/**
 * Content Security Policy for the media host itself. It only matters if someone
 * opens a media URL as a document: nothing may load, frame or script. It has no
 * effect on the Aarvasa pages that fetch these assets; their CSP belongs to the
 * Next.js application.
 */
export const MEDIA_HOST_CSP = "default-src 'none'; frame-ancestors 'none'; sandbox";

export class MediaStorageStack extends Stack {
  readonly ingestBucket: Bucket;
  readonly publishedBucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: MediaStorageStackProps) {
    super(scope, id, props);
    const cfg = props.config;
    const prefix = cfg.namePrefix;

    // ── Ingest bucket: temporary, browser-uploaded, never served ────────────────
    this.ingestBucket = new Bucket(this, "IngestBucket", {
      bucketName: `${prefix}-ingest-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      // Uploads are transient; versioning would only retain rejected or abandoned files.
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "expire-uploads-and-abort-multipart",
          enabled: true,
          expiration: Duration.days(cfg.ingest.expireAfterDays),
          abortIncompleteMultipartUploadAfter: Duration.days(cfg.ingest.abortIncompleteMultipartAfterDays),
        },
      ],
      // For the future direct browser upload flow (presigned POST / multipart PUT).
      cors: [
        {
          id: "browser-direct-uploads",
          allowedOrigins: [...cfg.allowedOrigins],
          allowedMethods: [HttpMethods.PUT, HttpMethods.POST],
          allowedHeaders: ["content-type", "x-amz-checksum-sha256", "x-amz-sdk-checksum-algorithm"],
          exposedHeaders: ["ETag", "x-amz-checksum-sha256"],
          maxAge: 3000,
        },
      ],
    });

    this.ingestBucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "DenyWritesOutsideUploadsPrefix",
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ["s3:PutObject"],
        notResources: [this.ingestBucket.arnForObjects(`${INGEST_PREFIX}/*`)],
      }),
    );

    // ── Published bucket: immutable derivatives + private originals ─────────────
    this.publishedBucket = new Bucket(this, "PublishedBucket", {
      bucketName: `${prefix}-published-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      // Versioning is the recovery path for an accidental delete. Overwrites are
      // blocked outright by the conditional-write policy below.
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: "expire-noncurrent-versions",
          enabled: true,
          noncurrentVersionExpiration: Duration.days(cfg.published.noncurrentVersionExpireAfterDays),
          expiredObjectDeleteMarker: true,
        },
        {
          id: "abort-incomplete-multipart",
          enabled: true,
          abortIncompleteMultipartUploadAfter: Duration.days(cfg.published.abortIncompleteMultipartAfterDays),
        },
      ],
    });

    this.publishedBucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "DenyWritesOutsideLayout",
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ["s3:PutObject"],
        notResources: PUBLISHED_BUCKET_PREFIXES.map((p) => this.publishedBucket.arnForObjects(`${p}/*`)),
      }),
    );

    // Write-once: PutObject and CompleteMultipartUpload must carry If-None-Match,
    // so S3 rejects any write to an existing key. CreateMultipartUpload and
    // UploadPart cannot carry the header and are exempted by ObjectCreationOperation.
    // Side effect (documented by AWS): CopyObject into this bucket is refused.
    this.publishedBucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "DenyOverwritesRequireIfNoneMatch",
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ["s3:PutObject"],
        resources: [this.publishedBucket.arnForObjects("*")],
        conditions: {
          Null: { "s3:if-none-match": "true" },
          Bool: { "s3:ObjectCreationOperation": "true" },
        },
      }),
    );

    // ── CloudFront ──────────────────────────────────────────────────────────────
    const originAccessControl = new S3OriginAccessControl(this, "PublishedOriginAccessControl", {
      originAccessControlName: `${prefix}-published-oac`,
      description: "SigV4-signed access from the media distribution to the private published bucket",
      signing: Signing.SIGV4_ALWAYS,
    });

    const cachePolicy = new CachePolicy(this, "ImmutableMediaCachePolicy", {
      cachePolicyName: `${prefix}-immutable-media`,
      comment: "Path-only cache key for content-addressed media. No cookies, headers or query strings.",
      // Published objects carry max-age=31536000; defaultTtl applies only if one is missing.
      defaultTtl: Duration.days(1),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.days(365),
      cookieBehavior: CacheCookieBehavior.none(),
      headerBehavior: CacheHeaderBehavior.none(),
      queryStringBehavior: CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const responseHeadersPolicy = new ResponseHeadersPolicy(this, "MediaResponseHeadersPolicy", {
      responseHeadersPolicyName: `${prefix}-media-headers`,
      comment: "CORS allowlist and media-host security headers. Applies to every response, including errors.",
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowOrigins: [...cfg.allowedOrigins],
        accessControlAllowMethods: ["GET", "HEAD", "OPTIONS"],
        accessControlAllowHeaders: ["Range"],
        accessControlExposeHeaders: CORS_EXPOSED_HEADERS,
        accessControlMaxAge: Duration.days(1),
        originOverride: true,
      },
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: HeadersReferrerPolicy.NO_REFERRER, override: true },
        // No includeSubDomains/preload: the dev host is a shared cloudfront.net name.
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: false, preload: false, override: true },
        contentSecurityPolicy: { contentSecurityPolicy: MEDIA_HOST_CSP, override: true },
      },
      customHeadersBehavior: {
        customHeaders: [
          // Lets Aarvasa pages embed posters/assets even if they later adopt COEP.
          { header: "Cross-Origin-Resource-Policy", value: "cross-origin", override: true },
          // Allowed origin is echoed per request, so browser caches must key on Origin.
          { header: "Vary", value: "Origin, Accept-Encoding", override: true },
        ],
      },
      removeHeaders: ["x-amz-server-side-encryption", "x-amz-version-id"],
    });

    const viewerRequestFunction = new CloudFrontFunction(this, "ViewerRequestFunction", {
      functionName: `${prefix}-viewer-request`,
      comment: "Path/extension allowlist, CORS preflight, strip query strings and cookies",
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(renderViewerRequestFunction(cfg.allowedOrigins)),
    });

    const origin = S3BucketOrigin.withBucketDefaults(this.publishedBucket, { originId: "published-media" });

    this.distribution = new Distribution(this, "MediaDistribution", {
      comment: `Aarvasa immersive media (${cfg.envName})`,
      enabled: true,
      httpVersion: HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      priceClass: cfg.cdn.priceClass,
      enableLogging: false,
      webAclId: cfg.cdn.webAclArn,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: CachedMethods.CACHE_GET_HEAD,
        cachePolicy,
        responseHeadersPolicy,
        compress: true,
        functionAssociations: [{ function: viewerRequestFunction, eventType: FunctionEventType.VIEWER_REQUEST }],
      },
      errorResponses: [
        { httpStatus: 403, ttl: Duration.seconds(cfg.cdn.errorCachingSeconds.forbidden) },
        { httpStatus: 404, ttl: Duration.seconds(cfg.cdn.errorCachingSeconds.notFound) },
        ...[500, 502, 503, 504].map((httpStatus) => ({
          httpStatus,
          ttl: Duration.seconds(cfg.cdn.errorCachingSeconds.serverError),
        })),
      ],
    });

    // CDK's withOriginAccessControl() grants GetObject on the whole bucket, which
    // would expose originals/. Attach the OAC directly and grant only CDN prefixes.
    const cfnDistribution = this.distribution.node.defaultChild as CfnDistribution;
    cfnDistribution.addPropertyOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      originAccessControl.originAccessControlId,
    );

    const distributionArn = `arn:${this.partition}:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`;
    this.publishedBucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "AllowCloudFrontReadCdnPrefixesOnly",
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: CDN_PREFIXES.map((p) => this.publishedBucket.arnForObjects(`${p}/*`)),
        conditions: { StringEquals: { "AWS:SourceArn": distributionArn } },
      }),
    );
    this.publishedBucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "DenyCloudFrontReadOriginals",
        effect: Effect.DENY,
        principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [this.publishedBucket.arnForObjects("originals/*")],
      }),
    );

    if (!cfg.cdn.webAclArn) {
      Annotations.of(this.distribution).addWarningV2(
        "aarvasa:media:no-waf",
        "No WAF web ACL associated. Deploy the Edge stack first and pass -c aarvasa:webAclArn=<WebAclArn output> before deploying this stack.",
      );
    }

    // ── IAM policies for later phases (created unattached) ──────────────────────
    const appPolicy = new ManagedPolicy(this, "AppUploadIntentPolicy", {
      managedPolicyName: `${prefix}-app-upload-intents`,
      description: "FUTURE: Amplify SSR compute role. Presign/complete/inspect ingest uploads only. Not attached.",
      statements: appUploadIntentStatements(this.ingestBucket.bucketArn),
    });
    const processorPolicy = new ManagedPolicy(this, "ProcessorPolicy", {
      managedPolicyName: `${prefix}-processor`,
      description: "FUTURE: media processing worker. Read uploads, write-once derivatives under m/. Not attached.",
      statements: processorStatements(this.ingestBucket.bucketArn, this.publishedBucket.bucketArn),
    });

    // ── Regional storage alarms (S3 storage metrics are reported in the bucket region) ─
    const storageTopic = createAlertTopic(this, "StorageAlertTopic", `${prefix}-storage-alerts`, {
      cloudWatch: true,
      budgets: false,
    });
    const daily = Duration.days(1);
    const publishedBytes = new Alarm(this, "PublishedBucketSizeAlarm", {
      alarmName: `${prefix}-published-bucket-size`,
      alarmDescription: "Published media storage is larger than expected for development.",
      metric: new Metric({
        namespace: "AWS/S3",
        metricName: "BucketSizeBytes",
        dimensionsMap: { BucketName: this.publishedBucket.bucketName, StorageType: "StandardStorage" },
        statistic: "Average",
        period: daily,
      }),
      threshold: cfg.monitoring.publishedBucketBytesAlarm,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    const ingestObjects = new Alarm(this, "IngestObjectCountAlarm", {
      alarmName: `${prefix}-ingest-object-count`,
      alarmDescription: "Ingest bucket holds more objects than lifecycle expiry should allow; check for abuse or a broken rule.",
      metric: new Metric({
        namespace: "AWS/S3",
        metricName: "NumberOfObjects",
        dimensionsMap: { BucketName: this.ingestBucket.bucketName, StorageType: "AllStorageTypes" },
        statistic: "Average",
        period: daily,
      }),
      threshold: cfg.monitoring.ingestObjectCountAlarm,
      evaluationPeriods: 1,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: TreatMissingData.NOT_BREACHING,
    });
    for (const alarm of [publishedBytes, ingestObjects]) alarm.addAlarmAction(new SnsAction(storageTopic));

    // ── Outputs ─────────────────────────────────────────────────────────────────
    new CfnOutput(this, "IngestBucketName", { value: this.ingestBucket.bucketName });
    new CfnOutput(this, "PublishedBucketName", { value: this.publishedBucket.bucketName });
    new CfnOutput(this, "DistributionId", {
      value: this.distribution.distributionId,
      description: "Pass to the monitoring stack with -c aarvasa:distributionId=<value>",
    });
    new CfnOutput(this, "MediaCdnOrigin", { value: `https://${this.distribution.distributionDomainName}` });
    new CfnOutput(this, "AppUploadIntentPolicyArn", { value: appPolicy.managedPolicyArn });
    new CfnOutput(this, "ProcessorPolicyArn", { value: processorPolicy.managedPolicyArn });
    new CfnOutput(this, "StorageAlertTopicArn", { value: storageTopic.topicArn });
  }
}
