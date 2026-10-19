# REEF 3D reconstructions — sources, candidates and validation (19 Oct 2026)

Companion to `docs/reef-immersive-status.md`. The reference library itself is
private (`research/`, gitignored): developer imagery and films are not licensed
for republication, so only facts, URLs and hashes are recorded here.

## Sources found

| Project | Key source | What it established |
| --- | --- | --- |
| REEF 997 | reefdevelopments.ae/en/reef-997 hero (`cdn.reefdevelopments.ae/image/website/reef-997/997.webp`, 2268x1187) | Full-height three-quarter exterior: podium, two residential wings, connector with wave balconies, crown, rooftop boxes |
| REEF 997 | Developer brochure, 95 pp. (public PDF on Property Finder), pp. 3, 5, 13 | Two more full-height exteriors; a top-down aerial (plan form); "Building Configuration **G + 2P + 8**"; 63 units |
| REEF 998 | "Floor Plans" brochure, 34 pp. (public PDF), pp. 4, 9, 11, 14 | "Building Configuration **3B + G + 3P + 20**"; first-floor, roof and typical floor plans; 323 units |
| REEF 998 | reefdevelopments.ae/en/reef-998 (40 images) | Tower hero, amenity and unit-plan imagery |
| REEF 996 | `public/images/reef-996/architecture/*` (curated developer renders), official featured image | Balcony edge proportion, bay slots, S-curve bays |

Counts in the private library: 111 official images, 3 brochure PDFs (16 pages
rendered), 32 local developer films catalogued with duration/resolution/content.
No official GLB/glTF/CAD was found for any project.

## Candidates

All are Aarvasa visual reconstructions, not surveys or official models. Plans are
measured from developer imagery, floor counts are sourced, storey heights are
assumed. Files are staged only in the gitignored `media-pilot/.staging`; none is
on the production model CDN.

| Project | Generator | sha256 | Size | Triangles | Status |
| --- | --- | --- | --- | --- | --- |
| REEF 996 v2 | `tools/reef-996-massing-v2.py` | `9ea83ecf6f4a8504ac6240666581199c48c0f0866c51c59ffc76cf40c4042a7c` | 3,818,552 B | 69,556 | Review candidate |
| REEF 997 v1 | `tools/reef-997-massing.py` 1.0.0 | `05061b40be5e2d6fb7fcb70da24ee0451dd9d79aa0a8363841c0123fe10b9d1a` | 2,007,752 B | 52,388 | DRAFT candidate |
| REEF 998 v2 | `tools/reef-998-massing-v2.py` | `ee69f8401af04463fc39393e48b55be7cc65ec3bcd36403582e10504f8263ea3` | 958,796 B | 23,856 | Review candidate (v1 stays live) |
| REEF 998 v1 | `tools/reef-998-massing.py` | `0756752510fe54e4b41d325682bcb27461d68952df1f0de2dfa22fdea3958f7d` | 1,132,676 B | 28,290 | Published (unchanged, regenerates byte-identically) |

### REEF 996 v2 — what changed and why

Measured on the facade-detail render (floor pitch ~118 px):

- Solid balcony edge ~38% of the floor (~1.2 m with the slab) with a ~0.95 m
  glass rail above. v1 drew a 1.62 m solid parapet (~60% white), which made the
  facade read as uniform stripes and hid the wave.
- Bays separated by dark recessed slots; v1 had white piers standing proud,
  which read as a white grid.
- Each bay's edge is a smooth S-curve; v1 used hard stepped ramps.

Recognition gate (the six criteria v1 was scored on; judged in the PlayCanvas
viewer at its default framing):

| Criterion | v1 | v2 |
| --- | --- | --- |
| Slab silhouette / proportion | pass | pass |
| 20 floors of banding (sourced) | pass | pass |
| Bay frame reads as in the renders | pass (as a white frame) | pass (dark slots, as rendered) |
| Podium reads as three levels | pass | pass |
| Crown coherent with references | pass | pass |
| Balcony wave legible at default framing | **fail** | **marginal pass** — legible in the oblique default view, flattened square-on |
| **Result** | **4/6 FAIL** | **5/6 + 1 marginal** |

### REEF 997 v1 — draft

| Feature | Source | Confidence | Match |
| --- | --- | --- | --- |
| G + 2P + 8 | brochure p.5 (+ 8 bands counted on two renders) | high | yes |
| Plan form: north block, west wing, central stub | aerial p.13 | medium-high | yes |
| Plan scale ~39 x 38 m podium | aerial, vehicles as ruler (~16.5 px/m) | medium (+/-15%) | — |
| Podium: dark vertical slats, white rounded top edge, west entrance | hero, p.3, p.5 | high (form) | yes |
| Rounded white balcony bands, glass rails | hero, p.3 | high (form) | yes |
| Wave balconies on the connector face | hero | medium | partial (subtle) |
| Wing articulation: recessed connectors, vertical fin frames on narrow faces | hero, p.3 | — | **not reproduced** — the wings merge into one banded mass |
| Crown: dark band with signage only on parts of the roofline | hero | — | partial (band runs all round) |
| Storey heights 5.0 / 4.0 / 3.3 m | — | assumed | — |

Result: about 4 of 6. Kept as a **draft**. Resolving the wing articulation needs
a side/rear elevation or the developer's elevation drawings.

### REEF 998 v2 — evidence-based corrections to v1

- 20 residential floors (brochure "3B + G + 3P + 20"), not 25 (v1 counted 25
  render ridges, but other strips counted 29, 40 and 41).
- Plan ~65 x 19.5 m from the typical floor layout, scaled by unit areas (studio
  module ~3.8 x 7.7 m for ~29 m2 -> ~23.5 px/m), instead of an assumed 54 x 24.
- East end chamfered ~5 m (floor and roof plans).
- Ground level added under the three podium ribbons (G + 3P).
- Height 85.1 m to the crown top (v1 96.6 m).

The validated v1 remains the published model and its map placement is unchanged.

## 360° / tours

- No genuine equirectangular photo, 360° video or panorama render exists in any
  local or official source. All 32 films are flat (31 portrait 9:16, one
  landscape 16:9); none carries spherical metadata. The "REEF 996 – 1st Gamified
  VR Walkthrough" is a 1080x1920 screen recording.
- The massing models are exterior-only and too coarse to render a credible
  panorama; no interior is rendered from them.
- Film chapters exist per property (exterior, lobby, residences, amenities, pool,
  penthouse, retail for 998), but publication rights are not established and the
  film tour depends on the media database that production does not have.

## Placement

No plot-precision coordinate was found. REEF 997's brochure p.9 marks the plot
on a schematic island plan, not a georeferenced map. REEF 998's overlay stays as
approved (approximate, labelled). REEF 996 and 997 show no map overlay.
