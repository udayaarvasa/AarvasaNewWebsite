import type { MetadataRoute } from "next";
import { robotsRules } from "@/lib/seo-routes";

/** Every public page may be crawled; private surfaces are disallowed (src/lib/seo-routes.ts). */
export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
