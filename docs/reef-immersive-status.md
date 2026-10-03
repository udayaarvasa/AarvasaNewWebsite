# REEF immersive status

Where each REEF project stands for the two experiences on a property page —
**Explore property** (the building, in the PlayCanvas viewer) and **Explore
area** (its surroundings, on Google's photorealistic 3D map) — and what each one
is waiting for.

Evaluated individually. The REEF 996 reconstruction method is not assumed to
transfer: it worked because that project has an elevation render, an aerial and a
stated building configuration, and most of the others have none of those.

## Coordinates

Candidate coordinates were supplied for the first three projects. Each was
checked rather than taken on trust: reverse-geocoded against OpenStreetMap, then
reconciled with the locality the project record already states.

| Project | Coordinate | Geocoder returned | Record says | Verdict |
| --- | --- | --- | --- | --- |
| REEF 996 | 25.03785, 55.20126 | مدينة دبي للإنتاج (Dubai Production City), Me'aisem 1 | Dubai Production City (IMPZ) | **match** — IMPZ is this zone's former name |
| REEF 997 | 25.28990, 55.30238 | جزر دبي (Dubai Islands), Palm Deira | Dubai Islands | **match** — Deira Islands was renamed Dubai Islands |
| REEF 998 | 25.10029, 55.37471 | وادي الصفا 5 (Wadi Al Safa 5) | Dubai Land Residence Complex (DLRC) | **consistent** — DLRC sits inside Wadi Al Safa 5, so the geocoder named the containing community |
| REEF 999 | — | — | no project record | none |
| REEF 1000 | — | — | no project record | none |

All three are recorded as **`locality` precision**, with their source, in
`REEF_COORDINATES` in `src/lib/projects.ts`.

That distinction decides what they may be used for. Landing in the right
community is enough to show somebody the surroundings, which is all Explore Area
claims. It is **not** enough to place a building model on the ground: a tower
dropped on a locality-accurate point lands on whatever is actually there, and
that would turn an approximation into a false statement about a plot. The
geographic model overlay therefore stays off until a surveyed position exists.

Replace these with the developer's filed position when it arrives, and set
`precision: "plot"` at the same time.

## Google 3D coverage

**Still unknown for every project.** Coverage is established by asking for the
tiles and watching for a settled render; that needs a browser API key, and none
is configured. Having coordinates removes one of the two blockers, not both.

## Source material per project

| Project | Curated imagery | Supplied clips | Elevation / aerial | Building config |
| --- | --- | --- | --- | --- |
| REEF 996 | 55 files, 6 categories | 22 | **yes** | `1B + G + 3P + 20` |
| REEF 997 | 19 files, 4 categories | 25 | no | none |
| REEF 998 | 10 files, 2 categories | 5 | no | none |
| REEF 999 | none | 8 | no | no record |
| REEF 1000 | none | 11 | no | no record |

## Per-project assessment

### REEF 996 — the reference implementation

- **Explore property:** working. A visual reconstruction (34,756 triangles,
  1.77 MB) travelled the real pipeline and renders in the viewer at reviewer-set
  cameras. Provenance `AARVASA_RECONSTRUCTION`, visibility `INTERNAL` — it is not
  on the public page, and releasing it is a separate deliberate operation.
- **Explore area:** blocked on coordinates and a key.
- **360:** the capability is proven; no genuine REEF panorama exists.

### REEF 997 — reconstruction not attempted

The imagery shows the **facade language** clearly and the **massing** not at all.

What the one architectural frame gives: heavily radiused corners, continuous
smooth balcony bands with a rounded white nosing, clear glass balustrades with a
white top rail, narrow full-height slot windows on the solid face, and a crown
of dark veined marble carrying the signage. A different building from 996 in
every one of those respects, which is itself worth knowing.

What is missing, and what each one would have been needed for:

| Missing | Needed for |
| --- | --- |
| An elevation or full-height view | The silhouette, and a countable floor rhythm |
| An aerial | Plan form, footprint proportion, podium relationship |
| A stated building configuration | Floor count to corroborate the render against (`buildingConfig` is null for 997) |

For 996 all three existed, and the 21 balcony ridges counted down the aerial
agreed with the developer's own `1B + G + 3P + 20`. That agreement is what made
the model defensible. Without any of the three, a 997 model would have an
invented height, an invented floor count and an invented footprint — a generic
rounded tower wearing 997's facade details, which is exactly what the recognition
gate exists to refuse.

### REEF 998 — reconstruction not attempted

Same shape of problem, from a single oblique sunset render. It shows an angular
stepped balcony profile with LED strips along the nosings, glass balustrades with
metal rails, bronze and champagne tones, dark glazing, and a pool terrace at the
base. No silhouette, no crown, no plan, and `buildingConfig` is null, so floor
count, height and footprint would all be invented.

Ten curated files across two categories is the thinnest set of the three.

### REEF 999 and REEF 1000

- **No project record exists.** They are named in the collection and carry no
  published specification, which is the treatment agreed earlier and is retained:
  no price, no unit mix, no completion date, because none has been sourced.
- Their supplied material is construction-update video. Measured against the
  coverage gate, that footage fails on parallax (`docs/reconstruction.md`), and
  it is not architectural reference material either — it documents progress, not
  form.
- **Explore property:** no.
- **Explore area:** no, and there is no record to attach coordinates to.

## What would change any of this

1. **Coordinates**, per project, from the developer. Unblocks Explore Area
   everywhere, subject to coverage.
2. **A browser API key** (`docs/google-maps.md`). Unblocks Explore Area and the
   nearby-places layer.
3. **An elevation or aerial render, plus a stated building configuration**, for
   997 or 998. That is what made 996 reconstructable, and it is the minimum for
   the same method to be trustworthy on another tower.
4. **An official GLB or glTF** from the developer for any project. That skips
   reconstruction entirely and carries provenance `OFFICIAL_MODEL`.
5. **A genuine equirectangular panorama** for any project. The 360 pipeline and
   viewer are built and proven; they are waiting on content, not code.
