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

    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodedCallbackUrl}`, nextUrl)
    )
  }

  // Check role-based access
  for (const [route, allowedRoles] of Object.entries(roleRoutes)) {
    if (nextUrl.pathname === route || nextUrl.pathname.startsWith(`${route}/`)) {
      if (!allowedRoles.includes(userRole)) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl.origin))
      }
    }
  }

  // Prevent logged-in users from accessing login/signup
  const isAuthRoute = nextUrl.pathname === "/login" || nextUrl.pathname === "/signup"
  
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
