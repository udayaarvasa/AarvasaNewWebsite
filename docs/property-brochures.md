# Property brochures — 10 November 2026

All seven published projects have a four-page Aarvasa PDF guide. Each includes
project imagery, overview, specifications, quoted pricing / unit configurations,
payment terms where recorded, highlights, location, layout drawing where
available, enquiry details and a clickable original developer-document link.

These are Aarvasa guides assembled from the existing website catalog, not new
editions of the developer's own brochure. Original developer PDFs remain
separate links. Missing figures are not estimated. Prices are a catalog
snapshot and must be confirmed for a selected unit.

The public manifest is `public/brochures/manifest.json`; the site uses it for
view/download links, page counts and file sizes. Each original PDF link was
opened and verified to return a PDF. Generated PDFs were checked for page count,
searchable text and links, and all 28 pages were rendered and visually reviewed.

Regeneration: export `publishedProjects()`, enrich with `PROJECT_SEO[slug]`, hero
path and gallery paths from `projectImageSrc()`, then run:

```text
python tools/generate-project-brochures.py CATALOG_JSON SOURCE_MAP_JSON PUBLIC_DIR FONT_DIR
```

Requires Pillow, ReportLab and pypdf; the font directory must contain
DejaVuSans.ttf and DejaVuSans-Bold.ttf. The export and source map used for this
release are retained in `aarvasa-app/research/brochures`.

Gallery paragraph captions were removed from thumbnails site-wide. Captions are
available beneath an opened full-screen image. Prime's captions were shortened
to brief scene names. Small image-origin labels and licensed photo credits remain.
