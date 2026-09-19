# Aarvasa PropTech Platform

A premium Next.js App Router application for AI-assisted real estate investing, ROI analytics, protected investor dashboards, and JWT-backed authentication.

## Folder Structure

```txt
src/
  app/
    api/                  Route handlers for auth, chat, blockchain, properties, and AI recommendations
    about/ contact/       Company and lead-capture pages
    ai-chat/              Full-screen AI advisor experience
    blockchain/           Secure transaction flow and simulation
    dashboard/            Protected investor dashboard
    login/ signup/        Auth screens
    listings/             Property marketplace
    property/[id]/        Property detail pages
    properties/           Legacy redirects
  components/
    blockchain/           Blockchain flow UI
    chatbot/              ChatGPT-style AI advisor
    layout/               Navbar, theme provider, animation helpers
    property/             Listing filters, property cards
    ui/                   shadcn-style primitives
  lib/
    blockchain.ts         Simulated transaction utilities
    db.ts                 Lazy Mongoose connection (blockchain routes only)
    prisma.ts             Prisma client singleton (primary datastore)
    properties.ts         Seed data and simulated AI ranking
  models/
    Transaction.ts        Mongoose model, used by /api/blockchain/*
  auth.ts                 NextAuth v5 config (Google + credentials + wallet)
  proxy.ts                Route protection (Next 16 renamed middleware.ts -> proxy.ts)
```

## Data stores

The app uses **two** datastores, which is easy to trip over:

- **PostgreSQL via Prisma** (`DATABASE_URL`) is the primary store — users, auth, properties. NextAuth's Prisma adapter and every credentials login read from here, so **if Postgres is unreachable, login fails** with NextAuth's "Server error / There is a problem with the server configuration" page.
- **MongoDB via Mongoose** (`MONGODB_URI`) backs only `/api/blockchain/*`.

## Environment

Create `.env.local` for local development. In production these are set in the
Amplify console (App settings → Environment variables) and copied into
`.env.production` at build time by `amplify.yml`.

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
AUTH_SECRET=replace-with-a-long-random-secret
AUTH_URL=https://www.aarvasa.com
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_DIAG_KEY=            # optional; unlocks detailed output at /api/diag?key=...
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/aarvasa
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_UPLOAD_PRESET=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
MEDIA_REGION=ap-south-1   # optional; immersive media upload intents (server-only)
MEDIA_INGEST_BUCKET=      # optional; Storage stack output IngestBucketName
```

Immersive media uploads also need AWS credentials from the SDK's default chain
(a local profile, or the compute role when deployed) that are allowed to sign
PUTs to, and HeadObject (`s3:GetObject`), the ingest bucket's `uploads/*`.
Without `MEDIA_REGION` and `MEDIA_INGEST_BUCKET`, `POST /api/media/upload-intent`
and `POST /api/media/:id/complete` return 503.

Note that `amplify.yml` only forwards variables matching a fixed prefix list
(`DATABASE_URL`, `AUTH_`, `MONGODB_URI`, `GEMINI_`, `CLOUDINARY_`, …). A new
variable outside those prefixes will not reach the running app until that
pattern is extended.

Without a valid `GEMINI_API_KEY`, `/api/chat` returns a setup instruction response.

## Applying schema changes

The build deliberately does **not** run `prisma db push`. Doing so mutated the
production schema on every deploy and could drop columns on drift, and it made
deploys fail whenever the database was briefly unreachable.

Apply schema changes on purpose, from a machine that can reach the database:

```bash
DATABASE_URL='postgresql://...' npx prisma migrate deploy
```

Use `npx prisma db push` only against a local or throwaway database.

Migrations start at `prisma/migrations/0_init`, a baseline of the schema that
databases created with `db push` already have. Once per existing database, before
the first `migrate deploy`, confirm the database matches that baseline (no output
means it matches) and mark it as applied. Never run `0_init` against it:

```bash
git show 88d97cb:prisma/schema.prisma > /tmp/baseline.prisma
DATABASE_URL='postgresql://...' npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel /tmp/baseline.prisma --script
DATABASE_URL='postgresql://...' npx prisma migrate resolve --applied 0_init
```

Do not run `prisma migrate dev` or `db:reset` against a shared database: on drift
they offer to reset it.

## Health check

`GET /api/diag` reports whether each required variable is present and whether
Postgres is reachable. Add `?key=$AUTH_DIAG_KEY` for the raw driver error.
A `dbErrorCode` of `P1001` means the database is unreachable from the app.

## Run

```bash
npm install
npm run dev
npm run build
```

## API

- `GET|POST /api/auth/[...nextauth]` (NextAuth: sign-in, callback, session, CSRF)
- `POST /api/auth/signup`
- `GET /api/auth/logout`
- `GET /api/diag`
- `GET /api/properties`
- `GET /api/properties/:id`
- `POST /api/media/upload-intent` (JSON; property owner or admin for a property, admin for a project; requires the file's base64 `sha256`, which is stored; returns one presigned PUT to the ingest bucket, bound to the exact key, `Content-Type`, `Content-Length` and `x-amz-checksum-sha256`, and records the asset as `UPLOADED`, meaning not yet verified or processed; at most 20 intents per uploader per 24 hours, whatever their status)
- `POST /api/media/:mediaAssetId/complete` (`Content-Type: application/json`, body exactly `{}`; an admin, or for a property asset the current property owner who is also the uploader; otherwise 404. The server checks the ingest object with HeadObject against the stored key, size, `Content-Type` and SHA-256, then moves the asset `UPLOADED` → `PROCESSING` exactly once. `PROCESSING` means verified and waiting for processing, which is not built yet. See [Media upload completion](#media-upload-completion))
- `GET /api/ai/recommendations?budget=50000000&risk=Balanced&type=Villa`
- `POST /api/chat`
- `POST /api/blockchain/transaction`
- `GET /api/blockchain/status?hash=0x...`

### Media upload completion

The browser's report that an upload succeeded is never trusted. After the presigned
PUT, the client calls `POST /api/media/:mediaAssetId/complete` with `{}`. Every value
the check uses comes from the `MediaAsset` row written at intent time.

1. Authenticate (session cookie or Bearer token) and re-read the user from the database; the token's role is ignored.
2. Load the asset and authorize against its stored subject: `ADMIN`, or for a property asset a caller who is both the property's current owner and the uploader. Project assets are admin-only. Anything else is a 404, like a missing asset.
3. Refuse (409, no S3 call) a row whose `sourceKey` is not `uploads/{mediaAssetId}/{uploadId}/source.{ext}` for this asset, or which has no stored checksum.
4. `HeadObject` (`ChecksumMode: ENABLED`) on that key and require: `ContentLength` = `sourceSizeBytes`, `ContentType` = `sourceMimeType`, `ChecksumSHA256` = `sourceChecksumSha256` (canonical base64, compared as stored), `ChecksumType` `FULL_OBJECT` when reported, `ServerSideEncryption` `AES256`, and no `Content-Encoding`, `Content-Disposition`, `Cache-Control` or user metadata. `ETag` is never used for integrity.
5. One conditional update (`status = UPLOADED` plus every verified value and the authorization) sets `PROCESSING`. Concurrent requests converge: exactly one reports `transitioned: true`.

| Response | Meaning | Row |
|---|---|---|
| 200 `{ status: "PROCESSING", transitioned: true }` | Verified and handed to processing | `UPLOADED` → `PROCESSING` |
| 200 `{ status, transitioned: false }` | Already `PROCESSING`, `PENDING_REVIEW`, `PUBLISHED` or `REJECTED`; no S3 call | unchanged |
| 409 `UPLOAD_NOT_FOUND` (retryable) | No object yet, before `createdAt` + 10 min URL lifetime + 1 h grace | unchanged |
| 409 `UPLOAD_EXPIRED` | Still no object after that deadline | → `FAILED` |
| 409 `NOT_COMPLETABLE` | `FAILED`, `ARCHIVED`, or an inconsistent row | unchanged |
| 422 `UPLOAD_VERIFICATION_FAILED` | The object is not what was authorised | → `FAILED` |
| 503 `VERIFICATION_UNAVAILABLE` (retryable) | S3 denied (403), throttled, 5xx or unreachable; uploads not configured; unexpected bucket encryption | unchanged |
| 401 / 404 / 400 / 413 / 415 / 500 | Unauthenticated / not found or not allowed / body not `{}` / body too large / not JSON / server error (retryable) | unchanged |

Errors are `{ success: false, error, code, retryable }` with generic messages; AWS
details stay in server logs. Responses are `Cache-Control: no-store`.

The committed `PROCESSING` row is the processing handoff. Only after it commits is
a processing job sent (when a queue producer is configured; none is wired yet).
The processing worker then re-verifies the source, runs the media pipeline,
writes the derived files write-once and moves the asset to `PENDING_REVIEW`,
never straight to `PUBLISHED`; failures end in `FAILED` with a `failureCode`
whose generic message is the only text a user sees. A sweeper fails abandoned
uploads and stuck processing. None of this is deployed: see
[infra/README.md section 14](infra/README.md#14-processing-and-recovery-phase-5c).
The ingest bucket's lifecycle rule (objects expire 7 days after upload) is the
ultimate retention boundary for every source.

## Production Notes

- Auth is NextAuth v5 with a JWT session strategy; route protection happens in `src/proxy.ts` and again in the protected Server Components.
- MongoDB is initialized lazily to keep builds safe when environment variables are absent.
- Property APIs include cache headers for edge-friendly reads.
- Remote imagery is whitelisted in `next.config.ts` for `images.unsplash.com`, `ui-avatars.com`, and `res.cloudinary.com` (uploads go to Cloudinary, so that host must stay listed or `next/image` will throw).
- The app uses `tailwind.config.js` plus CSS variables for a unified maroon, gold, cream, and black theme with a dark/light toggle.
