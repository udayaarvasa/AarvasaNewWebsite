import { auth } from "@/auth"
import { NextResponse } from "next/server"

const protectedRoutes = [
  "/dashboard", 
  "/profile", 
  "/agents", 
  "/admin", 
  "/property/manage",
  "/properties/create",
  "/properties/edit"
]

// Routes only accessible by specific roles
const roleRoutes: Record<string, string[]> = {
  "/admin": ["ADMIN"],
}

/** Every response this proxy produces may carry the visitor's refreshed session
 *  cookie, so none of them may be stored by a shared cache. */
const privateResponse = (res: NextResponse) => {
  res.headers.set("Cache-Control", "private, no-store")
  return res
}

export const proxy = auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const userRole = (req.auth?.user as any)?.role || "USER"
  
  const isProtectedRoute = protectedRoutes.some((route) => 
    nextUrl.pathname.startsWith(route)
  )

  if (isProtectedRoute && !isLoggedIn) {
    let callbackUrl = nextUrl.pathname
    if (nextUrl.search) {
      callbackUrl += nextUrl.search
    }

    const encodedCallbackUrl = encodeURIComponent(callbackUrl)

    return privateResponse(NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    ))
  }

  // Check role-based access
  for (const [route, allowedRoles] of Object.entries(roleRoutes)) {
    if (nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)) {
      if (!allowedRoles.includes(userRole)) {
        return privateResponse(NextResponse.redirect(new URL("/dashboard", nextUrl.origin)))
      }
    }
  }

  return privateResponse(NextResponse.next())
})

/*
 * Runs ONLY on the signed-in areas — never on public pages.
 *
 * Auth.js appends the visitor's refreshed session cookie to every response the
 * proxy handles. Public pages are cached by CloudFront for a year with a cache
 * key that ignores cookies, so a signed-in visitor's page response, Set-Cookie
 * included, was replayed to everyone after them: they were signed in as that
 * person. Public pages need no session on the server (the navbar reads it from
 * /api/auth/session, which is never cached), so they are not matched at all.
 *
 * /login and /signup redirect signed-in visitors themselves, server-side.
 */
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/admin/:path*",
    "/profile/:path*",
    "/property/manage/:path*",
    "/properties/create",
    "/properties/edit/:path*",
  ],
}
