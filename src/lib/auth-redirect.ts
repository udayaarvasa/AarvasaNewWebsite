export function getAuthRedirect(callbackUrl: string | string[] | undefined): string {
  if (typeof callbackUrl !== "string" || !callbackUrl.startsWith("/")) return "/dashboard";

  const origin = "https://aarvasa.com";
  try {
    const url = new URL(callbackUrl, origin);
    if (url.origin === origin && !url.pathname.startsWith("//") && !["/login", "/signup"].includes(url.pathname.replace(/\/+$/, ""))) {
      return url.href.slice(origin.length);
    }
  } catch {
    // Use the dashboard when the requested destination cannot be parsed.
  }
  return "/dashboard";
}
