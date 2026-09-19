# Aarvasa immersive media infrastructure (development)

AWS CDK (TypeScript) definitions for the private S3 + CloudFront media platform
approved in Phase 2A. **Nothing in this directory has been deployed**, and no
script in this repository deploys it.

Cloudinary remains the system for normal 2D property photos. Immersive media
never goes through `/api/upload`.

---

## 1. Architecture

```
Browser (future upload flow)                     Aarvasa pages (future viewer)
   │ presigned PUT/POST                                   │ GET (CORS, no credentials)
   ▼                                                      ▼
S3  aarvasa-media-dev-ingest-*  ── processor ──►  S3  aarvasa-media-dev-published-*
    uploads/… (expires 7 d)      (later phase)        m/…  lib/…  (CDN)   originals/… (never CDN)
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
| `AarvasaMediaDev-Processing` | ap-south-1 | Processing queue, dead-letter queue, **unattached** producer/consumer IAM policies (Phase 5C, section 14) |

The stacks have **no cross-stack references**. The WAF ARN and distribution id
are passed explicitly (`-c`) after review, so each stack deploys on its own and
no hidden custom-resource Lambdas are generated.

## 2. Required AWS services

S3, CloudFront (distribution, Functions, OAC, cache and response headers
policies), WAFv2, CloudWatch alarms, SNS, AWS Budgets, SQS, IAM (managed policies
only). No Lambda, no schedules, no custom resources, no CDK bootstrap resources.

## 3. Bucket purposes

| Bucket | Purpose | Versioning | Lifecycle |
|---|---|---|---|
| `aarvasa-media-dev-ingest-{account}-{region}` | Temporary browser uploads, never served | Off (transient) | Expire after 7 days; abort incomplete multipart after 1 day |
| `aarvasa-media-dev-published-{account}-{region}` | Immutable derivatives, decoders, private originals | On (recovery from accidental delete) | Noncurrent versions expire after 30 days; expired delete markers removed; abort incomplete multipart after 1 day |

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

Four customer-managed policies are **created but attached to nothing**:

| Policy | Future principal | Allows | Does not allow |
|---|---|---|---|
| `aarvasa-media-dev-app-upload-intents` | Amplify SSR Compute role | `PutObject`, `AbortMultipartUpload`, `ListMultipartUploadParts`, `GetObject`, `GetObjectAttributes` on `ingest/uploads/*` (presign, complete and verify uploads) | Anything outside `ingest/uploads/*`, anything in the published bucket, deletes, listing, infrastructure changes |
| `aarvasa-media-dev-processor` | Processing worker | `GetObject`/`GetObjectAttributes` on `ingest/uploads/*`; write-once `PutObject` plus multipart on `published/m/*`; `GetObject`/`GetObjectAttributes` on `published/m/*` (to confirm a rerun found identical bytes) | `originals/*` (passthrough-v1 keeps no separate original), `lib/*`, deletes, listing, other buckets, queues |
| `aarvasa-media-dev-processing-producer` | Amplify SSR compute role (completion) and the sweeper | `sqs:SendMessage` on the processing queue | Receiving, deleting, purging, the dead-letter queue, anything else |
| `aarvasa-media-dev-processing-consumer` | Processing worker | `sqs:ReceiveMessage`, `DeleteMessage`, `ChangeMessageVisibility`, `GetQueueAttributes` on the processing queue | Sending, purging, queue changes, the dead-letter queue, anything else |

The worker's database writes go through the application's database role only
(conditional updates in `src/lib/services/media-processing.store.ts`); it has no
separate database privileges.

`s3:GetObject` on `uploads/*` is there for upload completion: S3 authorizes
`HeadObject` (and `GetObjectAttributes`) with `s3:GetObject`, and there is no
header-only permission, so verifying an upload's size, type and SHA-256 technically
lets the app read upload bodies, under `uploads/*` only. `s3:ListBucket` is
deliberately not granted, so S3 answers 403 rather than 404 for a missing key
under this policy; the app treats 403 as "verification unavailable" (retryable),
never as proof that an upload is missing. The policy change exists only in code:
it is not deployed and not attached.

Bucket policies add defence in depth: TLS enforcement, prefix confinement,
write-once, and CloudFront-only reads. No roles, users or access keys are defined.

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

## 11. How deployment will eventually work (not now)

There is **no deploy script**. When deployment is approved, a person with
credentials for the **development** account runs, stack by stack, reviewing
each change set (`requireApproval: any-change`):

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

`MEDIA_REGION` and `MEDIA_INGEST_BUCKET` are read by `POST /api/media/upload-intent`
(Phase 5A) and `POST /api/media/{mediaAssetId}/complete` (Phase 5B), both through
`src/lib/media/ingest-storage.ts`. The others are not used yet.

Follows the repository's `SERVICE_` prefix convention (`CLOUDINARY_*`, `AUTH_*`).
All are **server-only**. Never prefix them with `NEXT_PUBLIC_`: the viewer
receives complete URLs from Server Components.

| Variable | Example | Notes |
|---|---|---|
| `MEDIA_REGION` | `ap-south-1` | Region of both buckets |
| `MEDIA_INGEST_BUCKET` | Storage output `IngestBucketName` | Presign and verification (HeadObject) target |
| `MEDIA_PUBLISHED_BUCKET` | Storage output `PublishedBucketName` | Named explicitly because there are two buckets |
| `MEDIA_CDN_ORIGIN` | Storage output `MediaCdnOrigin` (`https://d….cloudfront.net`) | Used both to build asset URLs and as the viewer's single allowed remote origin. A separate `MEDIA_CDN_URL` would duplicate it and could drift |

- No AWS access keys: the app will use the Amplify SSR Compute role with the
  `app-upload-intents` policy.
- Before upload intents are used on a deployed environment, `amplify.yml`'s
  forwarding regex must gain `MEDIA_`. It is intentionally unchanged so far.

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

- No AWS resources exist from this work. Nothing has been deployed.
- No production buckets, distribution, WAF, DNS records, certificates or IAM
  attachments.
- The processing queue, worker and sweeper (section 14) exist as code, CDK and
  tests only: no queue is deployed, no Lambda or container runs the worker, no
  schedule runs the sweeper, and no SQS producer is wired into the app.
- No multipart uploads. The pipeline does not optimise GLBs, convert PLY to SOG,
  or render model/splat posters.
- No changes to `/api/upload`, Prisma, property or project pages, `amplify.yml`,
  or the Phase 1 viewer.
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
3. **Processing** (Phase 5C, implemented as code and tests, not deployed; section 14): after the completion commits, a job goes to the processing queue; the worker claims the row, re-verifies the source, runs this same `processAssets` code, publishes write-once under `m/`, and moves the row to `PENDING_REVIEW`.
4. **Database** (`MediaAsset` row): processing fills `storageKey`, `entryFile`, `contentHash` (the processed entry file's hex SHA-256, unrelated to `sourceChecksumSha256`), poster fields, metrics and validation status from the manifest, plus moderation state.
5. **Delivery:** Server Components build URLs as `MEDIA_CDN_ORIGIN + "/" + key`. The origin is server configuration and never part of the manifest.

## 14. Processing and recovery (Phase 5C)

Code: `shared/media-processing.ts` (contract, state machine, policy),
`infra/src/processing/` (worker, sweeper, SQS handler, S3 adapters),
`src/lib/services/media-processing.store.ts` (Prisma store),
`infra/src/stacks/media-processing-stack.ts` (queue). Tests: `infra/test/processing/`.
**Not deployed**: no queue exists in AWS, nothing runs the worker or the sweeper.

```
POST /complete ── commit UPLOADED→PROCESSING ──► send job (best effort, after commit)
                                                        │
sweeper (every 15 min, not scheduled yet) ─ re-send ────┤
                                                        ▼
                          aarvasa-media-dev-processing (SQS) ──5 receives──► …-processing-dlq
                                                        │
                                                        ▼
worker: parse job → re-read row → claim lease (attempt n) → read + re-verify source
        → processAssets (Phase 2B-2, unchanged) → write-once PutObject under m/
        → PROCESSING → PENDING_REVIEW        (or → FAILED with a failure code)
```

### Processing job (schema version 1)

```json
{ "schemaVersion": 1, "jobId": "<uuid v4, per dispatch>", "mediaAssetId": "<id>",
  "sourceKey": "uploads/<id>/<uploadId>/source.<ext>", "processingVersion": "1.0.0/passthrough-v1",
  "idempotencyKey": "<id>:1.0.0/passthrough-v1", "dispatchedAt": "<ISO-8601>" }
```

Identifiers only, parsed strictly (unknown fields, other versions, another asset's
key, a forged idempotency key or anything over 1 KiB are rejected and end in the
DLQ). Owner, subject, status, MIME type, size, checksum and output keys are never
in a job: the worker reads them from `MediaAsset`. Only server code builds jobs,
and only from a committed `PROCESSING` row; no route accepts one from a browser.
The job is sent **after** the transition commits, so it can never run ahead of it;
if the send fails or the message is lost, the sweeper re-sends it.

### State machine

| From | To | Who |
|---|---|---|
| UPLOADED | PROCESSING | upload completion (verified) |
| UPLOADED | FAILED | upload intent (signing failed), completion (mismatch/expired), sweeper (expired/abandoned) |
| PROCESSING | PENDING_REVIEW | worker (processed) |
| PROCESSING | FAILED | worker (permanent failure, retries exhausted), sweeper (timeout, retries exhausted, inconsistent) |
| PENDING_REVIEW | PUBLISHED / REJECTED | review (later phase, not implemented) |
| PENDING_REVIEW, PUBLISHED, REJECTED, FAILED | ARCHIVED | archival (later phase, not implemented) |

No VERIFIED state. Processing success never publishes. Every writer calls
`assertTransition` and makes its change with one conditional update on the
current status. `MediaAsset_processing_check` enforces: `failureCode` exactly when
FAILED, `processingStartedAt` while PROCESSING, a lease only while PROCESSING.

### Retry policy

| Class | Examples | Result |
|---|---|---|
| Retryable | S3 5xx, throttling, 403, network, credentials; 409 conditional-write conflict; database errors; unexpected worker exceptions; ingest encryption drift | lease released, message kept, SQS redelivers after 15 min |
| Permanent | invalid/unsupported format, MIME mismatch, external glTF URI, data URI, meshopt, unsupported required extension, other validation failures, hard size limit, source missing, size/SHA-256 mismatch, invalid source key, immutable-object conflict | FAILED at once, message deleted, never retried |

Attempts are counted in the database (`processingAttempts`, max 3); a transient
failure on the last attempt fails the asset with `RETRIES_EXHAUSTED`. SQS moves a
message to the DLQ after 5 receives, which only happens to messages the worker
refuses outright (invalid jobs).

| Failure code | Meaning |
|---|---|
| `UPLOAD_AUTHORIZATION_FAILED`, `UPLOAD_EXPIRED`, `UPLOAD_VERIFICATION_FAILED` | upload phase (5A/5B, sweeper) |
| `INVALID_SOURCE`, `SOURCE_MISSING`, `SOURCE_INTEGRITY_FAILED` | the stored source is unusable |
| `UNSUPPORTED_CONTENT`, `VALIDATION_FAILED`, `SIZE_LIMIT_EXCEEDED` | the pipeline's findings |
| `PROCESSING_TIMEOUT`, `RETRIES_EXHAUSTED`, `INTERNAL_ERROR` | processing did not finish |

Users only ever see `PUBLIC_FAILURE_MESSAGES[failureCode]`; `processingError`
keeps the internal diagnostic (rule ids and validator messages, bounded to 2,000
characters), which can quote file content and is never shown or logged.

### Idempotency

- **Lease**: `claim` is one conditional update (PROCESSING, same source, lease free,
  attempts < 3) that increments `processingAttempts` and sets a 10-minute lease.
  The attempt number is the lease token: completion and failure updates require it,
  so a worker that lost its lease can never overwrite the newer outcome.
- **Timing**: worker ≤ 5 min < lease 10 min < SQS visibility 15 min, so SQS never
  hands a message to a second worker while the first may hold the asset.
- **Outputs**: keys are content-addressed (`m/{id}/{hash16}/…`, the pipeline's
  deterministic key hash). `PutObject` sends `If-None-Match: *` and the SHA-256;
  412 is accepted only when the stored object is byte-identical, otherwise the
  asset fails with `INTERNAL_ERROR` and nothing is overwritten.
- Duplicate or concurrent deliveries, a crash before or after publishing, and a
  racing sweeper all converge on exactly one terminal state (tested offline and
  on PostgreSQL).

### Sweeper

A bounded, conditional pass (`runSweep`), safe to run concurrently:

| | Candidate | Action |
|---|---|---|
| A | UPLOADED, older than the completion deadline (10 min URL + 1 h grace), object missing | FAILED `UPLOAD_EXPIRED` |
| A | UPLOADED, never completed, older than 24 h (object present or S3 unknown) | FAILED `UPLOAD_EXPIRED` |
| B | PROCESSING for more than 6 h, lease free | FAILED `PROCESSING_TIMEOUT` |
| C | PROCESSING, lease free, 3 attempts used | FAILED `RETRIES_EXHAUSTED` |
| C | PROCESSING, lease free, inconsistent row (bad key, no checksum) | FAILED `INVALID_SOURCE` |
| D | PROCESSING, lease free, attempts left, started > 15 min ago | job re-sent (no write) |

Every update re-states its condition in SQL; a row that moved on is skipped. It
never touches PENDING_REVIEW, PUBLISHED, REJECTED, FAILED or ARCHIVED rows and
never deletes objects. **Scheduling (not deployed):** an EventBridge Scheduler
rule every 15 minutes invoking a function that runs `runSweep` with the app's
database role, the upload-intents policy (HeadObject) and the producer policy.

### Source retention

- Ingest objects expire 7 days after upload (bucket lifecycle rule
  `expire-uploads-and-abort-multipart`, unchanged); incomplete multipart uploads
  after 1 day. Nothing deletes a source earlier, including FAILED ones.
- Every processing deadline is far inside that window: completion 70 min,
  abandonment 24 h, processing timeout 6 h, queue retention 4 days (tested against
  the CDK config).
- passthrough-v1 publishes the verified source byte-for-byte as the entry, so no
  separate original is kept and the processor has no `originals/` access. A future
  transforming profile must copy originals before the 7-day expiry.
- Published derivatives are write-once and kept (versioned bucket). Objects of an
  asset that later fails its database update are orphaned but harmless;
  cleaning them up is a later phase.

### Observability

One structured record per job, `media.processing.job`: `mediaAssetId`, `jobId`,
`messageId`, `receiveCount`, `attempt`, `processingVersion`, `durationMs`,
`result`, final `status`, `errorCategory`, failing rule ids. One per sweep,
`media.processing.sweep`, with counts. Never URLs, credentials, object bytes,
validator messages or S3 error bodies.

### How the worker would run (not deployed)

A Lambda (or container) with the processor and consumer policies and the app's
database role, fed by an SQS event source mapping with `ReportBatchItemFailures`
and batch size 1, timeout 5 min; `handleProcessingBatch` is that handler. The
app's completion route would pass an SQS producer as `dispatchProcessing`; that
adapter needs `@aws-sdk/client-sqs`, which is not installed yet, so the route
does not dispatch today and PROCESSING rows would wait for the sweeper.
