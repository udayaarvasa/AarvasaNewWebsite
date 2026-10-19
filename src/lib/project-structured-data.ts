import type { Project } from "./project-types";
import { projectImageSrc } from "./project-types";
import { PROJECT_SEO } from "./project-seo";
import { SITE_NAME, absoluteUrl } from "./site";

/**
 * schema.org JSON-LD for a project page.
 *
 * Deliberately conservative. It describes the place and how the visitor
 * reached it, and nothing a search engine could show as an offer or a verdict:
 *  - no Offer/price: prices move with the inventory and some are "on request";
 *  - no geo: every coordinate is approximate (locality precision), and a
 *    structured geo point would be read as the building's exact position;
 *  - no rating or review of any kind.
 */
const COUNTRY_CODE: Readonly<Record<string, string>> = { UAE: "AE", India: "IN" };

/** The navigation path that actually leads to the page. REEF towers are reached
 *  from the REEF collection; everything else from the listings. */
export function projectBreadcrumbs(project: Project): { name: string; path: string }[] {
  const parent = project.developer === "REEF Luxury Developments"
    ? { name: "The REEF Collection", path: "/reef" }
    : { name: "Properties", path: "/listings" };
  return [{ name: "Home", path: "/" }, parent, { name: project.name, path: `/projects/${project.slug}` }];
}

export function projectJsonLd(project: Project): Record<string, unknown>[] {
  const url = absoluteUrl(`/projects/${project.slug}`);
  const seo = PROJECT_SEO[project.slug];
  const hero = project.imagery?.hero;
  const place: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": project.kind === "apartments" ? "ApartmentComplex" : "Place",
    "@id": `${url}#place`,
    name: project.name,
    url,
    ...(seo ? { description: seo.description } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: project.location,
      addressRegion: project.city,
      ...(COUNTRY_CODE[project.country] ? { addressCountry: COUNTRY_CODE[project.country] } : {}),
    },
    ...(project.kind === "apartments" && project.totalUnits
      ? { numberOfAccommodationUnits: { "@type": "QuantitativeValue", value: project.totalUnits } }
      : {}),
    ...(hero ? { image: absoluteUrl(projectImageSrc(hero, "16x9")) } : {}),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: projectBreadcrumbs(project).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.path),
    })),
  };
  return [place, breadcrumbs];
}

/** Organization and WebSite, for the home page. No SearchAction: the site has
 *  no URL-addressable search results page to point one at. */
export function siteJsonLd(): Record<string, unknown>[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${absoluteUrl("/")}#organization`,
      name: SITE_NAME,
      legalName: "Aarvasa Innovations Pvt. Ltd.",
      url: absoluteUrl("/"),
      logo: absoluteUrl("/icon.png"),
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${absoluteUrl("/")}#website`,
      name: SITE_NAME,
      url: absoluteUrl("/"),
      publisher: { "@id": `${absoluteUrl("/")}#organization` },
    },
  ];
}

/** Serialise for a <script type="application/ld+json">, escaping "<" so no
 *  record text can close the script element. */
export const jsonLdScript = (data: unknown): string => JSON.stringify(data).replace(/</g, "\\u003c");
