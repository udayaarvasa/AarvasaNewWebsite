# Aarvasa immersive media infrastructure (development)

AWS CDK (TypeScript) definitions for the private S3 + CloudFront media platform
approved in Phase 2A, and the Phase 5 upload, processing and review pipeline.
No script in this repository deploys anything.

**Deployment status** (DEV account only; production has none of this):

| Stack | Status |
|---|---|
| `AarvasaMediaDev-Edge`, `-Storage`, `-Monitoring` | **Deployed to DEV** (Phase 3.5, September 2026) by an operator, reviewed stack by stack. The DEV CDN serves the Phase 3 pilot (a placeholder model). The Phase 5 changes to Storage (private `review/` prefix, `app-media-review` policy, processor narrowed to `review/`) are **not deployed yet**. |
| `AarvasaMediaDev-Processing` | **Not deployed.** Blocked on a DEV database (section 14): the worker and sweeper must never point at production. |
| Production | Nothing exists: no buckets, CDN, queues, functions, DNS or IAM. |

Cloudinary remains the system for normal 2D property photos. Immersive media
never goes through `/api/upload`.

---

## 1. Architecture

```
Admin upload UI (Phase 5)                        Aarvasa pages (future viewer)
   │ presigned PUT                                        │ GET (CORS, no credentials)
   ▼                                                      ▼
S3  aarvasa-media-dev-ingest-*  ── worker ──►  S3  aarvasa-media-dev-published-*
    uploads/… (expires 7 d)    (section 14)      review/… (private) ─approve─► m/…  lib/…  (CDN)
                                                 originals/… (never CDN)
                                                          ▲
                                                          │ OAC (SigV4), m/* and lib/* only
                                          CloudFront  d….cloudfront.net
                                          ├─ viewer-request Function: path/extension allowlist,
                                          │  CORS preflight, strip query strings + cookies
                                          ├─ cache policy: path-only key, gzip/br
                                          ├─ response headers policy: CORS + security headers
                                          └─ WAF web ACL (us-east-1): per-IP rate rule
```

| Stack | Region | Contents |
|---|---|---|
| `AarvasaMediaDev-Edge` | us-east-1 | WAF web ACL (CloudFront scope must be us-east-1) |
| `AarvasaMediaDev-Storage` | ap-south-1 | Both buckets and their policies, OAC, cache policy, response headers policy, CloudFront Function, distribution, **unattached** IAM policies, S3 storage alarms + topic |
| `AarvasaMediaDev-Monitoring` | us-east-1 | Budgets, CloudFront and WAF alarms, alert topic |
| `AarvasaMediaDev-Processing` | ap-south-1 | Processing queue + DLQ, worker and sweeper Lambdas (code from a private artifact bucket), SQS event source, 15-minute EventBridge schedule, roles, alarms (section 14) |

The stacks have **no cross-stack references**. The WAF ARN and distribution id
are passed explicitly (`-c`) after review, so each stack deploys on its own and
no hidden custom-resource Lambdas are generated.

## 2. Required AWS services

S3, CloudFront (distribution, Functions, OAC, cache and response headers
policies), WAFv2, CloudWatch alarms and Logs, SNS, AWS Budgets, SQS, Lambda,
EventBridge, Secrets Manager (read only), IAM. No custom resources and no CDK
bootstrap resources: the Lambdas load code from the processing stack's own
artifact bucket, not from CDK assets.

## 3. Bucket purposes

| Bucket | Purpose | Versioning | Lifecycle |
|---|---|---|---|
| `aarvasa-media-dev-ingest-{account}-{region}` | Temporary browser uploads, never served | Off (transient) | Expire after 7 days; abort incomplete multipart after 1 day |
| `aarvasa-media-dev-published-{account}-{region}` | Immutable derivatives, decoders, private originals, private review copies | On (recovery from accidental delete) | `review/` expires after 30 days; noncurrent versions expire after 30 days; expired delete markers removed; abort incomplete multipart after 1 day |

Both buckets: Block Public Access on all four settings, SSE-S3 encryption, bucket
owner enforced (ACLs disabled), TLS 1.2+ required, `RemovalPolicy.RETAIN`, no
public bucket policy. The published bucket's stack has termination protection.

## 4. Key layout

Defined once in `shared/media-contract.ts` (repository root) and shared by the bucket policies, the
edge function and the tests.

```
published bucket
  m/{mediaId}/{contentHash}/{file…}         CDN-served, immutable
  lib/{library}/{version}/{file…}           CDN-served, immutable decoders (Draco/Basis)
  originals/{mediaId}/{contentHash}/{file…} private source files, never CDN-served
  review/{mediaId}/{contentHash}/{file…}    private processed files awaiting review, never CDN-served
ingest bucket
  uploads/{mediaId}/{uploadId}/{file…}      temporary
```

- `contentHash` is lowercase hex (16–64 chars). A new asset version is a new
  hash, therefore a new path. There are no mutable aliases such as `latest/`.
- File names are preserved (`scene.glb`, `lod-meta.json`) because PlayCanvas
  selects parsers by extension or basename and resolves multi-file splat chunks
  relative to the manifest.
- Writes outside these prefixes are denied by bucket policy.

## 5. CloudFront behaviour

- Origin: private published bucket via **Origin Access Control** (SigV4 always).
  The bucket policy grants `s3:GetObject` to this distribution only, on `m/*`
  and `lib/*`, and explicitly denies `originals/*`. (CDK's convenience helper
  grants the whole bucket, so the OAC is attached directly; see
  `media-storage-stack.ts`.)
- HTTPS (HTTP redirects to HTTPS), HTTP/2 and HTTP/3, IPv6, compression on.
- Methods: GET, HEAD, OPTIONS. Cached: GET, HEAD.
- No origin request policy: no viewer cookies, headers or query strings reach
  S3. The viewer-request function also clears query strings and cookies, so a
  NextAuth session cookie can never enter the cache key or the origin request.
- Range requests pass through to S3 unchanged.
- Error caching: 403 and 404 for 10 s, 5xx for 0 s.
- Default `*.cloudfront.net` domain. No custom domain, certificate or DNS in dev.

### viewer-request function (`functions/viewer-request.js`)

1. Refuses methods other than GET/HEAD/OPTIONS (405).
2. Refuses any key that is not a valid `m/…` or `lib/…` key with an allowed
   extension (404), before the request reaches S3.
3. Answers CORS preflight itself: 204 with the exact origin echoed for allowed
   origins, 403 otherwise.
4. Strips query strings and cookies, then forwards.

This is a viewer-*request* function on purpose: CloudFront does not run
viewer-*response* functions when the origin returns 400 or above, so response
headers are handled by a response headers policy instead.

## 6. CORS

- Allowed origins default to `http://localhost:3000`, the only local origin the
  repository uses (`next dev`). No approved non-local development origin exists
  in the repository yet, so none is configured.
- Add origins at review time with `-c aarvasa:allowedOrigins=http://localhost:3000,https://…`.
  Values are validated: exact lowercase `https://host[:port]` (or local http),
  no wildcards, no paths, no trailing slash.
- Responses: `Access-Control-Allow-Origin` is set only when the request origin
  matches exactly. Methods GET/HEAD/OPTIONS; allowed request header `Range`;
  exposed `Content-Length, Content-Range, Accept-Ranges, ETag`; max-age 1 day;
  **no `Access-Control-Allow-Credentials`**. `Vary: Origin` keeps browser caches correct.
- The same origin list configures the ingest bucket's CORS (PUT/POST, exposing
  `ETag`) for the future direct-upload flow.
- Why not `*`: assets are public anyway, but an allowlist stops other sites from
  using the media in their own WebGL apps.

### Media host headers vs application headers

| On the media distribution (this stack) | On the Aarvasa Next.js app (later phase, not here) |
|---|---|
| `X-Content-Type-Options: nosniff` | `Content-Security-Policy` for pages, including `connect-src`/`img-src` for the media origin, `worker-src blob:` and `'wasm-unsafe-eval'` for PlayCanvas decoders |
| `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; sandbox`, which only matters if a media URL is opened as a document | `Strict-Transport-Security` with `includeSubDomains`/`preload` on the real domain |
| `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` | `Permissions-Policy`, `Referrer-Policy` for pages |
| `Strict-Transport-Security: max-age=31536000` (no subdomains/preload on the shared cloudfront.net name) | `X-Frame-Options`/`frame-ancestors` for pages |
| `Cross-Origin-Resource-Policy: cross-origin`, CORS headers | |
| Removes `x-amz-server-side-encryption`, `x-amz-version-id` | |

The main site's CSP is deliberately not copied here: it describes what a page may
load, which is meaningless for binary assets.

## 7. Cache strategy

- Every CDN object must be written with `Cache-Control: public, max-age=31536000, immutable`
  and its exact content type, from `publishedObjectMetadata()` in `shared/media-contract.ts`:

  | Extension | Content-Type |
  |---|---|
  | `.glb` | `model/gltf-binary` |
  | `.ktx2` | `image/ktx2` |
  | `.jpg` / `.jpeg` | `image/jpeg` |
  | `.webp` | `image/webp` |
  | `.sog` | `application/zip` |
  | `.json` | `application/json` |
  | `.wasm` | `application/wasm` |
  | `.js` (`lib/` only) | `text/javascript` |

- Cache key: path only (no cookies, headers or query strings). Query-string
  cache busting is impossible by design.
- Cache policy TTLs: max 365 days, default 1 day (used only if an object is
  missing `Cache-Control`), min 0.
- **No overwrites:** the published bucket denies `PutObject` and
  `CompleteMultipartUpload` without `If-None-Match` (S3 conditional-write
  enforcement), so writing to an existing key fails. CreateMultipartUpload and
  UploadPart are exempt, as AWS requires. Consequence: `CopyObject` into the
  published bucket is refused; publishers must upload.
- Versioning plus noncurrent-version expiry covers accidental deletes; nothing
  ever needs a CloudFront invalidation.

## 8. IAM model

| Policy / role | Principal | Allows | Does not allow |
|---|---|---|---|
| `aarvasa-media-dev-app-upload-intents` (managed, unattached) | Amplify SSR compute role | `PutObject`, `AbortMultipartUpload`, `ListMultipartUploadParts`, `GetObject`, `GetObjectAttributes` on `ingest/uploads/*` (presign, complete and verify uploads) | Anything outside `ingest/uploads/*`, deletes, listing |
| `aarvasa-media-dev-app-media-review` (managed, unattached) | Amplify SSR compute role | `GetObject`/`GetObjectAttributes` on `published/review/*` (presigned previews, publication source); write-once `PutObject` on `published/m/*`; `GetObject`/`GetObjectAttributes` on `published/m/*` (idempotent re-publish check) | `originals/*`, `lib/*`, ingest, deletes, listing |
| `aarvasa-media-dev-processing-producer` (managed, unattached) | Amplify SSR compute role; the sweeper role | `sqs:SendMessage` on the processing queue | Receiving, purging, the DLQ, anything else |
| `aarvasa-media-dev-processor` (managed) | Worker role | `GetObject`/`GetObjectAttributes` on `ingest/uploads/*`; write-once `PutObject` and read-back on `published/review/*` | `m/*` (only approval publishes), `originals/*`, `lib/*`, deletes, listing |
| `aarvasa-media-dev-processing-consumer` (managed) | Worker role | Receive, delete, change visibility, get attributes on the processing queue | Sending, purging, the DLQ |
| Role `aarvasa-media-dev-processing-worker` | Worker Lambda | processor + consumer policies; `secretsmanager:GetSecretValue` on the one DEV database secret; its own log group | Everything else |
| Role `aarvasa-media-dev-processing-sweeper` | Sweeper Lambda | producer policy; `s3:GetObject` (HeadObject) on `ingest/uploads/*`; the database secret; its own log group | Writes to S3, receiving jobs, everything else |

Database writes (worker, sweeper, app) go through the application database role
only, as single conditional updates (`src/lib/services/media-*.store.ts`).

`s3:GetObject` appears wherever HeadObject is used: S3 has no header-only
permission. `s3:ListBucket` is never granted, so S3 answers 403 rather than 404 for
a missing key under these policies; code treats 403 as "unavailable" (retryable),
never as proof of absence.

Bucket policies add defence in depth: TLS enforcement, prefix confinement (only
`m/`, `lib/`, `originals/`, `review/` may be written), write-once (If-None-Match),
CloudFront reads of `m/` and `lib/` only, and an explicit CloudFront deny on
`originals/*` and `review/*`.

## 9. Cost monitoring

- **Budgets** (monthly, 50/80/100 % actual and 100 % forecast):
  - `aarvasa-media-dev-tagged-monthly`, USD 25, resources tagged
    `Project=aarvasa-media` and `Environment=dev`. **Manual prerequisite:** activate
    `Project` and `Environment` as cost allocation tags in the Billing console,
    otherwise this budget sees no spend.
  - `aarvasa-media-dev-cdn-storage-waf-services-monthly`, USD 50,
    CloudFront + S3 + WAF account-wide, which catches untagged spend.
- **Alarms:**

  | Alarm | Signal | Threshold (dev) |
  |---|---|---|
  | `…-cdn-request-spike` | CloudFront Requests, 5 min | > 50,000 |
  | `…-cdn-bytes-downloaded-spike` | CloudFront BytesDownloaded, 1 h | > 20 GiB |
  | `…-cdn-4xx-rate` / `…-cdn-5xx-rate` | Error rate, 3 × 5 min | > 25 % / > 5 % |
  | `…-waf-blocked-requests` | WAF BlockedRequests, 5 min | > 500 |
  | `…-published-bucket-size` | S3 BucketSizeBytes, daily | > 50 GiB |
  | `…-ingest-object-count` | S3 NumberOfObjects, daily | > 5,000 (lifecycle or abuse) |

  CloudFront alarms are created only when `-c aarvasa:distributionId` is given.
- **Notifications** go to SNS topics with **no subscriptions**. Subscribe a shared
  team destination after review; no personal addresses are hard-coded.
- **Standing dev cost** when idle is mostly the WAF web ACL and rule (monthly
  fees) plus alarms; storage, requests and transfer are usage-based. Check current
  AWS pricing before deploying.

### WAF rate rule

| Setting | Value |
|---|---|
| Scope | CloudFront web ACL, default action Allow |
| Rule | `aarvasa-media-dev-rate-per-ip`, key = client IP |
| Threshold | 3,000 requests per IP per 5 minutes (~10 req/s sustained) |
| Action | Block (switch to Count by setting `waf.action: "count"` in `src/config.ts`) |

Rationale: a streamed Gaussian-splat scene can request hundreds of chunk files
in a session, and a panorama tour dozens; 3,000 per 5 minutes leaves room for
several heavy viewers behind one office NAT. Expected false positives in
dev are close to zero. In production, mobile carrier CGNAT can put many users
behind one IP: review WAF sampled requests and the blocked-requests alarm, and
run in Count mode first before tightening. Change the limit or action in
`src/config.ts`, review the diff, and deploy the Edge stack.

## 10. How to review the IaC

Everything below runs offline, with no AWS credentials:

```bash
npm run media:infra:install   # npm ci in infra/
npm run media:infra:check     # typecheck + all infra and media-pipeline unit tests
npm run media:infra:plan      # tests + cdk synth (cdk-nag + CloudFormation schema validation) + summary
```

- Templates: `infra/cdk.out/*.template.json`.
- Accepted cdk-nag findings and their reasons: `src/nag-suppressions.ts`. Any new
  finding fails synthesis.
- The edge function's behaviour is tested in `test/edge-function.test.ts`.

`npm run media:infra:diff` compares against a real account and **needs read
credentials** for that account; it does not change anything. The app refuses
to synthesize against credentials unless the account is named and matches:

```bash
npm run media:infra:diff -- -c aarvasa:accountId=<dev-account-id>
```

CDK CLI telemetry, notices and version reporting are disabled in `cdk.json`.

## 11. Deployment (DEV only)

There is **no deploy script**. Edge, Storage and Monitoring were deployed to DEV
this way; Processing (section 14) follows the same steps once its prerequisites
exist. A person with credentials for the **development** account runs, stack by
stack, reviewing each change set (`requireApproval: any-change`):

```bash
cd infra && npm run build
npx cdk deploy AarvasaMediaDev-Edge -c aarvasa:accountId=<dev-account-id>
npx cdk deploy AarvasaMediaDev-Storage -c aarvasa:accountId=<dev-account-id> -c aarvasa:webAclArn=<Edge output WebAclArn>
npx cdk deploy AarvasaMediaDev-Monitoring -c aarvasa:accountId=<dev-account-id> -c aarvasa:distributionId=<Storage output DistributionId>
```

- No `cdk bootstrap` is needed: stacks use `LegacyStackSynthesizer`, contain no
  assets and deploy with the operator's own credentials (enforced by tests).
- Post-deploy verification (manual):
  - `curl -I` on a test object for `Content-Type`, `Cache-Control`,
    `Access-Control-Allow-Origin` (with and without `Origin`), `nosniff`, `Vary`,
    and a `Range: bytes=0-99` request returning 206.
  - `/originals/…` returns 404.
  - A direct S3 URL returns 403.
  - A second `PutObject` to the same key without `If-None-Match` returns 403,
    and with it returns 412.
  - Confirm `Vary` is accepted as a custom response header.
- Subscribe the SNS topics and activate cost allocation tags.
- If CloudFront flat-rate Pro is chosen later: custom response headers policies
  require the Business tier. On Pro, switch to the managed CORS and security
  headers policies and accept `Access-Control-Allow-Origin: *`.

### Application environment variables

All server-only: never `NEXT_PUBLIC_`, never in client bundles (checked by a build
scan). `amplify.yml` forwards `MEDIA_*` into the Next.js server build **only when
set** in the Amplify console; unset, the media routes return 503.

| Variable | Consumed by | Value | Purpose |
|---|---|---|---|
| `MEDIA_REGION` | Next.js server, worker, sweeper | `ap-south-1` | Region of buckets and queue |
| `MEDIA_INGEST_BUCKET` | Next.js server, worker, sweeper | Storage output `IngestBucketName` | Presigned uploads, HeadObject verification, source reads |
| `MEDIA_PUBLISHED_BUCKET` | Next.js server (admin review), worker | Storage output `PublishedBucketName` | Review copies, previews, publication |
| `MEDIA_PROCESSING_QUEUE_URL` | Next.js server (completion), worker, sweeper | Processing output `ProcessingQueueUrl` | Job dispatch; without it completion still succeeds and the sweeper re-sends |
| `MEDIA_DATABASE_SECRET_ARN` | Worker, sweeper (set by CDK) | A Secrets Manager secret holding a **DEV** `DATABASE_URL` | The database URL is read at cold start; never in env or templates |
| `MEDIA_CDN_ORIGIN` | (compile-time constant in `src/lib/viewer/media-origin.ts`) | DEV CDN origin in dev builds, `null` in production | Viewer origin allow-list |

CDK deploy-time context (not application env): `aarvasa:accountId`,
`aarvasa:webAclArn`, `aarvasa:distributionId`, `aarvasa:databaseSecretArn`,
`aarvasa:processingArtifactKey`, `aarvasa:processingArtifactVersion`.

No AWS access keys anywhere: the app uses the Amplify SSR compute role (attach
`app-upload-intents`, `app-media-review` and `processing-producer`), the Lambdas
their own roles.

### Repository integration

`infra/` is a separate npm package (own `package.json`, lockfile, `tsconfig.json`)
and is not installed by Amplify's root `npm install`. Four root files were
touched to keep it isolated:

| File | Change | Why |
|---|---|---|
| `package.json` | `media:infra:install/check/plan/diff` and `media:process` scripts | Entry points; there is no deploy or upload script |
| `tsconfig.json` | `exclude: ["node_modules", "infra"]` | The root `**/*.ts` include made `next build` type-check infra and fail |
| `eslint.config.mjs` | Ignore `infra/dist/**`, `infra/cdk.out/**` | Generated CommonJS output; infra source is still linted |
| `src/app/globals.css` | `@source not "../../infra";` | Tailwind scanned infra files and added a `.lowercase` utility to the site CSS; with this line the CSS is byte-identical to a build without `infra/` |

## 12. What is intentionally NOT deployed or implemented

- Production: no buckets, distribution, WAF, queues, functions, DNS records,
  certificates or IAM exist. Production builds have no media origin.
- DEV: the Phase 5 Storage changes and the whole Processing stack are not deployed
  (no DEV database exists; section 14). No IAM policy is attached to the Amplify
  compute role, and the ingest CORS rule still allows `http://localhost:3000` only.
- No multipart uploads (single PUT up to 100 MB). The pipeline does not optimise
  GLBs, convert PLY to SOG, or render model/splat posters.
- No viewer integration of MediaAsset rows (Phase 6+); `/api/upload` and the Phase 1
  viewer are unchanged.
- S3 server access logs and CloudFront standard logs are off in dev (acknowledged
  in `src/nag-suppressions.ts`; enable for production).

## 13. Local media pipeline (Phase 2B-2)

An offline validator and manifest generator that prepares immersive media for
the layout above. It **never uploads, never calls AWS and never modifies source
files**. Code: `src/pipeline/`; shared rules: `../shared/media-contract.ts` (keys,
MIME, Cache-Control) and `src/media-budgets.ts` (Phase 2A budgets).

### Usage

Run from the repository root (relative paths resolve from where you run npm):

```bash
npm run media:process -- ./path/to/listing --dry-run                 # validate + report, writes nothing
npm run media:process -- ./path/to/listing --dry-run --set-id reef-996 --strict
npm run -s media:process -- ./path/to/listing --dry-run --json > manifest.json
npm run media:process -- ./path/to/listing --out ./media-staging     # also stage objects/<key> + manifest.json locally
```

| Option | Meaning |
|---|---|
| `--dry-run` / `--out <dir>` | Exactly one is required. `--out` needs an empty (or previously staged) directory and is write-once: an existing key with different bytes is refused |
| `--set-id <id>` | Listing identifier (default: directory name). Seeds derived media ids and scopes the per-listing budgets |
| `--media-id <id>` | Explicit media id for a single file (e.g. a future `MediaAsset.id`) |
| `--no-posters` / `AARVASA_MEDIA_POSTERS=off` | Skip generated panorama posters |
| `--json` | Manifest on stdout, report on stderr (use `npm run -s`) |
| `--strict` | Warnings fail the run |

Output is `PASS`/`WARN`/`FAIL` per asset and per check. Exit codes:

| Code | Meaning |
|---|---|
| `0` | Pass; warnings allowed unless `--strict` |
| `1` | Any hard validation failure |
| `2` | Usage or input error |

### Input layout

A listing is a flat directory. Every media file becomes one media item.

```
listing/
  tower.glb
  tower.poster.webp     optional sidecar poster for tower.glb (.webp/.jpg)
  terrace.jpg           panorama; poster generated if sharp is available
  garden.sog
```

Hidden files are ignored. Subdirectories are reported and skipped. Symbolic
links are refused.

### Supported formats

| Input | Kind / format | Published entry file | Content-Type |
|---|---|---|---|
| `.glb` | MODEL / GLB | `scene.glb` | `model/gltf-binary` |
| `.jpg`, `.jpeg` | PANORAMA / EQUIRECT_JPEG | `panorama.jpg` | `image/jpeg` |
| `.webp` | PANORAMA / EQUIRECT_WEBP | `panorama.webp` | `image/webp` |
| `.sog` (bundled SOG ZIP) | SPLAT / SOG | `scene.sog` | `application/zip` |
| `.ktx2` | TEXTURE / KTX2 (standalone) | `texture.ktx2` | `image/ktx2` |
| `*.poster.webp`, `*.poster.jpg` | poster sidecar | `poster.webp` / `poster.jpg` | `image/webp` / `image/jpeg` |

These are rejected with a specific reason:

- `.gltf` and `.bin`: use a single `.glb`.
- `.ply`, `.splat`, `.ksplat`, `.spz`: convert to SOG first.
- `.basis`: use KTX2.
- `.png`, `.avif`: not accepted as panoramas.
- `.hdr`, `.exr`: deferred.
- Generic `.zip` and standalone `.json`.

Every other extension is also rejected.

### Validation rules

All inputs:
- Regular files only.
- Magic bytes must match the extension (MIME is detected from content, never trusted from the name).
- Size is measured before reading; anything above the source maximum is refused unread.
- SHA-256 of every entry and poster.

**GLB**, checked against what the PlayCanvas 2.22.2 engine in this repo actually parses (a test re-reads the installed engine source):
- Container:
  - GLB version 2.
  - Header length matches the file.
  - Well-formed 4-byte-aligned chunks: JSON first, at most one BIN.
  - UTF-8 JSON with `asset.version` 2.x.
- **All resources embedded:**
  - Any `buffers[].uri` or `images[].uri` fails: external URLs, relative paths and traversal as `gltf.external-uri`, base64 `data:` URIs as `gltf.data-uri`.
  - Buffer views must stay inside the BIN chunk.
  - Images need `bufferView` + `mimeType`, and their bytes must match the declared type (PNG, JPEG, WebP, KTX2).
- **Meshopt** (`EXT_meshopt_compression`, `KHR_meshopt_compression`, as a declared or bufferView extension) fails. The engine does not implement it.
- **Draco** (`KHR_draco_mesh_compression`) passes when declared. Primitive references are checked, but geometry is not decoded.
- **KTX2/Basis** (`KHR_texture_basisu`) is recognised from the KTX2 header and data-format descriptor (ETC1S vs UASTC). Non-Basis GPU formats warn.
- WebP textures require `EXT_texture_webp`.
- Extensions:
  - A required extension the engine lacks fails.
  - An optional unknown extension warns.
  - `KHR_gaussian_splatting` in a GLB warns (publish splats as SOG).
- Budgets: triangles (mobile 150k, desktop 500k) and largest texture dimension (mobile 2048, desktop 4096) warn.

**Panorama** (header only, no pixel decode):
- Exactly 2:1.
- Width above 8192 fails (tiling not supported); above 4096 warns (desktop only); below 2048 warns.
- CMYK JPEG and animated WebP fail.
- **GPS in EXIF fails.** Sources are published unchanged, so location data would leak. Other EXIF, progressive JPEG and lossless WebP warn.

**SOG bundle:**
- A safe ZIP subset:
  - No ZIP64, multi-disk or encrypted entries.
  - Stored or deflate only.
  - CRC-32 and declared sizes verified.
  - At most 64 flat entries; nested paths, `..` and duplicate names fail.
  - Total declared uncompressed size capped at 320 MB, as zip-bomb protection.
- `meta.json` (v2, or v1 which the engine upgrades) must have a gaussian count and the `means`, `scales`, `quats` and `sh0` sections.
- Every referenced file must be present and a **still, lossless WebP**. Unreferenced files fail.
- Gaussians above 1M (mobile) or 3M (desktop) warn. Above the desktop target, the item is flagged `streamingCandidate` for future streamed SOG.

**KTX2 texture:** header and data-format descriptor are validated. Phase 2A set no size budget, so the pipeline warns rather than inventing one.

**Posters:**
- A sidecar is always preferred. It must be a still WebP/JPEG matching its extension, with no GPS.
- Panoramas without a sidecar get a generated 1280×640 WebP (`sharp` `fit: cover`, quality 80, metadata dropped).
- Models and splats without a sidecar warn (headless rendering is a future adapter).

### Budgets (Phase 2A starting values; MB = 1,000,000 bytes)

| Kind | WARN above (mobile) | WARN above (desktop) | FAIL above | Source max (refused unread) |
|---|---|---|---|---|
| GLB | 10 MB | 25 MB | 50 MB | 250 MB |
| Panorama | 2.5 MB | 8 MB | 12 MB | 50 MB |
| SOG (single file) | 20 MB / 1M gaussians | 50 MB / 3M gaussians | 80 MB | 80 MB (PLY sources out of scope) |
| Poster | 200 kB | 200 kB | 500 kB | 10 MB |

Per listing, both are warnings rather than failures, because they need a human decision:
- **Initial view** (all posters + the largest entry) above 25 MB warns.
- **Published total** above 400 MB sets `reviewRequired: true` and warns.

### Output layout

Keys follow the Phase 2B-1 contract and are validated against it before they are emitted:

```
m/{mediaId}/{keyHash}/scene.glb | panorama.jpg | panorama.webp | scene.sog | texture.ktx2
m/{mediaId}/{keyHash}/poster.webp | poster.jpg
```

- `mediaId`: `--media-id`, or the first 24 hex characters of SHA-256 of `setId` + file name. It stays stable when a file is replaced, so versions share an id.
- `keyHash`: the first 16 hex characters of SHA-256 over the pipeline profile, the entry's SHA-256 and the exact poster input (sidecar hash, or generator id).
  - Identical inputs always give the same path.
  - Any change to what would be published gives a new path.
  - The full SHA-256 is kept in the manifest as `contentHash`.
- `--out <dir>` writes `objects/<key>` (hash-verified after copy) and `manifest.json`. The manifest contains object keys and metadata only: no CDN URLs, bucket names or local paths.

Manifest (per item): `mediaId`, `kind`, `format`, `status`, `storageKey`,
`entryFile`, `contentHash`, `mimeType`, `sizeBytes`, `dimensions`, `metrics`,
`poster`, `objects[]` (key, contentType, cacheControl, size, sha256, which are
exactly the headers a publisher must set), `source` (filename, size, sha256),
`validation[]`, `warnings[]`, `errors[]`, `processingVersion`. The set level adds
the pipeline name/version/profile, viewer engine, poster generator, totals and
`reviewRequired`.

### Processing and transformations

Profile `passthrough-v1`:
- Entry files are published **byte-for-byte**; nothing is recompressed.
- The only derived file is the generated panorama poster.
- It is deterministic for a given `sharp`/libvips version, and that version is part of the generator id and therefore of the key hash. This is tested.

### Known limitations

- **No decoding or optimisation.**
  - Draco geometry and Basis textures are recognised structurally, not decoded, so corrupt compressed payloads are only caught in the viewer.
  - Full Khronos glTF-Validator conformance is not run (not installed; no downloads).
  - Triangle counts for Draco primitives come from accessor metadata.
- **Not implemented offline:** GLB optimisation (gltf-transform Draco/KTX2 encoding), PLY→SOG / streamed SOG conversion (PlayCanvas splat-transform), headless model/splat poster rendering. Interfaces exist in `src/pipeline/adapters.ts` (`ModelOptimizer`, `SplatConverter`, `PosterRenderer`) with no implementation.
- **Posters:**
  - Generation depends on `sharp`, an optional dependency of Next.js that is present in this repo. If it is missing, panoramas warn `poster.missing`.
  - Generated posters are 2:1 crops of the equirectangular image, not a perspective view.
- **Panoramas:** EXIF is detected but not stripped (sources are never modified). GPS fails; other metadata warns.
- **Streamed SOG** (`lod-meta.json` + chunks) and multi-file SOG directories are not accepted yet.
- **Standalone KTX2** has no approved budget.
- **Budgets** are Phase 2A starting points, not measured device limits.
- **Scanning:** no malware or antivirus scanning.

### How this connects to uploads, S3 and SQS

1. **Upload intent** (Phase 5A, implemented): the SSR role presigns `uploads/{mediaId}/{uploadId}/source.{ext}` in the ingest bucket, bound to the size, type and SHA-256, which the `MediaAsset` row stores (`sourceChecksumSha256`, canonical base64).
2. **Upload completion** (Phase 5B, implemented): `POST /api/media/{mediaId}/complete` verifies the ingest object with `HeadObject` against the row and moves it `UPLOADED` → `PROCESSING` with one conditional update. The committed `PROCESSING` row is the handoff. There are no S3 event notifications, queues or workers, and S3 events are not planned as the processing trigger.
3. **Processing** (Phase 5, section 14; not deployed): after the completion commits, a job goes to the processing queue; the worker claims the row, re-verifies the source, runs this same `processAssets` code, writes the outputs write-once to the private `review/` prefix, and moves the row to `PENDING_REVIEW`. An admin approval publishes them to `m/`.
4. **Database** (`MediaAsset` row): processing fills `storageKey`, `entryFile`, `contentHash` (the processed entry file's hex SHA-256, unrelated to `sourceChecksumSha256`), poster fields, metrics and validation status from the manifest, plus moderation state.
5. **Delivery:** Server Components build URLs as `MEDIA_CDN_ORIGIN + "/" + key`. The origin is server configuration and never part of the manifest.

## 14. Upload, processing and review (Phase 5)

Code: `shared/media-processing.ts` (job contract, state machine, policy),
`src/lib/services/media-*.ts` (intent, completion, review services and Prisma
stores), `src/lib/media/*.ts` (S3 signer/inspector, SQS producer, published-bucket
access, admin upload flow), `infra/src/processing/` (worker, sweeper, SQS handler,
S3 adapters), `infra/src/runtime/` (Lambda entry points),
`infra/src/stacks/media-processing-stack.ts`, admin UI
`src/components/admin/media-manager.tsx` (Admin panel → Media). Tests:
`infra/test/media-upload-*.test.ts`, `infra/test/processing/`.

**Status:** implemented and validated offline and on disposable PostgreSQL.
**Not deployed** (section 11 header): the Processing stack needs a DEV database.

```
Admin UI ── POST /api/media/upload-intent ──► presigned PUT ──► S3 ingest uploads/{id}/{uploadId}/source.ext
   │                                          (browser → S3 directly; exact size, type, SHA-256 signed)
   └── POST /api/media/{id}/complete ── HeadObject verify ── UPLOADED → PROCESSING (commit) ── send job ─┐
                                                                                                         ▼
   sweeper (EventBridge, 15 min) ── re-send unclaimed ──────────────────► SQS processing ──5 receives──► DLQ
                                                                                │ batch 1, partial failures
                                                                                ▼
   worker Lambda: claim lease → re-read + re-hash source → processAssets (Phase 2B-2, unchanged)
                  → write-once copies to published review/{id}/{hash}/… (private) → PENDING_REVIEW
                                                                                │
   Admin UI ── preview (5-minute presigned GET of review/ copies) ──────────────┤
            ── approve: PENDING_REVIEW → PUBLISHED (commit), then stream review/ → m/{id}/{hash}/… write-once
            ── reject:  PENDING_REVIEW → REJECTED (review/ copies expire after 30 days)
                                                                                ▼
                                                     CloudFront serves m/ only (never review/, originals/, uploads/)
```

### Processing job (schema version 1)

```json
{ "schemaVersion": 1, "jobId": "<uuid v4, per dispatch>", "mediaAssetId": "<id>",
  "sourceKey": "uploads/<id>/<uploadId>/source.<ext>", "processingVersion": "1.0.0/passthrough-v1",
  "idempotencyKey": "<id>:1.0.0/passthrough-v1", "dispatchedAt": "<ISO-8601>" }
```

Identifiers only, parsed strictly; anything else (unknown fields, other versions,
another asset's key, a forged idempotency key, over 1 KiB) is rejected and ends in
the DLQ. The worker reads owner, subject, status, type, size and checksum from the
database. Only server code sends jobs: the completion route after its update
commits (`src/lib/media/processing-queue.ts`, `SendMessage` with the job as the
body) and the sweeper. A failed send leaves the row PROCESSING for the sweeper.

### State machine

| From | To | Who |
|---|---|---|
| UPLOADED | PROCESSING | upload completion (verified) |
| UPLOADED | FAILED | upload intent (signing failed), completion (mismatch/expired), sweeper |
| PROCESSING | PENDING_REVIEW | worker |
| PROCESSING | FAILED | worker (permanent failure, retries exhausted), sweeper (timeout, retries exhausted, inconsistent) |
| PENDING_REVIEW | PUBLISHED | admin approval (`POST /api/admin/media/{id}/approve`) |
| PENDING_REVIEW | REJECTED | admin rejection (`POST /api/admin/media/{id}/reject`) |
| PENDING_REVIEW, PUBLISHED, REJECTED, FAILED | ARCHIVED | archival (later phase, not implemented) |

No VERIFIED state. The worker cannot publish; only the REVIEW actor (an ADMIN,
role re-read from the database) can. Every change is one conditional update
through `assertTransition`; CHECK constraints enforce the fields each state needs
(PUBLISHED: reviewedAt, publishedAt, alt text; REJECTED: reason; FAILED: failure
code and diagnostic; PROCESSING: start time).

### Review and publication

- **Preview:** `POST /api/admin/media/{id}/preview` returns presigned GETs (300 s,
  `Cache-Control: private, no-store`) for the entry file and poster **under
  `review/` only**, never the ingest source.
- **Approve:** requires alt text (on the asset or in the body). Review copies are
  checked (HEAD) first; then PENDING_REVIEW → PUBLISHED commits; then each file is
  streamed review/ → m/ with If-None-Match and the SHA-256 (the entry's must equal
  `contentHash`). Committing first means a racing rejection can never leave
  CDN-reachable files. If publication fails after the commit, the API answers 502
  and approving again completes it; approving a PUBLISHED asset is always an
  idempotent re-check.
- **Reject:** records the reason and reviewer; nothing is published; the review
  copies expire with the bucket lifecycle rule (30 days).
- Pending assets must be reviewed within 30 days; after that approval answers
  `REVIEW_COPY_MISSING` and the asset must be re-uploaded.

### Retry policy

| Class | Examples | Result |
|---|---|---|
| Retryable | S3 5xx, throttling, 403, network, credentials; 409 conditional-write conflict; database errors; unexpected worker exceptions; ingest encryption drift | lease released, message kept, SQS redelivers after 30 min |
| Permanent | unsupported format, MIME mismatch, external glTF URI, data URI, meshopt, unsupported required extension, other validation failures, hard size limit, source missing, size/SHA-256 mismatch, invalid source key, immutable-object conflict | FAILED at once, message deleted |

Attempts are counted in the database (max 3; a transient failure on the last one
fails the asset with `RETRIES_EXHAUSTED`). Only invalid jobs reach the DLQ (after 5
receives). Users only see `PUBLIC_FAILURE_MESSAGES[failureCode]`; `processingError`
(rule ids and validator messages, bounded, may quote file content) is shown to
admins only and never logged.

### Idempotency

- **Lease:** `claim` is one conditional update (PROCESSING, same source, lease free,
  attempts < 3) that increments `processingAttempts` and sets a 10-minute lease; the
  attempt number is the token every later update requires.
- **Timing:** worker ≤ 5 min < lease 10 min < SQS visibility 30 min (6 × the Lambda
  timeout, as AWS recommends for SQS event sources).
- **Outputs:** content-addressed keys, written with If-None-Match and the SHA-256;
  an existing key is accepted only when byte-identical. Duplicate or concurrent
  deliveries, crashes before/after writing, a racing sweeper and concurrent
  approve/reject all converge on exactly one outcome (tested offline and on
  PostgreSQL).

### Sweeper (Lambda, every 15 minutes)

| | Candidate | Action |
|---|---|---|
| A | UPLOADED past the completion deadline (10 min URL + 1 h grace), object missing | FAILED `UPLOAD_EXPIRED` |
| A | UPLOADED, never completed, older than 24 h | FAILED `UPLOAD_EXPIRED` |
| B | PROCESSING for more than 6 h, lease free | FAILED `PROCESSING_TIMEOUT` |
| C | PROCESSING, lease free, 3 attempts used | FAILED `RETRIES_EXHAUSTED` |
| C | PROCESSING, lease free, inconsistent row | FAILED `INVALID_SOURCE` |
| D | PROCESSING, lease free, attempts left, started over 30 min ago | job re-sent (no write) |

Conditional updates only; it never touches PENDING_REVIEW or later states and
never deletes objects. The EventBridge rule has no retries (the next run is 15
minutes later); a failed run raises the sweeper-errors alarm.

### Source retention

- Ingest objects expire 7 days after upload; incomplete multipart uploads after 1
  day. Nothing deletes a source earlier. Every processing deadline is far inside
  that window (70 min, 24 h, 6 h; queue retention 4 days).
- Review copies expire 30 days after processing. Published `m/` objects are
  write-once and kept (versioned bucket).
- passthrough-v1 publishes the verified source byte-for-byte, so no separate
  original is kept; a transforming profile must copy originals first.

### Monitoring (DEV thresholds, SNS topic `aarvasa-media-dev-processing-alerts`, no subscribers yet)

| Alarm | Condition |
|---|---|
| `processing-queue-oldest-message` | a job older than 1 hour |
| `processing-queue-depth` | 100+ jobs waiting |
| `processing-dead-letters` | any message in the DLQ |
| `processing-worker-errors` | a worker error or timeout in 15 minutes |
| `processing-worker-duration` | a run over 90% of the 5-minute timeout |
| `processing-failures` | 5+ FAILED results in an hour (metric filter on the worker's JSON logs) |
| `processing-sweeper-errors` | a failed sweep in an hour |

Logs (30 days) are one JSON object per line: `media.processing.job` (media id, job
id, attempt, receive count, processing version, duration, result, status, error
category, failing rule ids) and `media.processing.sweep` (counts). Never URLs,
credentials, object bytes, validator messages or S3 error bodies.

### Admin workflow (Admin panel → Media)

1. Choose a property or project, a media type and a file (GLB up to 100 MB,
   panorama up to 50 MB, SOG up to 80 MB). Add alt text.
2. The browser hashes the file, requests an upload intent, uploads directly to S3
   with progress, and calls complete. The asset shows PROCESSING, then
   PENDING_REVIEW (or FAILED with a generic reason; admins can open the internal
   diagnostic).
3. In "Awaiting review", open the asset: metadata, validation warnings, secure
   preview (poster and a private link to the processed file).
4. Approve and publish (alt text required), or reject with a reason.

Uploads work only from origins in the ingest bucket's CORS rule (DEV:
`http://localhost:3000`).

### Deploying the Processing stack (DEV, when approved)

Prerequisites, none of which exist yet:

1. **A DEV database** reachable from Lambda, with the migrations applied
   (`prisma migrate deploy` against that database only). Never production.
2. **A Secrets Manager secret** holding that DEV `DATABASE_URL`.
3. **The Lambda bundle** uploaded to the artifact bucket as
   `processing/processing-lambdas.zip`: `infra/src/runtime/handlers.ts` bundled
   for Node.js 24 on arm64 (exports `workerHandler` and `sweeperHandler` from
   `index.js`), with the Prisma client and a `linux-arm64-openssl-3.0.x` query
   engine, and `sharp` for linux-arm64 (panorama posters). Packaging is not
   automated in this repository yet; it needs a bundler (for example esbuild) and
   a Prisma `binaryTargets` entry for Lambda, both deliberately not added to the
   app's production build.
4. Deploy Storage first (review prefix, narrowed processor policy), then:

```bash
npx cdk deploy AarvasaMediaDev-Processing -c aarvasa:accountId=<dev-account-id> \
  -c aarvasa:databaseSecretArn=<secret ARN> -c aarvasa:processingArtifactKey=processing/processing-lambdas.zip \
  -c aarvasa:processingArtifactVersion=<S3 version id of the uploaded zip>
```

5. Attach `app-upload-intents`, `app-media-review` and `processing-producer` to the
   DEV app role, set the `MEDIA_*` variables for the DEV app, subscribe the alert
   topic, and run the end-to-end check with a harmless pilot asset.

### Known limitations

- Not deployed; no DEV database; Lambda packaging not automated.
- The admin preview shows the poster and a private link to the processed file; the
  3D viewer only loads same-origin or CDN URLs, so it does not render review copies.
- The original client filename is not stored (it is never trusted); the asset's
  title identifies it.
- Validation warnings are stored as rule ids (`metrics["validation.warnings"]`).
- A PUBLISHED asset whose publication failed after the decision stays PUBLISHED
  with files missing until an admin approves again (the API says so).
- Published derivatives of an asset archived later are kept (no cleanup yet).
