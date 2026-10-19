import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  AllowedMethods,
  CacheCookieBehavior,
  CachedMethods,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  type CfnDistribution,
  Distribution,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  Function as CloudFrontFunction,
  HeadersFrameOption,
  HeadersReferrerPolicy,
  HttpVersion,
  PriceClass,
  ResponseHeadersPolicy,
  S3OriginAccessControl,
  Signing,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Effect, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { renderViewerRequestFunction } from "../edge-function";
import { CORS_EXPOSED_HEADERS, MEDIA_HOST_CSP } from "./media-storage-stack";

/**
 * Production delivery for approved, public building models — and nothing else.
 *
 * Deliberately not the media pipeline. There is no ingest bucket, no review
 * prefix, no processing queue and no application write access: an operator
 * uploads a model here only after it has passed validation and its public
 * release is recorded in PUBLIC_MODEL_APPROVALS (src/lib/projects.ts). The
 * bucket is private; CloudFront reads it through origin access control, and only
 * under the content-addressed `m/` prefix.
 *
 * Browsers may read it from the production site origins only. Google's 3D model
 * loader fetches a GLB credentialed and with a non-safelisted Accept header, so
 * the CORS policy is an exact credentialed allowlist and the viewer-request
 * function answers the preflight (see media-storage-stack.ts for the evidence).
 */

export const MODEL_DELIVERY_PROD_STACK_ID = "AarvasaModelsProd-Delivery";

/** The only browser origins that may read production models. Exact, never a wildcard. */
export const PROD_MODEL_READ_ORIGINS = ["https://aarvasa.com", "https://www.aarvasa.com"] as const;

export interface ModelDeliveryProdStackProps extends StackProps {
  readonly namePrefix: string;
}

export class ModelDeliveryProdStack extends Stack {
  public readonly bucket: Bucket;
  public readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: ModelDeliveryProdStackProps) {
    super(scope, id, props);
    const prefix = props.namePrefix;

    this.bucket = new Bucket(this, "ModelsBucket", {
      bucketName: `${prefix}-${this.account}-${this.region}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Versioned so an overwritten or deleted model can be restored.
      versioned: true,
      lifecycleRules: [{ noncurrentVersionExpiration: Duration.days(90), abortIncompleteMultipartUploadAfter: Duration.days(1) }],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const originAccessControl = new S3OriginAccessControl(this, "ModelsOriginAccessControl", {
      originAccessControlName: `${prefix}-oac`,
      description: "SigV4-signed access from the production model distribution to the private models bucket",
      signing: Signing.SIGV4_ALWAYS,
    });

    const cachePolicy = new CachePolicy(this, "ImmutableModelCachePolicy", {
      cachePolicyName: `${prefix}-immutable`,
      comment: "Path-only cache key for content-addressed models. No cookies, headers or query strings.",
      defaultTtl: Duration.days(1),
      minTtl: Duration.seconds(0),
      maxTtl: Duration.days(365),
      cookieBehavior: CacheCookieBehavior.none(),
      headerBehavior: CacheHeaderBehavior.none(),
      queryStringBehavior: CacheQueryStringBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const responseHeadersPolicy = new ResponseHeadersPolicy(this, "ModelResponseHeadersPolicy", {
      responseHeadersPolicyName: `${prefix}-headers`,
      comment: "Exact production-origin CORS for Google's 3D model loader, and media-host security headers.",
      corsBehavior: {
        accessControlAllowCredentials: true,
        accessControlAllowOrigins: [...PROD_MODEL_READ_ORIGINS],
        accessControlAllowMethods: ["GET", "HEAD", "OPTIONS"],
        accessControlAllowHeaders: ["Range", "Accept"],
        accessControlExposeHeaders: CORS_EXPOSED_HEADERS,
        accessControlMaxAge: Duration.days(1),
        originOverride: true,
      },
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: HeadersReferrerPolicy.NO_REFERRER, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), includeSubdomains: false, preload: false, override: true },
        contentSecurityPolicy: { contentSecurityPolicy: MEDIA_HOST_CSP, override: true },
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: "Cross-Origin-Resource-Policy", value: "cross-origin", override: true },
          { header: "Vary", value: "Origin, Accept-Encoding", override: true },
        ],
      },
      removeHeaders: ["x-amz-server-side-encryption", "x-amz-version-id"],
    });

    const viewerRequestFunction = new CloudFrontFunction(this, "ModelViewerRequestFunction", {
      functionName: `${prefix}-viewer-request`,
      comment: "Path/extension allowlist, CORS preflight, strip query strings and cookies",
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromInline(renderViewerRequestFunction(PROD_MODEL_READ_ORIGINS)),
    });

    this.distribution = new Distribution(this, "ModelsDistribution", {
      comment: "Aarvasa approved public building models (production)",
      enabled: true,
      httpVersion: HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      // North America, Europe, Middle East, India: the site's audience.
      priceClass: PriceClass.PRICE_CLASS_200,
      enableLogging: false,
      defaultBehavior: {
        origin: S3BucketOrigin.withBucketDefaults(this.bucket, { originId: "approved-models" }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: CachedMethods.CACHE_GET_HEAD,
        cachePolicy,
        responseHeadersPolicy,
        compress: true,
        functionAssociations: [{ function: viewerRequestFunction, eventType: FunctionEventType.VIEWER_REQUEST }],
      },
      errorResponses: [
        { httpStatus: 403, ttl: Duration.seconds(60) },
        { httpStatus: 404, ttl: Duration.seconds(60) },
        ...[500, 502, 503, 504].map((httpStatus) => ({ httpStatus, ttl: Duration.seconds(0) })),
      ],
    });

    (this.distribution.node.defaultChild as CfnDistribution).addPropertyOverride(
      "DistributionConfig.Origins.0.OriginAccessControlId",
      originAccessControl.originAccessControlId,
    );

    const distributionArn = `arn:${this.partition}:cloudfront::${this.account}:distribution/${this.distribution.distributionId}`;
    this.bucket.addToResourcePolicy(
      new PolicyStatement({
        sid: "AllowCloudFrontReadModelsOnly",
        effect: Effect.ALLOW,
        principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
        actions: ["s3:GetObject"],
        resources: [this.bucket.arnForObjects("m/*")],
        conditions: { StringEquals: { "AWS:SourceArn": distributionArn } },
      }),
    );

    new CfnOutput(this, "ModelsCdnOrigin", { value: `https://${this.distribution.distributionDomainName}` });
    new CfnOutput(this, "ModelsDistributionId", { value: this.distribution.distributionId });
    new CfnOutput(this, "ModelsBucketName", { value: this.bucket.bucketName });
  }
}
