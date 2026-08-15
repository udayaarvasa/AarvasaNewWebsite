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
```

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
- `GET /api/ai/recommendations?budget=50000000&risk=Balanced&type=Villa`
- `POST /api/chat`
- `POST /api/blockchain/transaction`
- `GET /api/blockchain/status?hash=0x...`

## Production Notes

- Auth is NextAuth v5 with a JWT session strategy; route protection happens in `src/proxy.ts` and again in the protected Server Components.
- MongoDB is initialized lazily to keep builds safe when environment variables are absent.
- Property APIs include cache headers for edge-friendly reads.
- Remote imagery is whitelisted in `next.config.ts` for `images.unsplash.com`, `ui-avatars.com`, and `res.cloudinary.com` (uploads go to Cloudinary, so that host must stay listed or `next/image` will throw).
- The app uses `tailwind.config.js` plus CSS variables for a unified maroon, gold, cream, and black theme with a dark/light toggle.
