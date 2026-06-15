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
    property/             Listing filters, property cards, hero search
    ui/                   shadcn-style primitives
    roi-chart.tsx
  lib/
    auth.ts               JWT helpers
    blockchain.ts         Simulated transaction utilities
    db.ts                 Lazy Mongoose connection
    properties.ts         Seed data and simulated AI ranking
  models/
    User.ts
    Property.ts
    Transaction.ts
```

## Environment

Create `.env.local` from `.env.example`.

```bash
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/aarvasa
JWT_SECRET=replace-with-a-long-random-secret
NEXT_PUBLIC_MAPBOX_TOKEN=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash
```

Without MongoDB configured, auth and blockchain transactions fall back to demo mode so the UI can be reviewed locally. Without a valid `GEMINI_API_KEY`, `/api/chat` returns a setup instruction response.

## Run

```bash
npm install
npm run dev
npm run build
```

## API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/properties`
- `GET /api/properties/:id`
- `GET /api/ai/recommendations?budget=50000000&risk=Balanced&type=Villa`
- `POST /api/chat`
- `POST /api/blockchain/transaction`
- `GET /api/blockchain/status?hash=0x...`

## Production Notes

- Auth uses an HTTP-only `aarvasa_token` cookie and dashboard verification happens in both `src/proxy.ts` and the dashboard Server Component.
- MongoDB is initialized lazily to keep builds safe when environment variables are absent.
- Property APIs include cache headers for edge-friendly reads.
- Remote property imagery is configured for `images.unsplash.com` in `next.config.ts`.
- The app uses `tailwind.config.js` plus CSS variables for a unified maroon, gold, cream, and black theme with a dark/light toggle.
