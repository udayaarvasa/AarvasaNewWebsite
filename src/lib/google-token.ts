import { createRemoteJWKSet, jwtVerify } from "jose"

/**
 * Verification of Google ID tokens for native sign-in.
 *
 * The token must be checked server-side against Google's published signing
 * keys. Decoding it in the client and posting the email is not authentication:
 * anyone can post any email. (The previous Elastic Beanstalk build did exactly
 * that, which is why this exists.)
 */

// Google rotates these keys; createRemoteJWKSet caches and refetches as needed.
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
)

// Google issues tokens under both spellings.
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

export type GoogleIdentity = {
  email: string
  name: string | null
  picture: string | null
  sub: string
}

/**
 * The audience is whichever OAuth client requested the token. Android native
 * sign-in asks for the *web* client id as its serverClientId, so that one is
 * the default; GOOGLE_MOBILE_CLIENT_IDS can list extras, comma separated.
 */
function allowedAudiences(): string[] {
  const extra = (process.env.GOOGLE_MOBILE_CLIENT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const web = process.env.AUTH_GOOGLE_ID?.trim()
  const all = web ? [web, ...extra] : extra
  return Array.from(new Set(all))
}

/**
 * Returns the verified identity, or null if the token is not a currently valid
 * Google token for one of our clients. Callers should treat null as a plain
 * rejection and not reveal which check failed.
 */
export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleIdentity | null> {
  const audience = allowedAudiences()
  if (audience.length === 0) {
    console.error("[google-token] No AUTH_GOOGLE_ID / GOOGLE_MOBILE_CLIENT_IDS configured")
    return null
  }

  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience,
    })

    const email = typeof payload.email === "string" ? payload.email : null
    // An unverified address would let someone claim an account they do not own.
    if (!email || payload.email_verified !== true) return null
    if (typeof payload.sub !== "string") return null

    return {
      email: email.toLowerCase(),
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
      sub: payload.sub,
    }
  } catch {
    return null
  }
}
