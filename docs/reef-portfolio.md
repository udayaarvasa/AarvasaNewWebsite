# REEF portfolio — sources, tours and search

Status as of 20 October 2026. Developer/partner request: `docs/reef-developer-request.md`. Companion to `docs/reef-3d-validation.md` (3D
reconstructions). Reference files (renders, tour pages) are kept in the
gitignored `research/sources/`; this document records only URLs, facts and
hashes.

## 1. Source register — REEF 999 and REEF 1000

Accessed 20 Oct 2026. "Official" = REEF Luxury Developments or its channel-partner
portal. Secondary sources are listed only where they conflict with or add to the
official record; none of their figures is published on aarvasa.com.

### REEF 999 (Al Furjan)

| Fact | Value used | Source | Confidence |
| --- | --- | --- | --- |
| Location | Al Furjan, Dubai | reefdevelopments.ae/projects/reef-999 | High |
| Map pin | 25.0180659, 55.1333461 (Google place "REEF 999") | maps.app.goo.gl/Yj2sbEwcfhZcet537, linked from the project page | Medium — a place pin, not a plot |
| Residences | 142 | project page; launch release (Zawya) | High |
| Mix | 108 × 1BR, 20 × 2BR, 4 × 3BR, 10 villas | launch release | High (not shown on site as counts) |
| Sizes | 1BR 792–917, 2BR 1,338–1,876, 3BR 2,022–2,636, 4BR Sky Villa 3,424–3,695 sq.ft | project page | High |
| Starting price | AED 1,158,334 | reefdevelopments.ae/en/reef-999 (campaign page) | High; release says "from AED 1,158,000" |
| Payment plan | "60% - 40%" (no milestones) | campaign page | Low detail — not shown as a plan |
| Completion | **Q2 2027** | project page and projects directory | Conflict: launch release Q1 2027; portals June 2027 / Q4 2027 |
| Amenities | Kids pool, BBQ, shaded seating, tennis & padel, yoga, kids' play, outdoor cinema, vegetable garden; retail mall; winter gardens | project page | High |
| Nearby (min) | Metro 5, Arbor School 5, Medcare 5, Ibn Battuta Mall 10, Dubai Marina 15, Al Maktoum Airport 15 | campaign page | Developer's estimates |
| Building form | Not stated by developer | Portals: "two 12-storey towers on a shared podium" | Not published |
| Value | AED 300 m project | launch release headline | Not published |

Conflicts recorded: completion (Q1 vs Q2 2027 — the current official page is
used); the campaign page's image alt text and filenames say "REEF 998" (a
developer copy error; ignored).

### REEF 1000 (Dubai Land Residence Complex)

| Fact | Value used | Source | Confidence |
| --- | --- | --- | --- |
| Location | DLRC, Dubailand; off E311 and E66; community ~14 m sq.ft | reefdevelopments.ae/projects/reef-1000 | High |
| Map pin | 25.0862283, 55.3800196 (Google place "REEF 1000") | maps.app.goo.gl/yoJBXGT4oTqXhwNy6 | Medium — place pin |
| Residences | 125 | project page | High |
| Sizes | Studio 437–488, 1BR 752–1,066, 2BR 1,152–1,370, 2BR Duplex 1,653–1,905 sq.ft | project page | High |
| Completion | Q4 2026 | project page; directory | High (portals agree) |
| Price | **Not published** | — | Portals: ~AED 620,000 (secondary, not used) |
| Payment plan | Not published | — | Portals conflict: 20/40/40 vs 60/40 |
| Floors | Not stated by developer | Channel-partner tour: residential floor picker 1–7; portal (Binayah): "G+6" | Unresolved — not published |
| Amenities | Vegetable garden, running track, cricket pitch, outdoor gym, Baja shelf, BBQ, sunken seating | project page | High |

### Images — reuse status

| Asset | URL | SHA-256 (first 16) | Reuse |
| --- | --- | --- | --- |
| REEF 999 hero (night) | reefdevelopments.ae/images/latest-projects/reef-999.jpg | 13e67da925c76096 | Research only — no licence |
| REEF 999 mobile hero | reefdevelopments.ae/images/projects/999-REEF-mob.jpg | 09c3e59d00afe36c | Research only |
| REEF 999 cover (dusk) | cdn.reefdevelopments.ae/image/2025/08/27/999_Cover_1756309641_e37d3cb8.jpg | (in research/) | Research only |
| REEF 999 gallery (unit + amenity renders, 28 files) | cdn.reefdevelopments.ae/image/2025/08/27/999_* and 988_Amenities_* | — | Not downloaded |
| REEF 1000 hero | reefdevelopments.ae/images/latest-projects/reef-1000.jpg | a45c5d9c7fd95317 | Research only |
| REEF 1000 front elevation render | reefchannelpartners.com/vr/vr1000/images/lastbg.jpg | 00052fe918a998e8 | Research only — 3D reference |
| REEF 1000 rear aerial render | reefchannelpartners.com/vr/vr1000/images/lastbgb.jpg | 832e0fcc699fcd75 | Research only — 3D reference |

Update 30 Oct 2026: the owner confirmed all REEF projects are cleared for image
use, so the hero, cover and elevation renders above are published (crops in
`public/images/reef-999`, `reef-1000`). File the written reference in
`IMAGERY_PERMISSION` (`src/lib/projects.ts`). 360° tours and films are not covered.

## 2. Immersive media catalogue

Earlier research recorded "no genuine 360° source for any REEF project". That
was wrong: REEF's channel-partner portal hosts **genuine 360° panoramas**
(3DVista, cube-map) for four of the five buildings. They are computer-generated
renders, not photographs, and must be labelled so.

| Project | Tour URL | Panoramas (re-verified 20 Oct) | By label | Format | Rights |
| --- | --- | --- | --- | --- | --- |
| REEF 996 | reefchannelpartners.com/vr/996/ | 67 | 21 unit-type views, 10 bathrooms, 5 bedrooms, 5 living/entrance/corridor, 5 lobby, 21 numbered (content unlabelled) | 3DVista cube-map | Unconfirmed |
| REEF 997 | reefchannelpartners.com/vr/997/ | 108 | 41 entrance/living/dining/kitchen, 17 balcony/terrace, 17 amenity (vegetable garden, Baja shelf, outdoor cinema, BBQ, cabana), 15 bathrooms, 14 bedrooms, 1 lift, 3 other | cube-map, faces to 6144 px, WebP | Unconfirmed |
| REEF 998 | reefchannelpartners.com/vr/998/ | 140 | 53 "CAMxx" camera views and 38 numbered views (content unlabelled), 20 amenity (Baja shelf, yoga, BBQ, aqua bikes), 17 unit types, 6 balcony, 5 bathroom, 1 lobby | cube-map, faces to 6144 px, JPEG | Unconfirmed |
| REEF 999 | none found (vr/999 → 404) | 0 | — | — | — |
| REEF 1000 | reefchannelpartners.com/vr/vr1000/ | 10 amenity scenes (all load) + unit tours from an interactive elevation | lobby, co-working, parking, hallway, gym, yoga, locker room, roof, guesthouse, pool | cube-map | Unconfirmed |

The earlier figure of 88 for REEF 996 counted duplicate internal ids; 67 is the
number of panorama objects in the tour definition.

Conventional (flat) video: the developer's YouTube channel
(youtube.com/@ReefLuxuryDevelopments) and the films already held locally
(`research/manifest-videos.jsonl`) — 16:9/9:16, none spherical. These may
appear only as labelled video chapters, and only with permission.

Nothing above is downloaded, rehosted or linked from aarvasa.com. To publish
any of it Aarvasa needs, per project, written confirmation of: hosting on
Aarvasa's CDN (or permission to embed/link the developer-hosted tour),
public commercial display, conversion to web formats, and the credit line.
With permission, the fastest route is the existing tour player
(`src/components/property/immersive-tour.tsx`) fed by the equirectangular renders
the developer's tours were built from (3DVista tours are normally authored
from equirectangular sources), which avoids reassembling cube faces.

### Scene inventory per property (target)

| Scene (tour chapter) | 996 | 997 | 998 | 999 | 1000 |
| --- | --- | --- | --- | --- | --- |
| Exterior / arrival | need | need | unconfirmed (CAMxx views) | need | need |
| Lobby / common areas | **source** (5) | **source** (lift, entrances) | **source** (1) | need | **source** (lobby, hallway) |
| Residence interiors | **source** (41) | **source** (70+) | **source** (22+) | need | **source** (unit tours) |
| Balcony / winter garden | need | **source** (17) | **source** (6) | need | need |
| Pool / amenities | need | **source** (17) | **source** (20) | need | **source** (pool, gym, yoga, locker room) |
| Rooftop | need | need | need | need | **source** (roof) |
| Retail / communal | n/a | n/a | need | need | **source** (co-working, guesthouse) |

"need" = no 360° source found; the developer request lists them.

## 3. Search — keyword map

No keyword tool or Search Console data was available, so the clusters below are
research assumptions from how the developer and portals name each project — not
measured volumes. Each cluster maps to one canonical page.

| Cluster (examples) | Canonical page |
| --- | --- |
| reef 996, reef 996 dubai production city, reef 996 impz, reef 996 price | /projects/reef-996-dubai-production-city |
| reef 997, reef 997 dubai islands, reef 997 apartments | /projects/reef-997-dubai-islands |
| reef 998, reef 998 dlrc, reef 998 dubailand, reef 998 3d | /projects/reef-998-dlrc |
| reef 999, reef 999 al furjan, reef 999 sky villa, reef 999 payment plan | /projects/reef-999-al-furjan |
| reef 1000, reef 1000 dlrc, reef 1000 duplex, reef 1000 handover | /projects/reef-1000-dlrc |
| reef luxury developments projects, reef sunken balcony, reef developments dubai | /reef |
| aaradhyam pearl, plots badwai bhopal, plots karond bypass | /projects/aaradhyam-pearl-badwai-bhopal |
| aaradhyam prime, plots jatkhedi, plots hoshangabad road bhopal | /projects/aaradhyam-prime-jatkhedi-bhopal |
| off-plan apartments dubai, residential plots bhopal | /listings (category intent; only if the published portfolio genuinely answers it) |

Broad terms ("real estate", "property dubai") are not targeted: the site cannot
answer them better than portals, and ranking first for them is not a goal.

## 4. Measurement — owner action needed

Neither Google Search Console nor analytics is configured: there is no
verification meta tag, no DNS TXT verification record (only the mail SPF
record) and no analytics script. No baseline exists, and none is invented here.

To create one (domain owner, ~15 minutes):

1. search.google.com/search-console → Add property → **Domain** → `aarvasa.com`.
2. Add the TXT record it shows at the DNS host (Hostinger), wait for verification.
3. Sitemaps → submit `https://www.aarvasa.com/sitemap.xml` (live after the next release).
4. URL Inspection → request indexing for the five REEF pages and `/reef`.
5. After 28 days, record impressions, clicks, top queries, and the Pages report
   (indexed / not indexed and why). That is the baseline.

Apex redirect: `https://aarvasa.com/* → https://www.aarvasa.com/*` was a
**302**; on 20 Oct 2026 the Amplify custom rule was changed to **301** (paths and
query strings preserved), so search engines consolidate on www.

Success measures: impressions and clicks on the project clusters above, the
share of queries that name a REEF building, and qualified enquiries from
`/contact?project=…` — not a position for a broad phrase.

## 5. 90-day content plan

Original information only; each item needs a fact the site can source.

| Weeks | Item | Depends on |
| --- | --- | --- |
| 1–2 | Release REEF 999/1000 pages, sitemap, canonicals; verify Search Console | Approval of this preview |
| 1–4 | REEF 1000 handover guide (Q4 2026): what buyers receive, snagging, DLD steps | Developer handover notice |
| 3–6 | "The REEF sunken balcony and winter garden, explained" — how the cooling works, per building | Developer technical sheet |
| 3–8 | Location guides where a REEF building sits: Al Furjan, DLRC, Dubai Production City, Dubai Islands — transport, schools, what is built vs planned | Own research; cite sources |
| 5–8 | REEF 996–1000 side-by-side: sizes, completion, starting prices (only published ones) | Current inventory sheet |
| 6–10 | 360° tours on the REEF pages | Developer permission (section 2) |
| 8–12 | Bhopal plot buyer's guide: T&CP/Nagar Nigam approvals, registry costs, Badwai vs Jatkhedi | Aaradhyam documents |
| 12 | Review Search Console: which clusters earn impressions; refresh copy for those that do not | 28+ days of data |

Thin pages (one per keyword variant, auto-generated area pages) are out of scope.
