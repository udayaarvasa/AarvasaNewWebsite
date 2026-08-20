import { auth } from "@/auth"
import { bearerFromRequest, verifyMobileToken, type MobileUser } from "./mobile-auth"

/**
 * Resolves the caller for an API route, accepting either authentication scheme:
 *
 *   - web:    NextAuth httpOnly session cookie
 *   - native: `Authorization: Bearer <accessToken>` (see lib/mobile-auth)
 *
 * Route handlers should use this instead of calling `auth()` directly so that a
 * single implementation serves both clients. Returns null when unauthenticated.
 */
export async function getAuthUser(req?: Request): Promise<MobileUser | null> {
  // Bearer first: it's a pure signature check with no cookie/DB work, and a
  // native request will never carry a session cookie anyway.
  if (req) {
    const token = bearerFromRequest(req)
    if (token) {
      const claims = await verifyMobileToken(token, "access")
      if (!claims) return null
      return {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        role: claims.role,
      }
    }
  }

  const session = await auth()
  if (!session?.user?.id) return null

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: session.user.name ?? null,
    role: (session.user.role as string) ?? "USER",
  }
}

/** Convenience for admin-only routes. */
export async function getAdminUser(req?: Request): Promise<MobileUser | null> {
  const user = await getAuthUser(req)
  return user?.role === "ADMIN" ? user : null
}
