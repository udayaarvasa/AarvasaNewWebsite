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
| REEF 996 v3 | `tools/reef-996-massing-v3.py` | `32f29c26d09283b51dcee881e5b4fb841b2c80d51abb601cb26ad101cfb0d096` | 3,633,076 B | 69,556 | Reference variant (v2 geometry, smoothed normals) |
| REEF 997 v1.0.0 | `tools/reef-997-massing.py` @ d2f790c | `05061b40be5e2d6fb7fcb70da24ee0451dd9d79aa0a8363841c0123fe10b9d1a` | 2,007,752 B | 52,388 | Superseded draft (reproducible) |
| REEF 997 v1.1 | `tools/reef-997-massing.py` 1.1.0 | `3ec2651523f35f1b45e1f80fa52e1dae5b7b1fa4bb0d037c5e8030fef70fc482` | 2,560,520 B | 69,340 | DRAFT candidate |
| REEF 998 v2 | `tools/reef-998-massing-v2.py` | `ee69f8401af04463fc39393e48b55be7cc65ec3bcd36403582e10504f8263ea3` | 958,796 B | 23,856 | Superseded by v3 |
| REEF 998 v3 | `tools/reef-998-massing-v3.py` | `589b15693f0a2ef6db8a416dea3a2043b13a30860cc62649f091cd9a219ace20` | 1,135,668 B | 27,100 | Review candidate (v1 stays live) |
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

## Follow-up review (19 Oct 2026, later)

### REEF 996 — the marginal wave criterion

Investigated and not correctable with the available evidence. The geometry
already follows the facade-detail render (deep/shallow offsets, smooth S per
bay). v3 smooths the normals across the curve (crease angle 35°) to rule out
faceted shading as the cause: square-on, v2 and v3 are indistinguishable in the
viewer. The renders show the wave through raking light, shadow and an upward
perspective; the viewer's even lighting cannot. Making it read square-on would
mean a deeper wave than the references show, so it was not done. Status stays
5/6 + 1 marginal.

### REEF 997 — wing separation (v1.1)

The aerial (p.13), re-read on a pixel grid, shows a stepped south face: the
north block's face at ~y 520 between the west wing and the stub, the east wing
running on to ~y 623 (its south edge carries the pergola), the stub to ~y 717.
v1.0.0 drew one straight face across the width, which merged the wings. v1.1
steps it and adds the dark vertical joints the hero shows where the wings meet.
The top view now matches the aerial; in elevation the wings are still only
partly distinct, because the white fin frames and set-back depths cannot be
dimensioned from the renders. About 4.5/6; remains a draft.

### REEF 998 v2 — map placement note

If v2 replaces v1, the overlay base offset changes from 50 m to 44.25 m (half
the 88.5 m model height including roof planting).

## Advisor (/api/chat) stability

Bounded run, 6 sequential calls each to live (45220c5) and the preview
(271d4b6), 3 s apart: 12/12 HTTP 200; total time 2.5–24.4 s on BOTH builds
(live 24.4 / 4.9 / 6.3 / 2.8 / 3.6 / 7.0 s; preview 12.0 / 4.8 / 19.0 / 2.5 /
3.9 / 2.6 s). The two earlier 504s were calls near the ~28–30 s hosting limit.
The route has not changed since 471d699; the viewer release does not touch it.
Existing upstream-latency issue, not a regression.

## Genuine 360° — what each property needs

Nothing below may be published until republication rights are confirmed in
writing. Flat films are ordinary video chapters, never panoramas.

| Project | Available now (flat, rights not established) | Needed for a genuine 360° tour |
| --- | --- | --- |
| REEF 996 | 12 portrait films: residences, interiors, garden lounges, amenities, sunken balcony, walkthrough, night exterior, teaser | Equirectangular (2:1) renders or 360° captures of: lobby, a typical residence (living, bedroom, balcony), garden lounge, pool deck, rooftop amenities. 8K stills (8192x4096) preferred; 360° video with spherical metadata acceptable |
| REEF 997 | 13 project films: exterior, lobby, residences, interiors, penthouse, amenities (pool, outdoor cinema, gym, kids), sunken balcony, wellness; 1 launch-event film | Same scene list plus the penthouse terrace and winter garden; the brochure's lobby, corridor and residence renders exist as flat images only, so the developer's 3D scene files or panoramic exports are needed |
| REEF 998 | 2 project films: residences, retail promenade; 1 groundbreaking film | Lobby, typical studio/1BR/2BR, rooftop sports deck, first-floor pool deck, retail promenade |

Three films carry no project identification and are not attributed: two show-apartment films and a landscape sunken-balcony technology film.

## Plot placement — documents needed

| Project | Current | Document that would establish it |
| --- | --- | --- |
| REEF 996 | Locality point (Dubai Production City); no overlay | DLD/Dubai Development Authority affection plan or site plan with plot number and coordinates (DLTM/WGS84), or the developer's surveyed site coordinates |
| REEF 997 | Locality point (Dubai Islands); no overlay | Nakheel/Dubai Islands affection plan for the plot (brochure p.9 marks it on a schematic only) |
| REEF 998 | Locality point (Wadi Al Safa 5 / DLRC); approved approximate overlay | DLRC affection plan with plot number; the brochure's location map (p.6) shows the plot beside an interchange but is not georeferenced |

## Final review round (19 Oct 2026)

### REEF 996 — the marginal criterion is lighting, not geometry

v2 was reproduced byte-identically (9ea83ecf…). Viewed in the site viewer,
square-on, with the same file and camera: under the live lighting (one key light
at 50°/30°, ambient 0.45, no shadows) each bay reads as a flat tray; under a
raking key light (35°/70°, ambient 0.3) with shadows it reads as the S-curve in
the developer's facade render. The geometry matches the evidence; the live
lighting cannot show plan curvature square-on. The engine now accepts an
optional `lighting` setting (ViewerLighting); production passes none and is
unchanged. Adopting it live is a separate viewer decision. Status stays 5/6 +
1 marginal — not claimed as fully validated.

### REEF 998 v3 — balconies as separate units

The typical floor layout (p.14) shows six separate balcony units on the north
face and four runs on the south, not a continuous band. v3 places balconies
only there (slab, 0.45 m solid edge, 0.75 m glass rail, nosing), keeps a thin
continuous slab ledge (the white ledges in the renders), sets the glazing body
at the measured 65 x 19.5 m, and seats the crown on it. Unresolved: the slot
seen in the renders does not appear on the typical floor plan, so its position
is unconfirmed. Overlay: model height 88.5 m → base offset 44.25 m (the overlay
loaded at that altitude in a local test; ground contact not yet checked
visually). Scale 10 matches the 1:10 authoring.

### REEF 997 — stopped at the v1.1 draft

The wing projections, set-back depths and fin frames cannot be dimensioned from
perspective renders; the north and east facades appear in no reference. A
request for elevations has been prepared.

### Candidate pages (local test, reverted)

With a temporary uncommitted approval and the files served locally, each
property page loaded its own model (996 → 9ea83ecf…, 997 → 3ec26515…, 998 →
589b1569…) with the reconstruction label, the presets, reset and the toolbar at
1440, 390 and 375 px, no overflow and no broken images; REEF 998's overlay
loaded at 44.25 m. The approval list was restored to REEF 998 v1 only.

## REEF 999 and REEF 1000 (20 Oct 2026)

### REEF 1000 — draft v0.1 (not reviewed, not published)

| Item | Value |
| --- | --- |
| Generator | `tools/reef-1000-massing.py` (regenerates byte-identically) |
| File | sha256 `aeb69aa08baf1b75a3bcff465d1e1d8af636e393f74d6043dafffcb946db9ffc`, 702,964 B, 16,144 triangles |
| Staged key | `m/27cfb97645c9b41b486ca506/aeb69aa08baf1b75` (gitignored staging; lab only) |
| Sources | Developer front render and rear aerial render from the channel-partner tour (hashes in docs/reef-portfolio.md); tour floor picker 1–7; residence count and sizes from the project page |
| Renders | `research/review-package/renders/1000-v0.1-{front,sw,side,rear,nw,aerial}.png` |

Established from two opposite views: the U plan (street bar, two wings round a
podium pool deck), seven residential levels above one podium storey, the dark
slatted top floor under a wide canopy, wavy balconies on the street, end and
courtyard faces, the sculpted street fascia and the rear car-park arc.

Approximations: every plan dimension and storey height (no drawing exists), the
podium's north and east faces, balcony depth and wave, the central balcony-free
bay. Portals' "G+6" conflicts with the developer's seven levels and is not
resolved. Height to the canopy ~29.8 m is an estimate, so no map overlay is
proposed; the coordinate is a developer place pin, not a plot.

Next step before review: an elevation or section from the developer to replace
the assumed dimensions.

### REEF 999 — no candidate

Only one exterior angle exists (the developer's day and night renders show the
same front corner). It establishes two connected blocks on a slatted podium
with an arched entrance, but not the rear, the depth of either block, or the
floor count (portals say "two 12-storey towers"; the developer states none).
A model would invent at least half of the building, so none is built. Needed:
any rear or side render, or elevations.
