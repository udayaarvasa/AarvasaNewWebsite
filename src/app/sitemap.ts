import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/seo-routes";

/** Public, indexable pages — see src/lib/seo-routes.ts for what is excluded and why. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
