import type { NextConfig } from "next";

/**
 * Security response headers.
 *
 * The application previously returned none of these — no HSTS, no nosniff, no
 * framing policy — and advertised its framework through X-Powered-By.
 *
 * A note on Strict-Transport-Security and `includeSubDomains`: this directive
 * forces HTTPS on *every* subdomain of the serving domain, and browsers cache
 * it for the full max-age, so a subdomain still served over plain HTTP becomes
 * unreachable and cannot be quickly undone. That is a production DNS fact which
 * cannot be verified from a development checkout — confirm every subdomain
 * terminates TLS before this reaches production. Drop `; includeSubDomains`
 * from the value below if any does not. The header is emitted only in
 * production; browsers ignore it over plain HTTP in any case.
 *
 * No full Content-Security-Policy is set here. Next.js injects inline bootstrap
 * scripts, and the app loads Google Fonts and remote images, so a policy strict
 * enough to be worth having needs to be built against a report-only rollout
 * with real traffic. Shipping a guessed CSP would risk breaking the application,
 * which the brief explicitly rules out. Framing is covered by X-Frame-Options
 * below; `frame-ancestors` should be added when that CSP work happens.
 */
const securityHeaders = [
  // Block MIME-type sniffing, so a user-uploaded file cannot be re-interpreted
  // as script by a browser guessing at its type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking protection. SAMEORIGIN rather than DENY so the app can still
  // embed its own pages (the media preview surfaces rely on that).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Do not leak full URLs (which carry ids and query filters) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app requests none of these; deny by default.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Framework and version disclosure serves no one but an attacker fingerprinting
  // the stack for known advisories.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "ui-avatars.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    // Applies to pages and API routes alike: an API response can be framed or
    // sniffed just as a document can.
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
