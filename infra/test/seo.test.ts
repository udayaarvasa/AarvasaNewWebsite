/**
 * Search foundation: what crawlers are told, and that the copy written for each
 * project page states only what its record states.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { projects, publishedProjects } from "../../src/lib/projects";
import { PROJECT_SEO } from "../../src/lib/project-seo";
import { projectBreadcrumbs, projectJsonLd, siteJsonLd, jsonLdScript } from "../../src/lib/project-structured-data";
import { SITE_URL } from "../../src/lib/site";
import { PRIVATE_PATHS, STATIC_PUBLIC_PATHS, robotsRules, sitemapEntries } from "../../src/lib/seo-routes";

const fmt = (n: number) => n.toLocaleString("en-US");

test("the canonical origin is the public www host", () => {
  assert.equal(SITE_URL, "https://www.aarvasa.com");
});

test("the sitemap lists every published project page and nothing private", () => {
  const urls = sitemapEntries().map((e) => e.url);
  for (const p of publishedProjects()) assert.ok(urls.includes(`${SITE_URL}/projects/${p.slug}`), p.slug);
  for (const p of projects.filter((x) => !x.published)) assert.ok(!urls.some((u) => u.endsWith(p.slug)), p.slug);
  assert.ok(urls.every((u) => u.startsWith(`${SITE_URL}/`)), "absolute, on www");
  assert.equal(new Set(urls).size, urls.length, "no duplicates");
  for (const priv of [...PRIVATE_PATHS, "/blockchain", "/login", "/signup", "/agents", "/property/"]) {
    assert.ok(!urls.some((u) => new URL(u).pathname.startsWith(priv)), `${priv} must not be in the sitemap`);
  }
  assert.ok(STATIC_PUBLIC_PATHS.includes("/reef"));
  assert.ok(sitemapEntries().every((e) => !("lastModified" in e)), "no invented modification dates");
});

test("robots.txt points at the sitemap and keeps private surfaces out", () => {
  const r = robotsRules();
  assert.equal(r.sitemap, `${SITE_URL}/sitemap.xml`);
  assert.equal(r.rules.allow, "/");
  for (const p of ["/api/", "/admin", "/media-studio", "/labs", "/dashboard"]) assert.ok(r.rules.disallow.includes(p), p);
});

test("every published project has its own title, description and introduction", () => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const p of publishedProjects()) {
    const seo = PROJECT_SEO[p.slug];
    assert.ok(seo, `${p.slug} has no SEO copy`);
    assert.ok(seo.title.startsWith(p.name), `${p.slug}: the title leads with the project name`);
    assert.ok(seo.title.length + " | Aarvasa".length <= 70, `${p.slug}: title too long`);
    assert.ok(seo.description.length >= 110 && seo.description.length <= 200, `${p.slug}: description ${seo.description.length} chars`);
    assert.ok(seo.intro.length > 0);
    titles.add(seo.title);
    descriptions.add(seo.description);
  }
  assert.equal(titles.size, publishedProjects().length, "titles are unique");
  assert.equal(descriptions.size, publishedProjects().length, "descriptions are unique");
});

test("the copy repeats the record's figures and invents none", () => {
  for (const p of publishedProjects()) {
    const seo = PROJECT_SEO[p.slug];
    const text = [seo.description, ...seo.intro].join(" ");
    // Any AED amount stated must be the record's starting price.
    for (const m of text.matchAll(/AED (\d{1,3}(?:,\d{3})*)/g)) {
      assert.equal(m[1], fmt(p.fromPrice), `${p.slug}: AED ${m[1]} is not the record's price`);
    }
    if (p.fromPrice === 0 && !p.ratePerSqft) assert.match(text, /on request|on enquiry/i, `${p.slug}: unpriced projects say so`);
    // A stated size range must be the record's range.
    for (const m of text.matchAll(/([\d,]{3,5})(?:–| to )([\d,]{3,5}) sq\.ft/g)) {
      assert.deepEqual([m[1], m[2]], [fmt(p.minSqft), fmt(p.maxSqft)], `${p.slug}: size range`);
    }
    if (p.totalUnits) {
      for (const m of text.matchAll(/(\d+)[- ]residence/g)) assert.equal(Number(m[1]), p.totalUnits, `${p.slug}: unit count`);
    }
    if (p.completion) {
      for (const m of text.matchAll(/(?:completion is scheduled for|completing|Completion) (Q\d \d{4}|[A-Z][a-z]+ \d{4})/g)) {
        assert.equal(m[1], p.completion, `${p.slug}: completion`);
      }
    }
  }
});

test("structured data makes no offer, rating or exact-position claim", () => {
  for (const p of publishedProjects()) {
    const json = JSON.stringify(projectJsonLd(p));
    for (const banned of ["Offer", "offers", "price", "aggregateRating", "review", "geo", "latitude"]) {
      assert.ok(!json.includes(`"${banned}`), `${p.slug}: structured data must not carry ${banned}`);
    }
    const [place, crumbs] = projectJsonLd(p) as [Record<string, unknown>, { itemListElement: { item: string }[] }];
    assert.equal(place.url, `${SITE_URL}/projects/${p.slug}`);
    assert.equal(crumbs.itemListElement.at(-1)?.item, `${SITE_URL}/projects/${p.slug}`);
  }
  assert.deepEqual(projectBreadcrumbs(publishedProjects().find((p) => p.slug === "reef-999-al-furjan")!).map((c) => c.path), ["/", "/reef", "/projects/reef-999-al-furjan"]);
  assert.ok(!JSON.stringify(siteJsonLd()).includes("SearchAction"));
  assert.ok(!jsonLdScript({ a: "</script><b>" }).includes("</script>"), "script-safe");
});
