import { SignJWT, jwtVerify } from "jose"

/**
 * Token auth for native clients (iOS/Android).
 *
 * The web app uses NextAuth's httpOnly cookie session, which a native app
 * cannot participate in (no browser redirect flow, no cookie jar). Native
 * clients instead exchange credentials for a signed access/refresh token pair
 * and send `Authorization: Bearer <accessToken>` on every request.
 *
 * Tokens are signed with the same AUTH_SECRET as NextAuth but carry a distinct
 * issuer/audience so a mobile token can never be mistaken for a session token
 * (and vice versa).
 */

const ISSUER = "aarvasa"
const AUDIENCE = "aarvasa-mobile"

export const ACCESS_TOKEN_MAX_AGE = 60 * 60 // 1 hour
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 60 // 60 days

function getSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("AUTH_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export type TokenType = "access" | "refresh"

export type MobileTokenClaims = {
  sub: string
  email: string | null
  name: string | null
  role: string
  typ: TokenType
}

export type MobileUser = {
  id: string
  email: string | null
  name: string | null
  role: string
}

async function sign(user: MobileUser, typ: TokenType, maxAge: number) {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    typ,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .sign(getSecret())
}

/** Issues the access + refresh pair returned to a native client on login. */
export async function issueTokens(user: MobileUser) {
  const [accessToken, refreshToken] = await Promise.all([
    sign(user, "access", ACCESS_TOKEN_MAX_AGE),
    sign(user, "refresh", REFRESH_TOKEN_MAX_AGE),
  ])

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer" as const,
    expiresIn: ACCESS_TOKEN_MAX_AGE,
  }
}

/**
 * Verifies a mobile token and asserts its type. Returns null on any failure
 * (bad signature, expired, wrong issuer/audience, wrong token type) so callers
 * can treat every rejection the same way.
 */
export async function verifyMobileToken(
  token: string,
  expected: TokenType
): Promise<MobileTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    if (payload.typ !== expected || typeof payload.sub !== "string") return null

    return {
      sub: payload.sub,
      email: (payload.email as string) ?? null,
      name: (payload.name as string) ?? null,
      role: (payload.role as string) ?? "USER",
      typ: expected,
    }
  } catch {
    return null
  }
}

/** Pulls the raw token out of an `Authorization: Bearer <token>` header. */
export function bearerFromRequest(req: Request): string | null {
  const header = req.headers.get("authorization")
  if (!header?.startsWith("Bearer ")) return null
  const token = header.slice(7).trim()
  return token.length > 0 ? token : null
}
