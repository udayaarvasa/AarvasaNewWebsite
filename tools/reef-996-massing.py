#!/usr/bin/env python3
"""
REEF 996 — a massing reconstruction, built from the developer's own material.

WHAT THIS IS

A visual reconstruction, not a survey and not a BIM export. It exists because
photogrammetry cannot work on the supplied REEF footage: the marketing films
were shot for film, so the camera never arcs around the building and there is no
parallax to triangulate (measured at 0.28-0.80 degrees of baseline against a
1.5 degree threshold; see docs/reconstruction.md). This takes the other route —
read the form off the renders, read the floor counts off the developer's record,
and build the massing from those numbers.

WHERE EVERY NUMBER COMES FROM

Sourced, from the developer's own record in src/lib/reef-projects.ts:
  - buildingConfig "1B + G + 3P + 20": one basement, ground, three podium
    levels, twenty residential floors. FLOORS, PODIUM_LEVELS below.
  - 505 units. With twenty floors that is ~25 per floor, which is what sets the
    slab proportion: a tower that squat would not hold them, and a point block
    could not either.

Measured, from the developer's renders (tools/measure-*.py, run on the files in
public/images/reef-996):
  - 21 balcony ridges counted down the long face of the aerial render, which is
    the twenty residential floors plus the crown band. The render and the
    written record agree; that agreement is why the rest is worth building.
  - The wave rhythm of the balcony parapets, and the number of bays across each
    face, from crest counting along a single band.

Observed, from looking at the renders:
  - A slab, not a point tower, with the long axis running one way.
  - Every floor carries a continuous balcony parapet whose plan sweeps in and
    out in a smooth wave. It is a solid band with a rounded top, roughly chest
    height, and the balcony behind it is deep where the wave bows out and
    shallow where it bows in.
  - Vertical piers stand slightly proud of the balcony line at the corners and
    at intervals along the faces, reading as a frame.
  - The crown is a darker band with a scalloped lower edge carrying REEF 996
    signage on more than one face, and the roof behind it is flat with plant
    enclosures and two curved parapet features.
  - A low podium with a pool deck sits at the base.

Assumed, and stated as such because no source gives them:
  - 3.2 m floor to floor for residential and 4.0 m for podium levels. These are
    ordinary Dubai residential dimensions. They set the building's height, so
    the height is an estimate, not a measurement.
  - The plan dimensions. The aerial is a perspective render, so its foreshortening
    cannot be inverted without the camera, and 82 x 22 m is chosen to match both
    the observed proportion and the unit count rather than read off anything.

So: the silhouette, the floor count, the balcony rhythm and the podium
relationship are derived from REEF's own material. The absolute dimensions are
plausible, not surveyed. It must never be labelled an official model.

Output: a self-contained glTF 2.0 binary, geometry only, no textures.
"""

import json
import math
import struct
import sys

# ── Dimensions ───────────────────────────────────────────────────────────────

FLOORS = 20                 # sourced: "…+ 20"
PODIUM_LEVELS = 3           # sourced: "…3P…"
FLOOR_H = 3.2               # assumed
PODIUM_H = 4.0              # assumed
GROUND_H = 5.0              # assumed; a taller entrance level

LENGTH = 82.0               # assumed, from the observed slab proportion
DEPTH = 22.0

CORE_INSET = 2.6            # glazing line, inboard of the slab edge
WAVE_BAYS_LONG = 11         # measured rhythm along the long face
WAVE_BAYS_SHORT = 3
WAVE_AMP = 0.95             # how far the parapet bows in and out
PARAPET_H = 1.15
PARAPET_T = 0.34
SLAB_T = 0.30
PIER_W = 1.5
PIER_PROUD = 0.45
CROWN_H = 4.2
SEG_LEN = 1.1               # parapet sampling, metres

TOWER_BASE = GROUND_H + PODIUM_LEVELS * PODIUM_H     # top of the podium
TOWER_TOP = TOWER_BASE + FLOORS * FLOOR_H

# ── Mesh building ────────────────────────────────────────────────────────────

class Mesh:
    """Triangles with flat normals, grouped by material."""

    def __init__(self):
        self.groups = {}

    def tri(self, mat, a, b, c):
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        if length < 1e-9:
            return                                  # degenerate; drop it
        n = (nx / length, ny / length, nz / length)
        g = self.groups.setdefault(mat, {"pos": [], "nrm": []})
        for p in (a, b, c):
            g["pos"].extend(p)
            g["nrm"].extend(n)

    def quad(self, mat, a, b, c, d):
        self.tri(mat, a, b, c)
        self.tri(mat, a, c, d)

    def box(self, mat, cx, cy, cz, sx, sy, sz):
        x0, x1 = cx - sx / 2, cx + sx / 2
        y0, y1 = cy, cy + sy                        # y is the base, not the centre
        z0, z1 = cz - sz / 2, cz + sz / 2
        p = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
             (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
        self.quad(mat, p[4], p[7], p[6], p[5])      # top
        self.quad(mat, p[0], p[1], p[2], p[3])      # bottom
        self.quad(mat, p[0], p[4], p[5], p[1])      # -z
        self.quad(mat, p[3], p[2], p[6], p[7])      # +z
        self.quad(mat, p[0], p[3], p[7], p[4])      # -x
        self.quad(mat, p[1], p[5], p[6], p[2])      # +x

    def triangles(self):
        return sum(len(g["pos"]) // 9 for g in self.groups.values())


# ── The wave ─────────────────────────────────────────────────────────────────

def perimeter_path(samples_long, samples_short):
    """
    The balcony parapet's centre line for one floor.

    A rounded rectangle whose offset from the slab edge breathes in and out along
    each side. The wave is continuous around the corners because the phase is
    driven by distance travelled along each face, and each face carries a whole
    number of bays — which is what makes the crests stack cleanly from floor to
    floor, the way they do in the renders.
    """
    hx, hz = LENGTH / 2, DEPTH / 2
    pts = []

    def wave(t, bays):
        # t runs 0..1 along the face. cos gives a crest at each end, so adjacent
        # faces meet at a crest and the corner reads as a continuous bulge.
        return WAVE_AMP * math.cos(2 * math.pi * bays * t)

    for i in range(samples_long):                   # +z face, running +x
        t = i / samples_long
        pts.append((-hx + LENGTH * t, hz + wave(t, WAVE_BAYS_LONG)))
    for i in range(samples_short):                  # +x face, running -z
        t = i / samples_short
        pts.append((hx + wave(t, WAVE_BAYS_SHORT), hz - DEPTH * t))
    for i in range(samples_long):                   # -z face, running -x
        t = i / samples_long
        pts.append((hx - LENGTH * t, -hz - wave(t, WAVE_BAYS_LONG)))
    for i in range(samples_short):                  # -x face, running +z
        t = i / samples_short
        pts.append((-hx - wave(t, WAVE_BAYS_SHORT), -hz + DEPTH * t))
    return pts


def sweep_parapet(mesh, mat_top, mat_side, path, y):
    """
    Sweep the parapet along a closed path: outer face, chamfered top, inner face.

    The chamfer stands in for the fully radiused section in the renders. At the
    scale this model is viewed, two bevels read as a rounded edge and cost a
    fraction of the triangles a real fillet would.
    """
    n = len(path)
    half = PARAPET_T / 2
    chamfer = PARAPET_T * 0.30
    for i in range(n):
        x0, z0 = path[i]
        x1, z1 = path[(i + 1) % n]
        # Outward normal of this segment, in plan.
        dx, dz = x1 - x0, z1 - z0
        length = math.hypot(dx, dz) or 1.0
        ox, oz = dz / length, -dx / length
        # Keep the outward side pointing away from the centre.
        if (x0 * ox + z0 * oz) < 0:
            ox, oz = -ox, -oz

        def pt(x, z, off, h):
            return (x + ox * off, y + h, z + oz * off)

        yb, yt = 0.0, PARAPET_H - chamfer
        a_o, b_o = pt(x0, z0, half, yb), pt(x1, z1, half, yb)
        a_ot, b_ot = pt(x0, z0, half, yt), pt(x1, z1, half, yt)
        a_i, b_i = pt(x0, z0, -half, yb), pt(x1, z1, -half, yb)
        a_it, b_it = pt(x0, z0, -half, yt), pt(x1, z1, -half, yt)
        a_c, b_c = pt(x0, z0, half - chamfer, PARAPET_H), pt(x1, z1, half - chamfer, PARAPET_H)
        a_d, b_d = pt(x0, z0, -half + chamfer, PARAPET_H), pt(x1, z1, -half + chamfer, PARAPET_H)

        mesh.quad(mat_side, a_o, b_o, b_ot, a_ot)   # outer face
        mesh.quad(mat_side, b_i, a_i, a_it, b_it)   # inner face
        mesh.quad(mat_top, a_ot, b_ot, b_c, a_c)    # outer chamfer
        mesh.quad(mat_top, a_c, b_c, b_d, a_d)      # cap
        mesh.quad(mat_top, a_d, b_d, b_it, a_it)    # inner chamfer


def slab(mesh, mat, path, y, thickness):
    """The floor plate: a fan from the centre out to the parapet line."""
    n = len(path)
    top, bot = y + thickness, y
    for i in range(n):
        x0, z0 = path[i]
        x1, z1 = path[(i + 1) % n]
        mesh.tri(mat, (0, top, 0), (x0, top, z0), (x1, top, z1))
        mesh.tri(mat, (0, bot, 0), (x1, bot, z1), (x0, bot, z0))
        # Edge band, so the slab reads as a solid plate from below.
        mesh.quad(mat, (x0, bot, z0), (x1, bot, z1), (x1, top, z1), (x0, top, z0))


def build():
    mesh = Mesh()
    CONCRETE, GLASS, CROWN, DECK, STONE, WATER, PLANT = (
        "concrete", "glass", "crown", "deck", "stone", "water", "planting")

    samples_long = max(8, int(LENGTH / SEG_LEN))
    samples_short = max(4, int(DEPTH / SEG_LEN))
    path = perimeter_path(samples_long, samples_short)

    # ── Podium: ground plus three levels, set wider than the tower ───────────
    pod_l, pod_d = LENGTH * 1.18, DEPTH * 2.25
    mesh.box(STONE, 0, 0, DEPTH * 0.42, pod_l, GROUND_H, pod_d)
    for i in range(PODIUM_LEVELS):
        y = GROUND_H + i * PODIUM_H
        inset = 1.0 + i * 0.8
        mesh.box(STONE, 0, y, DEPTH * 0.42, pod_l - inset * 2, PODIUM_H, pod_d - inset * 2)

    # Pool deck on top of the podium, off the tower's long face.
    deck_y = TOWER_BASE
    deck_z = DEPTH * 1.15
    mesh.box(DECK, 0, deck_y, deck_z, pod_l - 8, 0.25, DEPTH * 0.95)
    mesh.box(WATER, -LENGTH * 0.18, deck_y + 0.26, deck_z, 26.0, 0.12, 9.0)
    for sx in (-1, 1):                               # planters flanking the pool
        mesh.box(PLANT, sx * LENGTH * 0.33, deck_y + 0.26, deck_z, 12.0, 0.9, 7.0)

    # ── Tower ───────────────────────────────────────────────────────────────
    core_hx, core_hz = LENGTH / 2 - CORE_INSET, DEPTH / 2 - CORE_INSET
    for f in range(FLOORS):
        y = TOWER_BASE + f * FLOOR_H
        slab(mesh, CONCRETE, path, y, SLAB_T)
        # Glazed volume behind the balconies: the floor's enclosed envelope.
        mesh.box(GLASS, 0, y + SLAB_T, 0, core_hx * 2, FLOOR_H - SLAB_T, core_hz * 2)
        # Balcony deck, between the glazing and the parapet.
        sweep_parapet(mesh, CONCRETE, CONCRETE, path, y + SLAB_T)

    # Vertical piers, standing proud of the balcony line.
    pier_positions = [(-LENGTH / 2, z) for z in (-DEPTH / 2, DEPTH / 2)] + \
                     [(LENGTH / 2, z) for z in (-DEPTH / 2, DEPTH / 2)]
    for i in range(1, WAVE_BAYS_LONG):               # intermediate piers, both long faces
        x = -LENGTH / 2 + LENGTH * i / WAVE_BAYS_LONG
        pier_positions += [(x, DEPTH / 2 + WAVE_AMP), (x, -DEPTH / 2 - WAVE_AMP)]
    for px, pz in pier_positions:
        mesh.box(CONCRETE, px, TOWER_BASE, pz + (PIER_PROUD if pz > 0 else -PIER_PROUD),
                 PIER_W, FLOORS * FLOOR_H + CROWN_H, PIER_W)

    # ── Crown ───────────────────────────────────────────────────────────────
    # A darker band standing above the top floor, inset slightly, with the
    # scalloped lower edge the renders show: a shallow arch over each bay.
    crown_path = perimeter_path(samples_long, samples_short)
    slab(mesh, CONCRETE, crown_path, TOWER_TOP, SLAB_T)
    mesh.box(CROWN, 0, TOWER_TOP + SLAB_T, 0, LENGTH - 1.0, CROWN_H, DEPTH - 1.0)
    # Scallops: a row of shallow recesses along both long faces.
    for sign in (1, -1):
        for i in range(WAVE_BAYS_LONG):
            x = -LENGTH / 2 + LENGTH * (i + 0.5) / WAVE_BAYS_LONG
            mesh.box(CONCRETE, x, TOWER_TOP + SLAB_T + CROWN_H * 0.62,
                     sign * (DEPTH / 2 - 0.45), LENGTH / WAVE_BAYS_LONG * 0.72, 0.5, 0.5)

    # ── Roof ────────────────────────────────────────────────────────────────
    roof_y = TOWER_TOP + SLAB_T + CROWN_H
    mesh.box(STONE, 0, roof_y, 0, LENGTH - 1.0, 0.3, DEPTH - 1.0)
    # Plant and lift enclosures.
    for x, sx, sz in ((-LENGTH * 0.22, 14.0, 9.0), (LENGTH * 0.10, 10.0, 7.0),
                      (LENGTH * 0.33, 7.0, 6.0)):
        mesh.box(STONE, x, roof_y + 0.3, 0, sx, 3.4, sz)
    # The two curved parapet features at the roof edge, one near each end.
    for x in (-LENGTH * 0.34, LENGTH * 0.30):
        for k in range(7):                           # stepped blocks approximate the curve
            t = k / 6
            h = 2.6 * math.sin(math.pi * max(t, 1e-3))
            mesh.box(STONE, x + (t - 0.5) * 13.0, roof_y + 0.3, DEPTH * 0.30,
                     13.0 / 7, max(h, 0.4), 4.0)

    return mesh


# ── glTF export ──────────────────────────────────────────────────────────────

MATERIALS = {
    # name:        (base colour rgba,              metallic, roughness)
    "concrete":    ((0.900, 0.894, 0.878, 1.0),    0.00, 0.62),
    "glass":       ((0.090, 0.105, 0.125, 1.0),    0.25, 0.14),
    "crown":       ((0.185, 0.195, 0.205, 1.0),    0.10, 0.45),
    "deck":        ((0.556, 0.431, 0.302, 1.0),    0.00, 0.70),
    "stone":       ((0.839, 0.827, 0.800, 1.0),    0.00, 0.72),
    "water":       ((0.180, 0.580, 0.650, 1.0),    0.10, 0.10),
    "planting":    ((0.247, 0.380, 0.231, 1.0),    0.00, 0.85),
}


def export(mesh, out_path):
    buffers, views, accessors, prims, materials = bytearray(), [], [], [], []
    mat_index = {}

    for name in sorted(mesh.groups):
        colour, metallic, roughness = MATERIALS[name]
        mat_index[name] = len(materials)
        materials.append({
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": list(colour),
                "metallicFactor": metallic,
                "roughnessFactor": roughness,
            },
            "doubleSided": False,
        })

    for name in sorted(mesh.groups):
        g = mesh.groups[name]
        pos, nrm = g["pos"], g["nrm"]
        count = len(pos) // 3

        for data, kind in ((pos, "POSITION"), (nrm, "NORMAL")):
            while len(buffers) % 4:
                buffers.append(0)
            offset = len(buffers)
            buffers.extend(struct.pack(f"<{len(data)}f", *data))
            views.append({"buffer": 0, "byteOffset": offset,
                          "byteLength": len(data) * 4, "target": 34962})
            acc = {"bufferView": len(views) - 1, "componentType": 5126,
                   "count": count, "type": "VEC3"}
            if kind == "POSITION":
                xs, ys, zs = data[0::3], data[1::3], data[2::3]
                acc["min"] = [min(xs), min(ys), min(zs)]
                acc["max"] = [max(xs), max(ys), max(zs)]
            accessors.append(acc)

        prims.append({
            "attributes": {"POSITION": len(accessors) - 2, "NORMAL": len(accessors) - 1},
            "material": mat_index[name],
            "mode": 4,
        })

    while len(buffers) % 4:
        buffers.append(0)

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "aarvasa-reef-996-massing",
            "copyright": "Aarvasa visual reconstruction from REEF developer renders. Not an official developer model.",
        },
        "scene": 0,
        "scenes": [{"nodes": [0], "name": "REEF 996"}],
        # Centre the tower on the origin and sit it on the ground plane, so the
        # viewer's own framing has nothing to correct for.
        "nodes": [{"mesh": 0, "name": "REEF996_massing",
                   "translation": [0.0, -TOWER_TOP / 2, 0.0]}],
        "meshes": [{"name": "REEF996", "primitives": prims}],
        "materials": materials,
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(buffers)}],
    }

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)

    def chunk(data, kind):
        return struct.pack("<II", len(data), kind) + bytes(data)

    body = chunk(json_bytes, 0x4E4F534A) + chunk(buffers, 0x004E4942)
    header = b"glTF" + struct.pack("<II", 2, 12 + len(body))
    with open(out_path, "wb") as f:
        f.write(header + body)
    return 12 + len(body)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "reef-996-massing.glb"
    m = build()
    size = export(m, out)
    print(f"wrote {out}")
    print(f"  {m.triangles():,} triangles across {len(m.groups)} materials")
    print(f"  {size:,} bytes")
    print(f"  {FLOORS} residential floors over ground + {PODIUM_LEVELS} podium levels")
    print(f"  {LENGTH:.0f} x {DEPTH:.0f} m plan, {TOWER_TOP + CROWN_H:.1f} m to the top of the crown")
