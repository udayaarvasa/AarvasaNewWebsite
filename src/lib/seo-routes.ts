import { publishedProjects } from "./projects";
import { SITE_URL, absoluteUrl } from "./site";

/**
 * What crawlers are told: the sitemap's URLs and robots.txt's rules. Kept free
 * of Next.js imports so the rules can be tested directly; src/app/sitemap.ts
 * and src/app/robots.ts only wrap these.
 */

/** Disallowed in robots.txt as well as marked noindex on the page, so a
 *  crawler that ignores one still meets the other. */
export const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/media-studio",
  "/labs",
  "/dashboard",
  "/properties/create",
  "/properties/edit",
] as const;

/**
 * Indexable public pages. Excluded on purpose: account, admin, studio, lab and
 * API routes; pages marked noindex (blockchain, agents, sign-in); and
 * database-backed /property/{id} listings, which are owner-submitted and not
 * enumerated at build time.
 */
export const STATIC_PUBLIC_PATHS = [
  "/",
  "/listings",
  "/reef",
  "/compare",
  "/ai-chat",
  "/services",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/refund",
  "/security",
] as const;

/**
 * Rebuilt from the project records on every build, so a project appears here
 * exactly when its page is published. No lastModified: the site has no
 * per-page modification date, and stamping the build time would claim every
 * page changed on every deploy.
 */
export function sitemapEntries(): { url: string }[] {
  return [
    ...STATIC_PUBLIC_PATHS.map((path) => ({ url: absoluteUrl(path) })),
    ...publishedProjects().map((p) => ({ url: absoluteUrl(`/projects/${p.slug}`) })),
  ];
}

export function robotsRules(): { rules: { userAgent: string; allow: string; disallow: string[] }; sitemap: string } {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
