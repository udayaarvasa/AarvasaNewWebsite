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
