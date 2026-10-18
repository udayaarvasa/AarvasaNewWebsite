/**
 * The media feature gate.
 *
 * Media Studio, the upload/processing APIs and the admin media review need the
 * MediaAsset, Entitlement and Payment tables. Production does not have them
 * yet (verified 19 Oct 2026 with a read-only schema diff), so in a production
 * build these surfaces are off unless AARVASA_MEDIA_FEATURES=on is set —
 * which should happen only after that schema has been deliberately applied.
 *
 *   AARVASA_MEDIA_FEATURES=on   enabled anywhere
 *   AARVASA_MEDIA_FEATURES=off  disabled anywhere
 *   unset                       enabled in development, disabled in production
 *
 * Off means: pages 404, APIs answer 404 with a fixed JSON body, and the admin
 * Media tab is not offered. Never a 500 from a missing table.
 */
export function mediaFeaturesEnabled(
  env: { AARVASA_MEDIA_FEATURES?: string; NODE_ENV?: string } = process.env,
): boolean {
  const flag = env.AARVASA_MEDIA_FEATURES?.trim().toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return env.NODE_ENV !== "production";
}

/** The response a gated API returns while media features are off, or null when on. */
export function mediaFeaturesResponse(
  env: { AARVASA_MEDIA_FEATURES?: string; NODE_ENV?: string } = process.env,
): Response | null {
  if (mediaFeaturesEnabled(env)) return null;
  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
