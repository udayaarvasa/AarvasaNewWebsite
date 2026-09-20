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

## 15. Public viewer, 360° tours and hotspots (Phase 6)

Phase 6 puts approved media on project pages: the existing 3D model viewer, plus
360° panoramic tours with hotspots and room-to-room navigation. It adds no AWS
resources, no database model and no migration, and does not change upload,
processing or review. Gaussian splats were not part of Phase 6 (they are Phase 7,
§16); AR, VR and WebXR were not either (Phase 8, §17).

### Architecture

```
MediaAsset (PUBLISHED, PANORAMA, this project)     project data (src/lib/projects.ts)
        │  publishedPanoramaQuery: allow-listed columns       │  Project.tour: rooms, hotspots,
        ▼                                                     ▼  image = published id | dev fixture
toPublishedPanoramas ──────────────► projectTourConfig (server) ──► sanitizeTour ──► PanoramaTour (props)
                                                                                         │
project page (static) ─► ImmersiveSection ─► ImmersiveExperience (tabs, client, lazy) ◄──┘
                                              ├─ 3D model: Aarvasa3DViewer (source kind "model")
                                              └─ 360° tour: PanoramaTourViewer
                                                   └─ Aarvasa3DViewer (source kind "panorama")
                                                        + overlay: hotspots, rooms, toggle, exit
                                                        └─ PlayCanvas engine (dynamic import)
                                                             └─ loadPanorama: sphere + sRGB texture
```

| File | Role |
|---|---|
| `src/lib/viewer/types.ts` | `ViewerSource` (`model` \| `panorama`), `PanoramaView`, engine API (`zoomBy`, `projectDirection`, `onViewChange`) |
| `src/lib/viewer/source.ts` | URL policy (`resolvePanoramaUrl`, `resolveModelUrl`), view normalisation, source keys |
| `src/lib/viewer/tour.ts` | Tour/hotspot schema, `sanitizeTour`, `navigate`, `tourFloors` |
| `src/lib/viewer/published-panoramas.ts` | PUBLISHED-only query and row mapper (public fields only) |
| `src/lib/viewer/project-tour.ts` | Server-side gating: project tour → public `PanoramaTour` |
| `src/lib/services/project-panoramas.ts` | The one database read (`loadProjectTour`) |
| `src/lib/viewer/panorama-math.ts`, `load-gate.ts` | Pure geometry; "latest load wins" |
| `src/lib/viewer/playcanvas/panorama.ts`, `look-controls.ts` | Panorama content and first-person controls |
| `src/components/viewer/panorama-tour.tsx` | Tour UI over the viewer |
| `src/app/projects/[slug]/immersive-*.tsx` | Page section and model/tour tabs |
| `src/lib/viewer/analytics.ts` | First-party viewer events |
| `src/app/labs/panoramas/[file]/route.ts` | Development-only generated test panoramas (404 in production) |

### Panorama source contract

A panorama is one **equirectangular** image, JPEG or WebP, 2:1 (±2 %), in sRGB.
Yaw 0 is the image centre; positive yaw turns right; positive pitch looks up.

```ts
{ kind: "panorama", url: string, initialView: { yawDeg: number, pitchDeg: number, fovDeg: number } }
```

`url` must be a same-origin path or `https://{this build's media CDN}/m/{mediaId}/{hash}/{file}.jpg|.jpeg|.webp`
with no credentials, query or fragment. Everything else is refused before any
request: other hosts, `http:`, `review/`, `uploads/`, `originals/`, presigned
URLs, traversal (plain or percent-encoded), protocol-relative and backslash
tricks, `data:`/`javascript:` URLs, and non-image extensions. The viewer copies
the contract's published-key regex (`VIEWER_MEDIA_KEY_PATTERN`, kept equal to
`MEDIA_KEY_PATTERN` by a test) so browser bundles contain no private prefixes.
Views are normalised: yaw to (−180, 180], pitch to ±85°, field of view 30–100°.

### Hotspot schema

```ts
type TourHotspot = {
  id: string;                     // /^[a-z0-9][a-z0-9-]{0,39}$/, unique within its scene
  label: string;                  // 1–80 chars; the button's accessible name
  yawDeg: number;                 // any finite value, normalised to (−180, 180]
  pitchDeg: number;               // −90…90
  type: "navigation" | "info";    // default "navigation"
  targetSceneId?: string;         // navigation: another scene of the same tour (required)
  description?: string;           // info: required, ≤ 280 chars
};
```

Hotspots carry no project-specific logic. Invalid hotspots are dropped (and
reported to the server log in development), as are navigation hotspots whose
target scene is missing or was dropped. Limits: 40 scenes, 24 hotspots per scene.

### Navigation model

One engine serves the whole tour. Changing rooms changes the viewer's `source`,
so the canvas and GPU context are kept and nothing remounts. While the next room
loads, the current one stays on screen with a small "Loading…" indicator and
hotspots hidden; the room controls stay usable. Each load takes a `LoadGate`
ticket: starting another aborts the previous download (`AbortController`) and
marks it stale, so rapid switching always ends on the last room requested and
a late response is destroyed instead of shown. A missing target shows "That
room isn't available" and records a `viewer_error` (`missing-target`). The
opening room and each room's initial view come from the data; `Reset view`
returns to it. There is no URL routing per room.

### Project-page integration

`/projects/[slug]` renders the section when the project has a model, a tour, or
both. With both, a tab list (arrow-key navigable) switches between **3D model**
and **360° tour**; only the selected viewer is mounted, and each waits for the
visitor to press its button, so neither downloads automatically and never both.
Switching tabs or pressing **Close tour** destroys the engine and releases the
GPU context. Without WebGL 2 the viewer explains why and never downloads the
engine; a failed room shows an error with **Try again** while the room list
stays available. Projects without media render no section.

### Public versus review media

The browser never decides what is approved. The server looks up only the asset
ids a project's tour names, and only rows with `status = PUBLISHED`,
`kind = PANORAMA`, `subjectType = PROJECT` and this `projectSlug`, selecting
`id, status, kind, subjectType, projectSlug, storageKey, entryFile, altText,
viewDefaults` — never `sourceKey`, checksums, review keys, diagnostics or reviewer
ids. The row mapper re-checks all of that and the storage contract, then the URL
is built from the published key and `MEDIA_CDN_ORIGIN`. UPLOADED, PROCESSING,
PENDING_REVIEW, REJECTED, FAILED and ARCHIVED assets are not loadable; review
copies stay behind presigned admin links. Tours marked `"placeholder"` and
development fixtures never reach production builds, and production has no media
origin yet, so production shows no CDN media at all. Project pages are
statically generated: a newly published or withdrawn panorama appears on the
next build. Projects that use only fixtures (the pilot) never touch the database.

### Performance

- Nothing loads until the visitor opens a viewer; the tour component itself is a
  separate lazy chunk, and PlayCanvas loads only on "Open".
- Only the current room's panorama is fetched (`credentials: "omit"`) and
  resident; the previous texture, material and mesh are destroyed when the next
  room is shown. Rooms are not preloaded.
- Images wider than the device cap are downscaled while decoding
  (`createImageBitmap`): 8192 px on desktop, 4096 px on touch devices, never
  above the GPU's `maxTextureSize`. No mipmaps (a 360° view is never minified much).
- Device pixel ratio is capped at 2; rendering is on demand and stops when the
  view is still, off-screen or in a hidden tab. Hotspot positions are written to
  the DOM from the per-frame callback, so looking around never re-renders React.

### Accessibility

The canvas is focusable with an explanatory label (arrow keys turn, `+`/`-` zoom);
zoom, reset, fullscreen, room list, hotspot toggle and close are buttons with
labels (40–44 px touch targets). Every hotspot is a real button, and the rooms
panel lists all rooms (grouped by floor when the data has floors) and every
hotspot of the current room, so nothing requires dragging or finding a hotspot
on screen. Room changes are announced (`aria-live`) with the room's alt text and
focus moves to the room name. Reduced motion removes damping and animations;
panoramas never auto-rotate.

### Analytics

`trackViewerEvent` dispatches a `CustomEvent("aarvasa:viewer")` on `window`; no
vendor SDK and nothing is sent anywhere yet. Events: `viewer_opened`,
`viewer_mode_selected`, `panorama_opened`, `hotspot_clicked`,
`panorama_navigation`, `viewer_error`. Properties are rebuilt from an allow-list
(project slug, scene/hotspot ids, fixed enums, `placeholder`); URLs, keys, error
messages and free text are dropped. In development React Strict Mode fires
mount effects twice, so `panorama_opened` can appear twice there.

### How to add a tour to a project

1. Upload each room through Admin → Media for the project as a **360° panorama** (equirectangular
   JPEG/WebP, 2:1), with alt text; let it process, then **approve** it.
2. Add a `ProjectPanoramaTour` for the slug in `TOUR_BY_SLUG`
   (`src/lib/projects.ts`), referencing each asset by id, with `review: "approved"`.
3. Place hotspots: open the tour in development and read headings off the
   image (or the fixture grid), or compute yaw = (x / width − 0.5) × 360 and
   pitch = (0.5 − y / height) × 180 from pixel coordinates.
4. Run `npm test` in `infra/` and rebuild; the page picks up PUBLISHED rooms.
5. Production additionally needs a production media origin (see §11/§12).

Example:

```ts
const EXAMPLE_TOUR: ProjectPanoramaTour = {
  label: "Show apartment 360° tour",
  review: "approved",
  startSceneId: "living",
  scenes: [
    {
      id: "living",
      title: "Living room",
      floor: "Ground floor",
      image: { source: "published", mediaAssetId: "cm1abcd2ef3gh4" },
      initialView: { yawDeg: 0, pitchDeg: 0, fovDeg: 75 }, // optional; else the asset's viewDefaults
      hotspots: [
        { id: "to-kitchen", label: "Go to kitchen", yawDeg: 95, pitchDeg: -8, type: "navigation", targetSceneId: "kitchen" },
        { id: "balcony", label: "Balcony", yawDeg: -160, pitchDeg: 0, type: "info", description: "Opens onto the east-facing balcony." },
      ],
    },
    {
      id: "kitchen",
      title: "Kitchen",
      floor: "Ground floor",
      image: { source: "published", mediaAssetId: "cm5ijkl6mn7op8" },
      hotspots: [{ id: "to-living", label: "Back to living room", yawDeg: -85, pitchDeg: -8, targetSceneId: "living" }],
    },
  ],
};
```

The REEF 996 pilot (`REEF_996_PILOT_TOUR`) uses three generated test grids
(`test-room-a/b/c`) with compass headings, labelled "placeholder" in the image,
the alt text and the page note. They depict no real property; no image file is
committed and no customer asset was uploaded.

### Assumptions

- Panoramas are monoscopic, full 360 × 180 equirectangular images; partial
  panoramas and cube maps are not supported.
- A tour's rooms belong to one project; cross-project asset ids are ignored.
- Each project page rebuild is acceptable latency for publication changes.

### Known limitations

- Production shows no immersive media until a production media origin exists;
  tours were validated locally with fixtures only (no DEV database, nothing
  published).
- Real-device testing (iOS Safari, Android Chrome, low-memory phones) is
  outstanding; mobile was checked in desktop-browser emulation only.
- No per-room deep links; no transition animation between rooms (the previous
  room stays visible until the next is ready); no hotspot authoring UI.
- Panoramas are single images; very large sources are downscaled on the client
  rather than tiled.
- Analytics events are dispatched locally only; no collector is wired up.

## 16. Gaussian splat rendering (Phase 7)

Phase 7 renders published Gaussian splat scenes (bundled SOG) in the existing
viewer and offers them on project pages as a third experience, **3D scan**. It
adds no AWS resources, no database model or migration, and no upload path; SOG
uploads, validation, processing, review and publishing are the Phase 2B-2 / 5
workflow unchanged. AR, VR and WebXR came later, in Phase 8 (§17); splat scenes
themselves have no XR mode.

**Validation vs rendering.** Phase 2B-2 (`infra/src/pipeline/sog.ts`) validates
SOG bundles before publication: archive hygiene, meta.json, lossless WebP
attributes, budgets, `streamingCandidate`. Phase 7 adds runtime *rendering*, plus
a narrow in-browser pre-check (`src/lib/viewer/sog-bundle.ts`) of every download.

### PlayCanvas runtime (engine 2.22.2, as installed)

Native support, no third-party renderer, decoder, WASM or extra `lib/` assets:

| Piece | API |
|---|---|
| Component system | `GSplatComponentSystem` (id `gsplat`; creates `app.renderer.gsplatDirector`; events `frame:request`, `frame:ready`) |
| Loader | `GSplatHandler` (asset type `gsplat`) with parsers `SogBundleParser` (`.sog` ZIP), `SogParser` (unbundled `meta.json`), `PlyParser` (`.ply`), `GSplatOctreeParser` (`lod-meta.json` streaming) |
| Scene | `entity.addComponent("gsplat", { asset })`; unified renderer (default) with `app.scene.gsplat` params (`splatBudget`, …) |
| Data | `GSplatSogData` / `GSplatSogResource`: attribute textures (RGBA8), a 256×1 RGBA32F codebook texture (v2), centres generated on the GPU into an RGBA32U target |
| Sorting | CPU sort in a Web Worker created from a Blob URL (WebGL 2); results arrive asynchronously |
| Shaders | Built in (GLSL and WGSL chunks registered by the component system) |

Requirements: WebGL 2 (float textures sampled with NEAREST, integer render
targets, workers, `DecompressionStream`, `createImageBitmap` for WebP). The
viewer already refuses to load anything without WebGL 2.

**Supported format:** one bundled `.sog` file (ZIP, stored or deflate, no ZIP64,
no archive comment) containing `meta.json` **v2** (`version: 2`, `count`,
256-entry codebooks for `scales`, `sh0` and optional `shN`) or **v1**
(`means.shape`, min/max ranges), and lossless WebP attribute images
(`means_l/means_u`, `quats`, `scales`, `sh0`, optional `shN` centroids/labels).
Any other version is refused ("unsupported SOG version"). Not supported in
Phase 7: `.ply`, unbundled `meta.json` + files, streamed LOD (`lod-meta.json`).

### Architecture

```
MediaAsset (PUBLISHED, SPLAT, SOG, this project)      project data (src/lib/projects.ts)
   │ publishedSplatQuery (allow-listed columns)            │ Project.splat: scene = published id | dev fixture
   ▼                                                       ▼
toPublishedSplat ─────────► projectSplatConfig (server) ─► { label, alt, source{kind:"splat"}, poster, placeholder }
                                                              │ (props; no DB rows, no keys)
ImmersiveSection → ImmersiveExperience tabs → SplatViewer (budget gate) → Aarvasa3DViewer
   → create-engine setSource(kind "splat") → import("./splat") → downloadSog (capped, abortable)
   → inspectSogBundle → assessSplat → GSplatHandler/Asset → Entity + gsplat → OrbitControls
```

New files: `src/lib/viewer/{sog-bundle,splat-budget,splat-download,splat-fixtures,published-splats,project-splat,immersive-modes}.ts`,
`src/lib/viewer/playcanvas/splat.ts`, `src/components/viewer/splat-viewer.tsx`,
`src/lib/services/project-splats.ts`, `src/app/labs/splats/[file]/route.ts`.

The engine's splat support (component system, handler, workers) is registered
on the first splat load only, from a separately loaded chunk, so model and
panorama viewers neither download nor construct it.

### Source contract

```ts
{
  kind: "splat",
  url: string,                              // same-origin .sog, or https://{media CDN}/m/{id}/{hash}/{file}.sog
  initialView: { yawDeg, pitchDeg, distanceFactor },   // distance × scene bounding radius
  upAxis: "y-up" | "y-down",                // y-down rotates 180° about X (original 3DGS/COLMAP frame)
  sizeBytes: number | null,                 // published metadata, checked before download
  gaussians: number | null,                 // Phase 2B-2 metrics.gaussians
}
```

`resolveSplatUrl` applies the model/panorama policy with the `.sog` extension:
review/, uploads/, originals/, other hosts, `http:`, query strings (presigned
URLs), fragments, credentials, traversal (plain or encoded), protocol-relative,
backslash, `javascript:`, `data:`, `blob:`, `.ply` and `meta.json` URLs are all
refused. `sanitizeSplatSource` rebuilds descriptors field by field. Scene bounds
come from the bundle itself (meta.json means min/max), so the descriptor does
not carry them.

### Runtime pre-check (every download)

PlayCanvas's bundle parser fetches any file meta.json names but the ZIP lacks,
**relative to the page**, and reads the ZIP end record only at the very end of
the file. `inspectSogBundle` therefore requires: the end record last; ≤ 64 flat,
safely named, unencrypted, non-duplicate entries with in-range data; a
parseable meta.json ≤ 1 MB (deflate via `DecompressionStream`); version 1 or 2;
a positive integer count; valid position bounds; 256-entry v2 codebooks; and
every referenced file present in the bundle as a `.webp` entry. Failures show
"damaged or not a supported SOG bundle" or "unsupported SOG version".

### Public media gating

Server-only, like tours. The page looks up only the id a project names, and
only `status = PUBLISHED`, `kind = SPLAT`, `format = SOG`,
`subjectType = PROJECT`, `projectSlug = this project`, selecting `id, status,
kind, format, subjectType, projectSlug, storageKey, entryFile, posterKey,
altText, sizeBytes, metrics, dimensions, viewDefaults`. `toPublishedSplat`
re-checks status, kind, format, subject, the key contract (`m/{id}/…/*.sog`,
`application/zip`), alt text and size ≤ 80 MB; a poster is used only if it is an
image key inside the asset's version directory with recorded dimensions. The
browser receives a `ProjectSplatConfig` (label, alt, descriptor, poster URL,
placeholder flag) — never a row, `sourceKey`, review key, diagnostics or reviewer
ids. Placeholder configurations and fixtures never reach production builds, and
production has no media origin yet, so production shows no splats. Pages are
statically generated: publication changes appear on the next build.

### Camera and controls

Orbit around the scene's bounding-sphere centre (`OrbitControls`, now framable
per content): drag (mouse, pen, touch), pinch and wheel zoom, arrow keys and
+/−, zoom and reset buttons, fullscreen. Limits: pitch −30° to 80°, distance
0.15–6 × the bounding radius; clip planes scale with the scene (near 0.005 R,
far 10 R) and are restored to the model defaults when other content is shown.
No auto-rotation; reduced motion removes easing.

### Memory and performance

- Nothing loads until the visitor picks **3D scan** and presses **Open 3D scan**
  (poster first when the asset has one); splats are never preloaded.
- The download is capped (80 MB, or 50 MB on constrained devices), refused early
  when Content-Length is over the cap, abortable, and uses `credentials: "omit"`.
- The size/count budget is applied twice: from published metadata before
  download (`SplatViewer`), and from the real byte size and meta.json count
  before anything reaches the GPU (`loadSplat`).
- One scene at a time: switching or closing destroys the entity, removes and
  unloads the asset (textures, codebook, centres) and terminates its sort worker;
  the downloaded bytes are released once the parser has uploaded them.
- Stale loads (rapid switching, close during load) are aborted at download,
  parse or upload through the existing `LoadGate`; a late result is destroyed.
- Render on demand as before (DPR ≤ 2, pause off-screen or hidden). Because
  sorting finishes in a worker, the engine keeps drawing while the splat
  renderer reports `frame:request` or a `frame:ready` that is not yet ready.
- `app.scene.gsplat.splatBudget` is set to the device's gaussian target; for a
  single SOG it only sizes the allocator (it governs LOD streaming).

### Mobile and scene-size limits

Budgets are the Phase 2B-2 ones (`src/lib/viewer/splat-budget.ts`, kept equal to
`infra/src/media-budgets.ts` by a test). A device is **constrained** when its
primary pointer is coarse or it reports `navigator.deviceMemory` ≤ 4 GB.

| Scene | Standard device | Constrained device |
|---|---|---|
| ≤ 20 MB and ≤ 1M splats | opens | opens |
| ≤ 50 MB and ≤ 3M splats | opens | warning, "Load anyway" |
| > 50 MB or > 3M splats (≤ 80 MB) | warning, "Load anyway" | refused before download |
| > 80 MB | refused | refused |

Unknown size or count is checked after download, before GPU upload. These are
review thresholds, not measured device limits; real-device testing is
outstanding. **Streaming is not supported in Phase 7.** The installed engine
can stream LOD octrees (`lod-meta.json`), but the published contract is a
single `.sog` file; scenes the pipeline flags `streamingCandidate` must stay
under the limits above or wait for streamed delivery.

### Failure behaviour

Each failure stays inside the viewer frame; the rest of the page is unaffected.
No WebGL 2: explanation, no download. HTTP failure, wrong content type,
malformed, corrupt or unsupported-version SOG: "Couldn't load the 3D scan" with
the reason and **Try again**. Too heavy: the gate above. Context loss: the
existing restore flow. Rapid open/close or mode switching: previous loads are
aborted.

### Accessibility and analytics

Labelled canvas (orbit keys, zoom keys), labelled zoom/reset/fullscreen/close
buttons, tabs with arrow-key support, loading/ready/error announcements
(`aria-live`), visible focus. Events: `splat_opened`, `splat_loaded`,
`splat_error` (`errorKind` `load` | `unsupported` | `too-large`), plus
`viewer_mode_selected`/`viewer_opened` with `mode: "splat"`; project slug and
fixed enums only.

### Development fixture

`/labs/splats/test-scene.sog` (404 in production) is generated from code
(`src/lib/viewer/splat-fixtures.ts`) as a real SOG v2 bundle (~13 KB, ≈3.6k
splats): a grey checkered disc, an orange tower outline and red/green/blue axis
markers for +X/+Y/+Z. It passes the Phase 2B-2 validator and depicts no real
place; no binary is committed. REEF 996 uses it as a labelled placeholder.

### How to add a published splat to a project

1. Export the capture as a bundled `.sog` (for example with PlayCanvas
   SuperSplat / splat-transform), within the budgets above.
2. Upload it in Admin → Media for the project as a Gaussian splat, with alt
   text; let it process (Phase 2B-2 validation) and approve it. Add a poster
   sidecar if you have one (headless splat posters are not generated).
3. In `src/lib/projects.ts`, add to `SPLAT_BY_SLUG`:

```ts
const EXAMPLE_SPLAT: ProjectSplatMedia = {
  label: "Show apartment 3D scan",
  review: "approved",
  scene: { source: "published", mediaAssetId: "cm1abcd2ef3gh4" },
  upAxis: "y-down",                                        // only if the scene appears upside down
  initialView: { yawDeg: 30, pitchDeg: 15, distanceFactor: 1.8 }, // optional
};
```

4. Run `npm test` in `infra/` and rebuild.

### Known limitations

- Not DEV-validated (no DEV database; nothing published) and not deployed;
  validated locally with the generated fixture only.
- Real-device testing (iOS Safari, Android Chrome, low-memory devices) is
  outstanding; mobile was checked in desktop-browser emulation.
- No streaming/LOD, no `.ply`, no multi-file SOG; one scene per project.
- The size gate uses published metadata and simple device signals; it cannot
  measure free GPU memory. iOS Safari does not expose `deviceMemory`.
- No per-asset rotation beyond `upAxis`; `viewDefaults.distance` (absolute) is
  ignored in favour of `distanceFactor`.
- Headless splat posters are not generated; without a sidecar poster the viewer
  shows its neutral placeholder.

## 17. AR Room Preview and VR Walkthrough (Phase 8)

Phase 8 adds two immersive modes to the existing 3D model viewer: **AR Room
Preview** (place the model in your own room) and **VR Walkthrough** (view it in
a headset). It adds no AWS resources, no database model or migration, no new
media pipeline and no second renderer: both modes run in the same PlayCanvas
app, on the same published model the 3D viewer already loads.

### What is and is not validated

| | Status |
|---|---|
| Capability detection, gating, fallbacks, failure and denial paths | Implemented; validated in headless Chrome 153 with real and mocked capabilities |
| Session lifecycle, placement, transforms, analytics | Implemented; covered by deterministic unit tests |
| Entering a real AR session (surface detection, placement, scale on a phone) | **Not validated: no WebXR device was available.** |
| Entering a real VR session (headset, controllers, teleport) | **Not validated: no headset was available.** |
| DEV / production | Not deployed (no DEV database; production has no media origin) |

No AR or VR device support is claimed. The code paths that a real device would
exercise — `requestSession` succeeding, hit-test results, controller input —
have never run against real hardware. Chrome's WebXR Test API is not exposed in
the available build, so a simulated session could not be used either.

### PlayCanvas XR APIs used (engine 2.22.2, as installed)

| Need | API |
|---|---|
| Manager | `XrManager`, attached to the viewer's app on first use (`app.xr`), since the app is not built with one |
| Support | `navigator.xr.isSessionSupported` for the page's own gating; `XrManager#isAvailable` / `available:<type>` for the engine's |
| Start / end | `app.xr.start(cameraComponent, XRTYPE_AR \| XRTYPE_VR, XRSPACE_LOCALFLOOR, { optionalFeatures, callback })`, `app.xr.end()` |
| Events | `start`, `end`, `error` on the manager |
| Hit test | `app.xr.hitTest.supported`, `app.xr.hitTest.start({ spaceType: XRSPACE_VIEWER, entityTypes: [plane, point] })`, source `result` (position, rotation) |
| Input | `app.xr.input` `add`/`remove`; input source `select`, `squeeze`, `getOrigin()`, `getDirection()` |
| DOM overlay | `app.xr.domOverlay.supported` / `.root` (the AR controls are ordinary HTML) |
| Rendering | The session drives frames: `app.requestAnimationFrame()` routes through `session.requestAnimationFrame` while a session exists |
| Camera | The passed camera component is driven by the headset pose; the viewer's orbit controls stand down for the session |

No polyfill, framework or decoder is required. AR passthrough needs no special
context: the engine creates its `XRWebGLLayer` with `alpha: true` and calls
`gl.makeXRCompatible()` itself.

Not used in Phase 8: anchors, plane/mesh detection, image tracking, light
estimation, depth sensing, hand tracking.

### Capability detection

Four separate questions, never inferred from one another: WebGL 2, `navigator.xr`,
`immersive-ar`, `immersive-vr` (plus secure-context). Detection uses
`navigator.xr.isSessionSupported` only, so probing downloads no engine code, and
it never throws: a `SecurityError` from a permission policy is reported as
"not supported". Reasons are `ok`, `no-webgl2`, `no-webxr`, `no-modes`,
`insecure-context`, `detection-failed`. A mode's button appears only when the
project offers it *and* the device reports it.

### XR source and capability contract

XR capability is separate from media kind: a published model is shown in 3D
whether or not AR or VR is offered. A project opts in per mode:

```ts
// ProjectImmersiveMedia.xr, src/lib/project-types.ts
xr: {
  modes: ["ar", "vr"],
  scale: { metersPerUnit: 1, previewScale: 1 },
}
```

`xrExperienceFor` (src/lib/viewer/xr-contract.ts) builds the client-safe
descriptor and re-checks the model URL against the published-media policy
(`resolveModelUrl`), so review copies, uploads, originals, other hosts,
presigned URLs, credentials, traversal and malformed URLs can never reach a
session even if project data asked for them. Panoramas and splats have no XR
mode in Phase 8: `immersive-vr` for a 360° image and AR for a Gaussian splat
are deferred, not faked.

### Model scale (the assumption, stated)

Nothing is inferred from geometry. `metersPerUnit` is what one model unit means
in the real world (1 = the GLB is authored in metres, which is glTF's own
convention), and `previewScale` is the deliberate preview factor (1 = life
size; 0.02 for a 1:50 tabletop massing model). The AR placement scale is
`metersPerUnit × previewScale`, and the visitor can then resize between
0.1× and 4×. An invalid or missing scale falls back to `{ 1, 1 }` — never to a
guess. The REEF 996 pilot model is a placeholder authored in metres and shown
life size.

### AR Room Preview

Flow: **View in AR** → session (user gesture only) → "Move your device slowly to
find a floor or table" → reticle on a detected surface → **Place** → turn,
resize, **Move** (place again), **Exit**.

One reticle entity and one placement entity are created per session and reused;
nothing is created per frame and no markers accumulate. The model hangs off the
placement entity, so turning and resizing never touch the loaded content. Where
hit test is unavailable the model is placed a fixed distance in front of the
visitor instead. Where DOM overlay is supported, the controls are ordinary
accessible HTML buttons over the camera feed; gestures are not the only way to
do anything. This is a visualisation, **not an architectural measurement tool**.

### VR Walkthrough

Flow: **VR Walkthrough** → session → the model stands 2.5 m in front on the
floor plane → point a controller at one of six floor markers and press select to
move there → squeeze, or the headset's own gesture, to leave.

Locomotion is deliberately **bounded point-to-point teleporting** between fixed
stops around the model: no continuous artificial locomotion, which is the main
source of motion discomfort. Controllers are tracked through `app.xr.input`
with a thin pointer per controller, added and removed with the input source.
Hand tracking, grabbing, scene-scale room walking and multi-room VR navigation
are **not** implemented.

### Session lifecycle

The lifecycle is a pure reducer (src/lib/viewer/xr-session.ts): `idle →
requesting → active → ending → idle`, with `error` as a dead end that returns
to the standard viewer. It enforces one session at a time (a second request
while starting, running or ending is ignored), the placement order (nothing can
be placed before a surface is found), transform limits, and a full reset on
every end — including an end the page did not ask for. On exit the runtime
removes the hit-test source, destroys the reticle, placement, rig, stops and
pointers, restores the model's original parent and transform, the camera's pose
and clear colour, and clears the DOM overlay root.

PlayCanvas refuses to start until its own asynchronous availability check has
answered ("XR is not available"), so the runtime is built as soon as a mode is
on offer (`prepareXr`) and a request that still arrives early waits briefly for
the answer. Without this the visitor's *first* tap always failed.

### Performance

The XR code is a separate chunk, loaded only when a supported mode is actually
offered. While a session runs, the page's own render-on-demand loop stands down
and the session drives every frame; the orbit controls stop updating so they
cannot fight the headset pose. Nothing else is loaded for XR: AR and VR reuse
the model already in the viewer, so the Phase 1 model budget and the existing
DPR cap still apply. No post-processing is added. Frame rates were not measured
and none are claimed.

### Security, privacy and permissions

Only `PUBLISHED`, approved, immutable `m/{id}/{hash}/…` media reaches a
session, re-checked at the contract boundary. The descriptor sent to the
browser carries a label, the model URL, scale and a placeholder flag — never a
row, `sourceKey`, review key, signed URL, credential or diagnostic.

AR uses the browser's own WebXR permission model. The site implements **no
camera capture of any kind**: no `getUserMedia`, no frames read, stored or
uploaded, no photo or recording feature, and nothing about the camera in
analytics. A session starts only from an explicit button press, the overlay
always shows an Exit control, and the end of a session is announced.

### Accessibility

XR is never the only path: the interactive 3D viewer remains and is what
unsupported devices get. Entry buttons and every AR control are real buttons
with labels, keyboard focus and 44 px targets. Session start, placement and
return to the standard viewer are announced through an assertive live region,
and failures are announced with the reason.

### Analytics

Added to the existing first-party allow-list: `ar_opened`, `ar_started`,
`ar_placement`, `ar_placement_reset`, `ar_error`, `vr_opened`, `vr_started`,
`vr_error`, `xr_exit`, with `xrMode` (`ar`/`vr`), `exitReason`
(`user`/`session-ended`/`error`) and the existing `errorKind`. No URLs, keys,
poses, camera data or device identifiers; no third-party SDK.

### Browser validation performed

Headless Chrome 153 (software WebGL 2), 390×844 touch emulation, against the
dev server:

- real capabilities on this machine (`navigator.xr` present, both modes false):
  no AR/VR buttons, the "AR isn't available on this device" line instead, and no
  XR chunk downloaded;
- both modes mocked as supported: both buttons appear with their help text;
- session entry failing (no device; and a mocked `NotAllowedError`): the
  message names the reason, the overlay stays hidden, the 3D viewer is still
  ready and interactive, one canvas, and reset/zoom still work;
- repeated rapid AR/VR attempts: one canvas, one overlay, no duplicate session;
- 360° tour and 3D scan experiences: no XR entry points.

### Known limitations

- No real-device validation (see the table above); iOS Safari has no WebXR at
  all, so AR there is unavailable by design of the platform, not a bug here.
- Only a model can enter XR; panorama and splat XR are deferred.
- No anchors: a placed model is held in the session's local-floor space and can
  drift on some devices.
- No occlusion, lighting estimation or shadows against the real room.
- AR without hit test falls back to a fixed distance in front of the visitor.
- VR locomotion is teleport-only between fixed stops; there is no room-scale
  walking, hand tracking or object grabbing.
- No in-VR HTML controls (WebXR has no DOM in VR): exit is squeeze or the
  headset gesture.
- The pilot uses a placeholder model, so AR/VR in development shows a test
  asset, labelled as such.
