/**
 * The media CDN the viewer may load from in this build, or null. Shared by the
 * server-side project mapping (which builds URLs) and the in-browser engine
 * (which checks them), so the two can never disagree.
 *
 * Development builds use the DEV media CDN (AarvasaMediaDev-Storage output
 * `MediaCdnOrigin`). Production has no media origin yet. The comparison is
 * folded at build time, so production bundles contain no CDN hostname at all.
 */
export const MEDIA_CDN_ORIGIN: string | null =
  process.env.NODE_ENV === "production" ? null : "https://d1l4p1pty829ds.cloudfront.net";

/**
 * Where an approved, public building model (`hosting: "site"`) is served from.
 *
 * Production: the dedicated production model CDN (AarvasaModelsProd-Delivery
 * output `ModelsCdnOrigin`). It holds only models whose public release is
 * recorded in PUBLIC_MODEL_APPROVALS, and it answers CORS for the production
 * site origins only — which Google's 3D model loader requires.
 *
 * Kept separate from MEDIA_CDN_ORIGIN on purpose: that switch turns on the
 * database-backed media pipeline, which production does not have. Development
 * builds keep serving these models from /media on the same origin (the files
 * are gitignored there and never committed).
 */
export const PROD_PUBLIC_MODEL_ORIGIN = "https://doddmim7wttd0.cloudfront.net";

export const PUBLIC_MODEL_ORIGIN: string =
  process.env.NODE_ENV === "production" ? PROD_PUBLIC_MODEL_ORIGIN : "/media";
