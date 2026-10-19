#!/usr/bin/env python3
"""
REEF 997 — reference-based massing reconstruction (DRAFT CANDIDATE).

1.1.0 (19 Oct 2026). v1.0.0 (sha256 05061b40…, reproducible from commit
d2f790c) drew the north block's south face as one straight line, which merged
the wings into a single banded mass. Re-read on S3 with a pixel grid: the
north block's south face sits at ~y 520 between the west wing and the stub,
the EAST wing runs on to ~y 623 (its south edge carries the pergola), and the
stub projects to ~y 717. So the plan is stepped, with the wave-balcony
connector recessed between the wings. S1 also shows dark vertical joints where
the wings meet; they are added full height. Nothing else changes.

A visual reconstruction, not a survey, not CAD, not an official model. Built
from REEF's own published material; every number below says where it came from.

SOURCES (private reference library, research/reef-997/, see manifest.jsonl)
  S1  reefdevelopments.ae/en/reef-997 hero render "997.webp" (2268x1187):
      full-height three-quarter view — podium, two residential wings, the
      connector with wave balconies, crown, rooftop boxes.
  S2  Developer brochure (95 pp., public PDF, Property Finder) p.3 and p.5:
      two further full-height exterior renders from different angles.
  S3  Same brochure p.13: top-down aerial render of the building and its plot.
  S4  Same brochure p.5 text: "Building Configuration G + 2P + 8"; p.11: 63
      units (23 x 1BR, 36 x 2BR, 3 x 3BR duplex, 1 x 4BR penthouse).

SOURCED (high confidence)
  - G + 2P + 8: ground, two podium levels, eight residential floors. Eight
    balcony bands are counted on S1 and S2 p.3, agreeing with the brochure.

MEASURED (medium confidence)
  - Plan scale from S3, using the vehicles in the aerial as the ruler (~80 px
    for a ~4.9 m car, ~16.5 px/m): podium ~39 x 38 m. +/-15%.
  - Tower plan read off S3 (roof outlines): a north block across most of the
    width, a narrower west wing, and a short central wing reaching south over
    the podium deck. Positions below are S3 pixels converted at 16.5 px/m.
  - Podium height ~13 m: S2 p.3 shows the podium face at ~0.33 of its width,
    consistent with G + 2P at the assumed storey heights below.

OBSERVED (from S1-S3; shape, not dimension)
  - Heavily radiused corners on every wing; continuous white balcony bands
    with a bright nosing on every residential floor; clear glass rails.
  - Wave-edged balconies on the connecting face between the wings.
  - Dark vertical-slat podium cladding with a white rounded top edge;
    planted podium deck with a free-form pool (south-west) and an amenity
    terrace (south-east); rooftop jacuzzi deck (north-east).
  - A dark stone crown band carrying the signage on the north block.

ASSUMED (low confidence; stated so they are never mistaken for measurements)
  - 3.3 m residential floor-to-floor; ground 5.0 m; podium levels 4.0 m.
  - Crown band 2.6 m; rooftop plant boxes 3 m.
  - Balcony depth 2.0 m on the long faces.
  - The exact outline of hidden (east and north) facades: drawn as the same
    banded treatment as the visible faces; S3 shows they exist, not their detail.

Output: glTF 2.0 binary at 1:10 (metresPerUnit 10), centred on its bounds.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from massing_glb import Mesh, export, offset_path, rounded_rect  # noqa: E402

VERSION = "1.1.0"
SCALE = 0.1

# ── Storeys ─────────────────────────────────────────────────────────────────
FLOORS = 8              # sourced: G + 2P + 8
GROUND_H = 5.0          # assumed
PODIUM_LEVELS = 2       # sourced
PODIUM_H = 4.0          # assumed
FLOOR_H = 3.3           # assumed
PODIUM_TOP = GROUND_H + PODIUM_LEVELS * PODIUM_H        # 13.0 m, matches the S2 p.3 ratio
TOWER_TOP = PODIUM_TOP + FLOORS * FLOOR_H
CROWN_H = 2.6           # assumed

# ── Plan, metres; +x east, +z south; from S3 at 16.5 px/m, centred on the podium
PX = 16.5
CX, CZ = 985, 495       # podium centre in S3 pixels


def m(px_x, px_y):
    return ((px_x - CX) / PX, (px_y - CZ) / PX)


POD_X0, POD_Z0 = m(660, 185)
POD_X1, POD_Z1 = m(1310, 805)
# Residential blocks (glazing line), from the roof outlines in S3.
BLOCKS = {
    "north": (*m(797, 200), *m(1287, 520)),   # 1.1: south face at y 520 (recessed connector)
    "east":  (*m(1083, 200), *m(1287, 623)),  # 1.1: east wing runs further south (pergola edge)
    "west":  (*m(687, 190), *m(847, 550)),    # narrow west wing
    "stub":  (*m(973, 520), *m(1087, 717)),   # central wing reaching south
}
CORNER_R = 3.2          # observed: heavily radiused; radius assumed
BALCONY = 2.0           # assumed depth beyond the glazing line
BAND_H = 0.95           # solid white band (slab edge + upstand), observed proportion
RAIL_H = 0.95           # glass rail above it
SLAB_T = 0.30
WAVE_AMP = 1.1          # wave balconies on the connector face (observed; amplitude assumed)

MATERIALS = {
    "white":    ((0.930, 0.925, 0.905, 1.0), 0.00, 0.55),
    "glass":    ((0.210, 0.250, 0.270, 1.0), 0.30, 0.15),
    "rail":     ((0.640, 0.720, 0.750, 0.35), 0.10, 0.08),
    "nosing":   ((0.820, 0.880, 0.640, 1.0), 0.20, 0.35),    # the lit green-gold edge in S1
    "crown":    ((0.170, 0.170, 0.175, 1.0), 0.15, 0.35),
    "slats":    ((0.300, 0.305, 0.315, 1.0), 0.25, 0.45),
    "deck":     ((0.600, 0.560, 0.500, 1.0), 0.00, 0.75),
    "water":    ((0.200, 0.640, 0.720, 1.0), 0.10, 0.10),
    "planting": ((0.260, 0.420, 0.250, 1.0), 0.00, 0.85),
    "stone":    ((0.860, 0.850, 0.830, 1.0), 0.00, 0.70),
}


def block_outline(name, grow=0.0, samples=6):
    x0, z0, x1, z1 = BLOCKS[name]
    return rounded_rect(x0 - grow, z0 - grow, x1 + grow, z1 + grow, CORNER_R + grow, samples)


def wave_south(path, x_from, x_to, amp):
    """Bow the south edge (largest z) of a balcony outline in and out between x_from..x_to."""
    zmax = max(p[1] for p in path)
    out = []
    for x, z in path:
        if z > zmax - 0.05 and x_from < x < x_to:
            t = (x - x_from) / (x_to - x_from)
            import math
            z += amp * (0.5 - 0.5 * math.cos(t * math.tau * 2))
        out.append((x, z))
    return out


def densify(path, step=1.0):
    import math
    out = []
    n = len(path)
    for i in range(n):
        x0, z0 = path[i]
        x1, z1 = path[(i + 1) % n]
        k = max(1, int(math.hypot(x1 - x0, z1 - z0) / step))
        for j in range(k):
            t = j / k
            out.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
    return out


def ring(mesh, mat, path, y, h, t):
    """A thin vertical band along a closed path: outer wall, inner wall, top cap."""
    outer = offset_path(path, t / 2)
    inner = offset_path(path, -t / 2)
    n = len(path)
    for i in range(n):
        a, b = outer[i], outer[(i + 1) % n]
        c, d = inner[i], inner[(i + 1) % n]
        mesh.quad(mat, (a[0], y, a[1]), (a[0], y + h, a[1]), (b[0], y + h, b[1]), (b[0], y, b[1]))
        mesh.quad(mat, (d[0], y, d[1]), (d[0], y + h, d[1]), (c[0], y + h, c[1]), (c[0], y, c[1]))
        mesh.quad(mat, (a[0], y + h, a[1]), (c[0], y + h, c[1]), (d[0], y + h, d[1]), (b[0], y + h, b[1]))


def build():
    mesh = Mesh()

    # ── Podium: ground + two levels, dark vertical slats, white rounded top edge
    pod = rounded_rect(POD_X0, POD_Z0, POD_X1, POD_Z1, 2.5, 8)
    mesh.prism("glass", offset_path(pod, -0.6), 0, PODIUM_TOP - 1.0)  # building line behind the slats
    mesh.prism("slats", offset_path(pod, 0.4), 0.6, PODIUM_TOP - 1.6)  # S2 p.3: slats run near the ground
    # The vertical slat rhythm: thin fins proud of the podium face.
    import math
    fins = densify(offset_path(pod, 0.55), 0.9)
    for x, z in fins:
        mesh.box("slats", x, 0.6, z, 0.18, PODIUM_TOP - 1.6, 0.18)
    edge = offset_path(pod, 0.7)
    mesh.prism("white", edge, PODIUM_TOP - 1.0, 1.0)              # white rounded top edge
    # Entrance portal on the west face, facing the drop-off roundabout (S1, S2 p.3, S3).
    ex, ez = m(660, 480)
    mesh.box("white", ex - 0.6, 0, ez, 2.4, GROUND_H + 0.6, 9.0)
    mesh.box("glass", ex - 1.0, 0, ez, 2.6, GROUND_H - 0.6, 6.0)
    mesh.prism("deck", offset_path(pod, -0.2), PODIUM_TOP, 0.25)
    # Pool (south-west) and amenity terrace (south-east) on the deck, from S3.
    px0, pz0 = m(690, 612)
    px1, pz1 = m(915, 788)
    mesh.prism("water", rounded_rect(px0, pz0, px1, pz1, 3.0, 6), PODIUM_TOP + 0.25, 0.12)
    tx0, tz0 = m(1110, 720)
    tx1, tz1 = m(1290, 790)
    mesh.prism("stone", rounded_rect(tx0, tz0, tx1, tz1, 1.5, 4), PODIUM_TOP + 0.25, 0.3)
    for (gx, gz) in (m(700, 580), m(1270, 640), m(940, 560), m(705, 700)):
        mesh.box("planting", gx, PODIUM_TOP + 0.25, gz, 2.4, 2.2, 2.4)

    # ── Residential floors: glazing set back, white band + nosing + glass rail
    for name in BLOCKS:
        glaze = block_outline(name)
        balcony = densify(block_outline(name, BALCONY, 8), 0.8)
        if name == "north":
            # Wave balconies on the connector face between the west wing and the stub.
            bx0 = BLOCKS["west"][2] + 0.5
            bx1 = BLOCKS["stub"][0] - 0.5
            balcony = wave_south(balcony, bx0, bx1, WAVE_AMP)
        for f in range(FLOORS):
            y = PODIUM_TOP + f * FLOOR_H
            mesh.prism("white", balcony, y, SLAB_T)                       # balcony slab
            mesh.prism("glass", glaze, y + SLAB_T, FLOOR_H - SLAB_T)       # glazed envelope
            ring(mesh, "white", balcony, y + SLAB_T, BAND_H - SLAB_T, 0.28)
            ring(mesh, "nosing", balcony, y - 0.08, 0.08, 0.30)            # lit edge under the band
            ring(mesh, "rail", balcony, y + BAND_H, RAIL_H, 0.04)
        # Roof slab over the last floor.
        mesh.prism("white", balcony, TOWER_TOP, SLAB_T)

    # ── 1.1: dark vertical joints where the wings meet (S1), full residential height
    for (jx, jz) in (m(849, 535), m(1085, 640)):
        mesh.box("crown", jx, PODIUM_TOP, jz, 1.4, FLOORS * FLOOR_H + CROWN_H, BALCONY * 2 + 1.0)
    # The east wing's roof edge is a pergola, not the dark crown (S3, S1).
    ex0, ez0, ex1, ez1 = BLOCKS["east"]
    for k in range(18):
        x = ex0 + 1.0 + k * (ex1 - ex0 - 2.0) / 17
        mesh.box("white", x, TOWER_TOP + SLAB_T, ez1 + BALCONY - 0.6, 0.25, 1.6, 2.2)

    # ── Crown: dark stone band on the north block (signage face) and the west wing
    # A perimeter band, not a lid: S3 shows a white roof inside it.
    for name in ("north", "west"):
        ring(mesh, "crown", densify(block_outline(name, 0.6, 8), 0.8), TOWER_TOP + SLAB_T, CROWN_H, 0.6)
    # Rooftop plant boxes and the north-east jacuzzi deck (S3).
    for (bx, bz, sx, sz) in ((*m(1040, 330), 9.0, 7.0), (*m(900, 300), 6.0, 5.0), (*m(1030, 450), 5.0, 4.0)):
        mesh.box("stone", bx, TOWER_TOP + SLAB_T + CROWN_H, bz, sx, 3.0, sz)
    jx0, jz0 = m(1150, 195)
    jx1, jz1 = m(1290, 300)
    mesh.prism("water", rounded_rect(jx0, jz0, jx1, jz1, 1.2, 4), TOWER_TOP + SLAB_T + CROWN_H, 0.15)

    return mesh


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "reef-997-massing.glb"
    mesh = build()
    size = export(
        mesh, out, materials=MATERIALS, scale=SCALE,
        generator=f"aarvasa-reef-997-massing {VERSION}", scene_name="REEF 997",
        copyright_text=("Aarvasa visual reconstruction from REEF developer renders and brochure. "
                        "DRAFT. Not an official developer model. Authored at 1:10; metresPerUnit 10."),
    )
    w = (POD_X1 - POD_X0)
    d = (POD_Z1 - POD_Z0)
    print(f"wrote {out}")
    print(f"  {mesh.triangles():,} triangles across {len(mesh.groups)} materials, {size:,} bytes")
    print(f"  G + {PODIUM_LEVELS}P + {FLOORS} (sourced); podium {w:.1f} x {d:.1f} m (measured, +/-15%)")
    print(f"  {TOWER_TOP + CROWN_H:.1f} m to the crown top (storey heights assumed)")
