# REEF immersive status

Where each REEF project stands for the two experiences on a property page —
**Explore property** (the building, in the PlayCanvas viewer) and **Explore
area** (its surroundings, on Google's photorealistic 3D map) — and what each one
is waiting for.

Evaluated individually. The REEF 996 reconstruction method is not assumed to
transfer: it worked because that project has an elevation render, an aerial and a
stated building configuration, and most of the others have none of those.

## Coordinates

**No REEF project has verified coordinates.** Searched: `reef-projects.ts`,
`prisma/reef-projects.json`, `projects.ts`, every `.ts`/`.tsx`/`.json` in the
repository for latitude-shaped fields, and the supplied source archives
(`OneDrive_2026-09-20*.zip`, 85 mp4 and 6 mov files) for container location tags.

| Project | Record | Coordinates | Source |
| --- | --- | --- | --- |
| REEF 996 | yes | **none** | — |
| REEF 997 | yes | **none** | — |
| REEF 998 | yes | **none** | — |
| REEF 999 | **no record** | **none** | — |
| REEF 1000 | **no record** | **none** | — |

The only verified pair anywhere in the product is Aaradhyam Prime
(23.17633, 77.4694), in Bhopal.

None was inferred from a city or locality name. "Dubai Islands" narrows a
building to several square kilometres, and a pin dropped in the middle of that is
a statement about where somebody's home is that nobody has checked. Explore Area
therefore stays unavailable for all five, and the page says the location has not
been verified rather than showing a map.

**To enable it:** add `coordinates: { lat, lng }` to the project's record in
`src/lib/projects.ts` — `reef-projects.ts` is generated, so attach there as the
imagery and media already are — taken from the developer's filing or a surveyed
address, not from a search box.

## Google 3D coverage

**Unknown for every project, and not knowable from here.** Coverage is
established by asking for the tiles: the component requests the 3D map and
watches for a settled render, falling back to the flat map when none arrives.
That check needs a key and a coordinate, and we have neither, so no coverage
result exists for any REEF project.

Dubai is well covered in general. That is not evidence about a specific plot, and
it is not recorded here as one.

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

### REEF 997

- **Explore property:** not attempted. Its imagery is amenity and interior
  frames — a pool deck, a terrace, a bedroom, a facade detail. There is no
  elevation, no aerial and no massing view, so there is no silhouette to measure
  and no stated floor count to corroborate it against. The 996 method needs both.
- **Explore area:** blocked on coordinates and a key.

### REEF 998

- **Explore property:** not attempted, for the same reason as 997 and more so —
  ten files across two categories, a pool facade and amenity shots.
- **Explore area:** blocked on coordinates and a key.

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
