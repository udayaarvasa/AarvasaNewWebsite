import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CORS_EXPOSED_HEADERS, MEDIA_HOST_CSP } from "../src/stacks/media-storage-stack";
import { asArray, type PolicyStatementJson, renderToken, resourcesOfType, synthMediaApp } from "./helpers";

const WEB_ACL_ARN =
  "arn:aws:wafv2:us-east-1:123456789012:global/webacl/aarvasa-media-dev-cdn/0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b";

const { templates, storage } = synthMediaApp();
const t = templates.storage;

function bucketPolicyStatements(bucketLogicalIdPrefix: string): PolicyStatementJson[] {
  const policy = resourcesOfType(t, "AWS::S3::BucketPolicy").find((p) =>
    renderToken((p.properties.Bucket as object)).includes(bucketLogicalIdPrefix),
  );
  assert.ok(policy, `bucket policy for ${bucketLogicalIdPrefix}`);
  return (policy.properties.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement;
}

function bucket(logicalIdPrefix: string) {
  const found = resourcesOfType(t, "AWS::S3::Bucket").find((b) => b.id.startsWith(logicalIdPrefix));
  assert.ok(found, logicalIdPrefix);
  return found.properties;
}

describe("storage stack: S3", () => {
  it("creates exactly two private, encrypted, owner-enforced buckets", () => {
    t.resourceCountIs("AWS::S3::Bucket", 2);
    for (const props of [bucket("IngestBucket"), bucket("PublishedBucket")]) {
      assert.deepEqual(props.PublicAccessBlockConfiguration, {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
      assert.deepEqual(props.BucketEncryption, {
        ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" } }],
      });
      assert.deepEqual(props.OwnershipControls, { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] });
      assert.equal(props.WebsiteConfiguration, undefined);
    }
  });

  it("retains both buckets if the stack is ever deleted", () => {
    for (const [id, r] of Object.entries(t.findResources("AWS::S3::Bucket"))) {
      assert.equal((r as { DeletionPolicy?: string }).DeletionPolicy, "Retain", id);
    }
  });

  it("expires ingest uploads and aborts incomplete multipart uploads", () => {
    const ingest = bucket("IngestBucket");
    assert.equal(ingest.VersioningConfiguration, undefined, "ingest is transient and unversioned");
    assert.deepEqual((ingest.LifecycleConfiguration as { Rules: unknown[] }).Rules, [
      {
        Id: "expire-uploads-and-abort-multipart",
        Status: "Enabled",
        ExpirationInDays: 7,
        AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
      },
    ]);
  });

  it("versions the published bucket and cleans up noncurrent versions and multipart uploads", () => {
    const published = bucket("PublishedBucket");
    assert.deepEqual(published.VersioningConfiguration, { Status: "Enabled" });
    const rules = (published.LifecycleConfiguration as { Rules: Array<Record<string, unknown>> }).Rules;
    assert.ok(rules.some((r) => (r.NoncurrentVersionExpiration as { NoncurrentDays: number })?.NoncurrentDays === 30));
    assert.ok(rules.some((r) => r.ExpiredObjectDeleteMarker === true));
    assert.ok(rules.some((r) => (r.AbortIncompleteMultipartUpload as { DaysAfterInitiation: number })?.DaysAfterInitiation === 1));
    // Only private review copies expire; published m/ objects never do.
    const expiring = rules.filter((r) => "ExpirationInDays" in r);
    assert.deepEqual(expiring, [{ Id: "expire-review-copies", Status: "Enabled", Prefix: "review/", ExpirationInDays: 30 }]);
  });

  it("allows browser uploads to ingest only from configured origins, without credentials", () => {
    const cors = (bucket("IngestBucket").CorsConfiguration as { CorsRules: Array<Record<string, unknown>> }).CorsRules;
    assert.equal(cors.length, 1);
    assert.deepEqual(cors[0].AllowedOrigins, ["http://localhost:3000"]);
    assert.deepEqual(cors[0].AllowedMethods, ["PUT", "POST"]);
    assert.ok((cors[0].ExposedHeaders as string[]).includes("ETag"), "multipart completion needs ETag");
    assert.equal(bucket("PublishedBucket").CorsConfiguration, undefined, "published bucket is only reached through CloudFront");
  });

  it("has no bucket policy that allows public or anonymous access", () => {
    for (const statements of [bucketPolicyStatements("IngestBucket"), bucketPolicyStatements("PublishedBucket")]) {
      for (const s of statements.filter((x) => x.Effect === "Allow")) {
        assert.notDeepEqual(s.Principal, "*");
        assert.notDeepEqual(s.Principal, { AWS: "*" });
        assert.ok(s.Condition, `allow statement ${s.Sid} must be conditioned`);
      }
    }
  });

  it("enforces TLS 1.2+ on both buckets", () => {
    for (const statements of [bucketPolicyStatements("IngestBucket"), bucketPolicyStatements("PublishedBucket")]) {
      assert.ok(statements.some((s) => s.Effect === "Deny" && JSON.stringify(s.Condition) === '{"Bool":{"aws:SecureTransport":"false"}}'));
      assert.ok(statements.some((s) => s.Effect === "Deny" && JSON.stringify(s.Condition) === '{"NumericLessThan":{"s3:TlsVersion":1.2}}'));
    }
  });

  it("lets CloudFront read only m/ and lib/, and explicitly never originals/ or review/", () => {
    const statements = bucketPolicyStatements("PublishedBucket");
    const allow = statements.find((s) => s.Sid === "AllowCloudFrontReadCdnPrefixesOnly");
    assert.ok(allow);
    assert.deepEqual(allow.Principal, { Service: "cloudfront.amazonaws.com" });
    assert.deepEqual(asArray(allow.Action), ["s3:GetObject"]);
    const resources = asArray(allow.Resource).map(renderToken).sort();
    assert.deepEqual(resources, ["<PublishedBucket054BAF30.Arn>/lib/*", "<PublishedBucket054BAF30.Arn>/m/*"]);
    const sourceArn = renderToken((allow.Condition?.StringEquals as Record<string, unknown>)["AWS:SourceArn"]);
    assert.match(sourceArn, /^arn:aws:cloudfront::<AWS::AccountId>:distribution\/<MediaDistribution/);

    const deny = statements.find((s) => s.Sid === "DenyCloudFrontReadPrivatePrefixes");
    assert.ok(deny);
    assert.equal(deny.Effect, "Deny");
    assert.deepEqual(deny.Principal, { Service: "cloudfront.amazonaws.com" });
    assert.deepEqual(asArray(deny.Resource).map(renderToken).sort(), ["<PublishedBucket054BAF30.Arn>/originals/*", "<PublishedBucket054BAF30.Arn>/review/*"]);

    // No other statement grants CloudFront (or anyone) GetObject on the whole bucket.
    for (const s of statements.filter((x) => x.Effect === "Allow")) {
      assert.ok(!asArray(s.Resource).map(renderToken).some((r) => r.endsWith(".Arn>/*")), `broad allow in ${s.Sid}`);
    }
  });

  it("makes published objects write-once and confines writes to the key layout", () => {
    const statements = bucketPolicyStatements("PublishedBucket");
    const overwrite = statements.find((s) => s.Sid === "DenyOverwritesRequireIfNoneMatch");
    assert.ok(overwrite);
    assert.equal(overwrite.Effect, "Deny");
    assert.deepEqual(overwrite.Condition, {
      Null: { "s3:if-none-match": "true" },
      Bool: { "s3:ObjectCreationOperation": "true" },
    });
    const layout = statements.find((s) => s.Sid === "DenyWritesOutsideLayout");
    assert.ok(layout);
    assert.deepEqual(asArray(layout.NotResource).map(renderToken).sort(), [
      "<PublishedBucket054BAF30.Arn>/lib/*",
      "<PublishedBucket054BAF30.Arn>/m/*",
      "<PublishedBucket054BAF30.Arn>/originals/*",
      "<PublishedBucket054BAF30.Arn>/review/*",
    ]);
    const ingestLayout = bucketPolicyStatements("IngestBucket").find((s) => s.Sid === "DenyWritesOutsideUploadsPrefix");
    assert.equal(renderToken(ingestLayout?.NotResource), "<IngestBucket2B3522FA.Arn>/uploads/*");
  });
});

describe("storage stack: CloudFront", () => {
  const distribution = () =>
    resourcesOfType(t, "AWS::CloudFront::Distribution")[0].properties.DistributionConfig as Record<string, unknown>;

  it("reaches the private bucket only through an Origin Access Control", () => {
    t.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
    t.hasResourceProperties("AWS::CloudFront::OriginAccessControl", {
      OriginAccessControlConfig: { OriginAccessControlOriginType: "s3", SigningBehavior: "always", SigningProtocol: "sigv4" },
    });
    t.resourceCountIs("AWS::CloudFront::CloudFrontOriginAccessIdentity", 0);
    const [origin] = distribution().Origins as Array<Record<string, unknown>>;
    assert.ok(renderToken(origin.OriginAccessControlId).startsWith("<PublishedOriginAccessControl"));
    assert.deepEqual(origin.S3OriginConfig, { OriginAccessIdentity: "" });
    assert.match(renderToken(origin.DomainName), /RegionalDomainName/);
  });

  it("serves HTTPS over HTTP/2 and HTTP/3 with compression, GET/HEAD/OPTIONS only", () => {
    const d = distribution();
    assert.equal(d.HttpVersion, "http2and3");
    assert.equal(d.IPV6Enabled, true);
    assert.equal(d.Aliases, undefined, "no custom domain in dev");
    assert.equal(d.DefaultRootObject, undefined);
    const b = d.DefaultCacheBehavior as Record<string, unknown>;
    assert.equal(b.ViewerProtocolPolicy, "redirect-to-https");
    assert.deepEqual(b.AllowedMethods, ["GET", "HEAD", "OPTIONS"]);
    assert.deepEqual(b.CachedMethods, ["GET", "HEAD"]);
    assert.equal(b.Compress, true);
    assert.equal(b.OriginRequestPolicyId, undefined, "no viewer headers, cookies or query strings are forwarded");
    assert.equal(d.CacheBehaviors, undefined, "a single behavior keeps the policy surface small");
    const associations = b.FunctionAssociations as Array<{ EventType: string; FunctionARN: unknown }>;
    assert.equal(associations.length, 1);
    assert.equal(associations[0].EventType, "viewer-request");
    assert.match(renderToken(associations[0].FunctionARN), /^<ViewerRequestFunction[A-F0-9]+\.FunctionARN>$/);
  });

  it("caches 403/404 briefly and never caches 5xx", () => {
    assert.deepEqual(distribution().CustomErrorResponses, [
      { ErrorCachingMinTTL: 10, ErrorCode: 403 },
      { ErrorCachingMinTTL: 10, ErrorCode: 404 },
      { ErrorCachingMinTTL: 0, ErrorCode: 500 },
      { ErrorCachingMinTTL: 0, ErrorCode: 502 },
      { ErrorCachingMinTTL: 0, ErrorCode: 503 },
      { ErrorCachingMinTTL: 0, ErrorCode: 504 },
    ]);
  });

  it("uses a path-only cache key suitable for immutable media", () => {
    t.hasResourceProperties("AWS::CloudFront::CachePolicy", {
      CachePolicyConfig: {
        DefaultTTL: 86400,
        MinTTL: 0,
        MaxTTL: 31536000,
        ParametersInCacheKeyAndForwardedToOrigin: {
          CookiesConfig: { CookieBehavior: "none" },
          HeadersConfig: { HeaderBehavior: "none" },
          QueryStringsConfig: { QueryStringBehavior: "none" },
          EnableAcceptEncodingGzip: true,
          EnableAcceptEncodingBrotli: true,
        },
      },
    });
  });

  it("adds an exact-origin CORS allowlist and media-host security headers", () => {
    const [policy] = resourcesOfType(t, "AWS::CloudFront::ResponseHeadersPolicy");
    const cfg = policy.properties.ResponseHeadersPolicyConfig as Record<string, Record<string, unknown>>;
    const cors = cfg.CorsConfig;
    /* True because Google's model loader fetches GLBs with withCredentials.
       It is only permissible alongside an exact origin allowlist — the wildcard
       assertion below is what keeps the pair honest. */
    assert.equal(cors.AccessControlAllowCredentials, true);
    assert.deepEqual(cors.AccessControlAllowOrigins, { Items: ["http://localhost:3000"] });
    assert.deepEqual(cors.AccessControlAllowMethods, { Items: ["GET", "HEAD", "OPTIONS"] });
    /* Range for byte-range media; Accept because Google's 3D model loader sends
       `Accept: model/vnd.collada+xml;context=google-earth`, which is not
       CORS-safelisted and so preflights for `accept`. With Range alone that
       preflight came back without an allow-origin header and the browser blocked
       every GLB fetch. Both named explicitly — a wildcard here would also admit
       Authorization. */
    assert.deepEqual(cors.AccessControlAllowHeaders, { Items: ["Range", "Accept"] });
    assert.deepEqual(cors.AccessControlExposeHeaders, { Items: CORS_EXPOSED_HEADERS });
    assert.deepEqual([...CORS_EXPOSED_HEADERS].sort(), ["Accept-Ranges", "Content-Length", "Content-Range", "ETag"]);
    assert.ok(!JSON.stringify(cors).includes('"*"'), "no wildcard origins, methods or headers");

    const security = cfg.SecurityHeadersConfig;
    assert.deepEqual(security.ContentTypeOptions, { Override: true });
    assert.deepEqual(security.FrameOptions, { FrameOption: "DENY", Override: true });
    assert.deepEqual(security.ReferrerPolicy, { ReferrerPolicy: "no-referrer", Override: true });
    assert.deepEqual(security.ContentSecurityPolicy, { ContentSecurityPolicy: MEDIA_HOST_CSP, Override: true });
    assert.deepEqual(security.StrictTransportSecurity, {
      AccessControlMaxAgeSec: 31536000,
      IncludeSubdomains: false,
      Preload: false,
      Override: true,
    });
    const custom = (cfg.CustomHeadersConfig.Items as Array<{ Header: string; Value: string }>).map((h) => `${h.Header}: ${h.Value}`);
    assert.deepEqual(custom, ["Cross-Origin-Resource-Policy: cross-origin", "Vary: Origin, Accept-Encoding"]);
  });

  it("embeds the same origins in the edge function and runs it on JS runtime 2.0", () => {
    const [fn] = resourcesOfType(t, "AWS::CloudFront::Function");
    assert.equal((fn.properties.FunctionConfig as { Runtime: string }).Runtime, "cloudfront-js-2.0");
    assert.ok((fn.properties.FunctionCode as string).includes('["http://localhost:3000"]'));
  });

  it("reports the missing WAF association instead of silently omitting it", () => {
    assert.equal(distribution().WebACLId, undefined);
    const warnings = storage.distribution.node.metadata.filter((m) => m.type === "aws:cdk:warning");
    assert.ok(warnings.some((w) => String(w.data).includes("aarvasa:webAclArn")));
  });
});

describe("storage stack: configuration overrides", () => {
  const origins = "http://localhost:3000,https://dev.aarvasa-preview.example";
  const { templates: overridden } = synthMediaApp({ "aarvasa:allowedOrigins": origins, "aarvasa:webAclArn": WEB_ACL_ARN });
  const s = overridden.storage;

  it("propagates allowed origins to CloudFront CORS, the edge function and ingest CORS", () => {
    const expected = origins.split(",");
    const [policy] = resourcesOfType(s, "AWS::CloudFront::ResponseHeadersPolicy");
    const cors = (policy.properties.ResponseHeadersPolicyConfig as Record<string, Record<string, unknown>>).CorsConfig;
    assert.deepEqual(cors.AccessControlAllowOrigins, { Items: expected });
    const [fn] = resourcesOfType(s, "AWS::CloudFront::Function");
    assert.ok((fn.properties.FunctionCode as string).includes(JSON.stringify(expected)));
    const ingest = resourcesOfType(s, "AWS::S3::Bucket").find((b) => b.id.startsWith("IngestBucket"));
    assert.deepEqual((ingest?.properties.CorsConfiguration as { CorsRules: Array<{ AllowedOrigins: string[] }> }).CorsRules[0].AllowedOrigins, expected);
  });

  it("associates the WAF web ACL when its ARN is supplied", () => {
    const d = resourcesOfType(s, "AWS::CloudFront::Distribution")[0].properties.DistributionConfig as Record<string, unknown>;
    assert.equal(d.WebACLId, WEB_ACL_ARN);
  });
});

describe("storage stack: IAM policies for later phases", () => {
  const policies = resourcesOfType(t, "AWS::IAM::ManagedPolicy");
  const byName = (name: string) => {
    const found = policies.find((p) => p.properties.ManagedPolicyName === name);
    assert.ok(found, name);
    return found.properties;
  };
  const statementsOf = (props: Record<string, unknown>) =>
    (props.PolicyDocument as { Statement: PolicyStatementJson[] }).Statement;

  it("creates the three policies unattached in this stack (the processing stack attaches the processor policy)", () => {
    assert.equal(policies.length, 3);
    for (const p of policies) {
      assert.equal(p.properties.Roles, undefined);
      assert.equal(p.properties.Users, undefined);
      assert.equal(p.properties.Groups, undefined);
    }
    t.resourceCountIs("AWS::IAM::Role", 0);
    t.resourceCountIs("AWS::IAM::User", 0);
  });

  it("never grants deletes, wildcards actions, bucket-wide access or infrastructure changes", () => {
    for (const p of policies) {
      for (const s of statementsOf(p.properties)) {
        assert.equal(s.Effect, "Allow");
        for (const action of asArray(s.Action)) {
          assert.ok(action.startsWith("s3:"), action);
          assert.ok(!action.includes("*"), action);
          assert.ok(!/Delete|PutBucket|PutObjectAcl|ListBucket|ListAllMyBuckets/.test(action), action);
        }
        for (const resource of asArray(s.Resource).map(renderToken)) {
          assert.match(resource, /\.Arn>\/(uploads|m|review)\/\*$/, `unexpected resource ${resource}`);
        }
      }
    }
  });

  it("limits the app role to presigning, completing and verifying ingest uploads", () => {
    const statements = statementsOf(byName("aarvasa-media-dev-app-upload-intents"));
    const actions = statements.flatMap((s) => asArray(s.Action)).sort();
    assert.deepEqual(actions, ["s3:AbortMultipartUpload", "s3:GetObject", "s3:GetObjectAttributes", "s3:ListMultipartUploadParts", "s3:PutObject"]);
    const resources = statements.flatMap((s) => asArray(s.Resource).map(renderToken));
    assert.ok(resources.every((r) => r === "<IngestBucket2B3522FA.Arn>/uploads/*"), "no published-bucket or bucket-wide access");
    // HeadObject verification needs s3:GetObject; it is granted on uploads/* only, and never listing.
    const getObject = statements.filter((s) => asArray(s.Action).includes("s3:GetObject"));
    assert.equal(getObject.length, 1);
    assert.deepEqual(asArray(getObject[0].Resource).map(renderToken), ["<IngestBucket2B3522FA.Arn>/uploads/*"]);
    assert.ok(!actions.some((a) => /ListBucket|DeleteObject/.test(a)));
  });

  it("limits the processor to reading uploads and writing/reading back private review copies (never m/)", () => {
    const statements = statementsOf(byName("aarvasa-media-dev-processor"));
    const grants = statements.flatMap((s) => asArray(s.Resource).map((r) => `${asArray(s.Action).join("|")} ${renderToken(r)}`));
    assert.deepEqual(grants.sort(), [
      "s3:GetObject|s3:GetObjectAttributes <IngestBucket2B3522FA.Arn>/uploads/*",
      "s3:GetObject|s3:GetObjectAttributes <PublishedBucket054BAF30.Arn>/review/*",
      "s3:PutObject <PublishedBucket054BAF30.Arn>/review/*",
    ].sort());
    assert.ok(!grants.some((g) => g.includes("/m/*")), "only an admin approval publishes to m/");
    assert.ok(!grants.some((g) => g.includes("/originals/*") || g.includes("/lib/*")));
  });

  it("gives the app's review policy preview reads of review/ and write-once publication to m/ only", () => {
    const statements = statementsOf(byName("aarvasa-media-dev-app-media-review"));
    const grants = statements.flatMap((s) => asArray(s.Resource).map((r) => `${asArray(s.Action).join("|")} ${renderToken(r)}`));
    assert.deepEqual(grants.sort(), [
      "s3:GetObject|s3:GetObjectAttributes <PublishedBucket054BAF30.Arn>/m/*",
      "s3:GetObject|s3:GetObjectAttributes <PublishedBucket054BAF30.Arn>/review/*",
      "s3:PutObject <PublishedBucket054BAF30.Arn>/m/*",
    ].sort());
    assert.ok(!grants.some((g) => g.includes("IngestBucket") || g.includes("/originals/*") || g.includes("/lib/*")));
  });
});
