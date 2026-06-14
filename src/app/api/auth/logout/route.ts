import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  let cookieStore: any;
  try {
    cookieStore = await cookies();
  } catch {
    cookieStore = cookies();
  }

  const cookiesToDelete = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Secure-authjs.csrf-token"
  ];

  // 1. Delete cookies from the async cookie store
  for (const cookieName of cookiesToDelete) {
    try {
      cookieStore.delete(cookieName);
    } catch (e) {
      // Ignore errors if delete fails
    }
  }

  // 2. Build redirect response pointing to home page
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const response = NextResponse.redirect(new URL("/", baseUrl));

  // 3. Force expire the cookies in the response headers to be absolutely sure
  cookiesToDelete.forEach(name => {
    response.cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      secure: true,
      httpOnly: true
    });
    response.cookies.set(name, "", {
      path: "/",
      expires: new Date(0),
      maxAge: 0,
      secure: false,
      httpOnly: true
    });
  });

  // 4. Prevent caching of this API response
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}
