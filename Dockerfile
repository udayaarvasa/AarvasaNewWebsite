# Production container for the private-database runtime (see
# docs/private-database-runbook.md). Not used by Amplify, which builds from
# amplify.yml. Build with: docker build -t aarvasa-web .
#
# No secret is baked in: DATABASE_URL, AUTH_SECRET and the other runtime
# settings arrive as environment variables from Secrets Manager at task start.
# NEXT_PUBLIC_* values are compiled into the client bundle, so they are build
# arguments; the Maps browser key is referrer-restricted and public by design.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npx next build

FROM node:24-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/* && useradd --system --uid 1001 nextjs
COPY --from=build --chown=nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
