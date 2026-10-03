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

Opening camera. A tower is not an object seen whole: at the viewer's generic
framing of 2.8x the bounding radius the balcony rhythm is below the threshold of
the display, and the model says nothing until someone zooms. The value validated
for this asset is yaw 26, pitch 16, distanceFactor 2.15: the whole building with
headroom above the crown, and the stepped bands legible. Set it on the asset's
viewDefaults when it is uploaded; the viewer reads it from there.

Output: a self-contained glTF 2.0 binary, geometry only, no textures."""

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

# The balcony ribbon. Read off the facade-detail render rather than assumed: the
# parapet does NOT follow a sine. It holds a deep projecting run for roughly half
# a bay, ramps across on a hard diagonal, holds a shallow run, and ramps back.
# That stepped profile with its diagonal transitions is the single most
# recognisable thing about the building, and a smooth sine loses it entirely.
BALCONY_DEEP = 3.6          # projecting run, out from the glazing line
BALCONY_SHALLOW = 1.3       # recessed run
BAY_DEEP = 0.44             # fraction of a bay held at the deep offset
BAY_RAMP = 0.10             # fraction spent on each diagonal transition
BAYS_LONG = 11              # measured rhythm along the long face
BAYS_SHORT = 3

PARAPET_H = 1.62
PARAPET_T = 0.32
TRIM_H = 0.14               # the brass pinstripe along each balcony edge
SLAB_T = 0.34
PIER_W = 1.7                # piers read as a frame, not as mullions
PIER_PROUD = 0.55           # how far they stand forward of the deep balcony run
CROWN_BAND_H = 3.4
CROWN_HUMP_H = 3.2          # extra height at the raised sections
CROWN_FRAME_T = 0.55

TOWER_BASE = GROUND_H + PODIUM_LEVELS * PODIUM_H     # top of the podium
TOWER_TOP = TOWER_BASE + FLOORS * FLOOR_H
CROWN_H = CROWN_BAND_H + CROWN_HUMP_H

# Everything below is authored in metres, and export() bakes the scale into the
# vertex positions on the way out.
#
# The viewer's camera has a fixed 200 m far clip (NEAR_CLIP/FAR_CLIP in
# playcanvas/create-engine.ts) and opens at 2.8x the content radius. A tower
# 88 m tall has a bounding radius near 70 m, which puts the opening camera at
# ~196 m and the far half of the building past the clip plane — the model loads,
# reports ready, and draws nothing. Authoring at a tenth of life size keeps the
# whole thing inside the frustum without touching the viewer, which is also what
# the Phase 3 pilot asset does. Real-world scale is recorded, not lost: a project
# that later offers this in AR states metersPerUnit, and for this model it is 10.
#
# It is baked into the vertices rather than set as a node scale, which matters.
# With a node scale the loader frames the camera on the mesh's own bounds while
# drawing the scaled node, so the camera sits ten times too far out and the
# model loads, reports ready and is nowhere on screen. Baking keeps the geometry
# and the bounds in the same units, which is the only way the two agree.
SCALE = 0.1
METERS_PER_UNIT = 1.0 / SCALE
# The glazing line sits inboard of the slab edge by the deepest balcony run.
CORE_HX = LENGTH / 2 - BALCONY_DEEP
CORE_HZ = DEPTH / 2 - BALCONY_DEEP
PODIUM_Z = DEPTH * 0.22                              # the podium sits slightly to one side

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


# ── The stepped balcony ribbon ───────────────────────────────────────────────

def bay_offsets(bays):
    """
    Offsets along one face, as (t, offset) pairs, where t runs 0..1 along the
    face and offset is how far the parapet stands out from the glazing line.

    Each bay is: a deep run, a diagonal in, a shallow run, a diagonal back out.
    Emitting only the corner points keeps the geometry clean and the triangle
    count down — a uniform sample would round off exactly the hard diagonals
    that make the facade recognisable.
    """
    pts = []
    hold_shallow = 1.0 - BAY_DEEP - 2 * BAY_RAMP
    for b in range(bays):
        base = b / bays
        step = 1.0 / bays
        pts.append((base, BALCONY_DEEP))
        pts.append((base + step * BAY_DEEP, BALCONY_DEEP))
        pts.append((base + step * (BAY_DEEP + BAY_RAMP), BALCONY_SHALLOW))
        pts.append((base + step * (BAY_DEEP + BAY_RAMP + hold_shallow), BALCONY_SHALLOW))
    return pts


def perimeter_path():
    """The parapet centre line for one floor, as a closed plan polygon."""
    pts = []
    for t, off in bay_offsets(BAYS_LONG):              # +z face, running +x
        pts.append((-CORE_HX + 2 * CORE_HX * t, CORE_HZ + off))
    for t, off in bay_offsets(BAYS_SHORT):             # +x face, running -z
        pts.append((CORE_HX + off, CORE_HZ - 2 * CORE_HZ * t))
    for t, off in bay_offsets(BAYS_LONG):              # -z face, running -x
        pts.append((CORE_HX - 2 * CORE_HX * t, -CORE_HZ - off))
    for t, off in bay_offsets(BAYS_SHORT):             # -x face, running +z
        pts.append((-CORE_HX - off, -CORE_HZ + 2 * CORE_HZ * t))
    return pts


def pier_stations():
    """Where the vertical piers land: on every bay boundary of the long faces."""
    out = []
    for b in range(BAYS_LONG + 1):
        x = -CORE_HX + 2 * CORE_HX * b / BAYS_LONG
        out.append((x, CORE_HZ + BALCONY_DEEP + PIER_PROUD - PIER_W / 2))
        out.append((x, -CORE_HZ - BALCONY_DEEP - PIER_PROUD + PIER_W / 2))
    for b in range(1, BAYS_SHORT):
        z = CORE_HZ - 2 * CORE_HZ * b / BAYS_SHORT
        out.append((CORE_HX + BALCONY_DEEP + PIER_PROUD - PIER_W / 2, z))
        out.append((-CORE_HX - BALCONY_DEEP - PIER_PROUD + PIER_W / 2, z))
    return out


def sweep_band(mesh, mat, path, y, height, thickness, closed=True):
    """Sweep a rectangular section along a closed plan polyline."""
    n = len(path)
    half = thickness / 2
    for i in range(n if closed else n - 1):
        x0, z0 = path[i]
        x1, z1 = path[(i + 1) % n]
        dx, dz = x1 - x0, z1 - z0
        length = math.hypot(dx, dz)
        if length < 1e-6:
            continue
        ox, oz = dz / length, -dx / length
        if (x0 * ox + z0 * oz) < 0:
            ox, oz = -ox, -oz

        def pt(x, z, off, h):
            return (x + ox * off, y + h, z + oz * off)

        a_o, b_o = pt(x0, z0, half, 0.0), pt(x1, z1, half, 0.0)
        a_ot, b_ot = pt(x0, z0, half, height), pt(x1, z1, half, height)
        a_i, b_i = pt(x0, z0, -half, 0.0), pt(x1, z1, -half, 0.0)
        a_it, b_it = pt(x0, z0, -half, height), pt(x1, z1, -half, height)
        mesh.quad(mat, a_o, b_o, b_ot, a_ot)           # outer
        mesh.quad(mat, b_i, a_i, a_it, b_it)           # inner
        mesh.quad(mat, a_ot, b_ot, b_it, a_it)         # cap
        mesh.quad(mat, a_i, b_i, b_o, a_o)             # underside


def slab(mesh, mat, path, y, thickness, trim_mat=None):
    """
    The balcony plate: a fan from the centre out to the parapet line, with the
    brass pinstripe the renders show running along its outer edge.
    """
    n = len(path)
    top, bot = y + thickness, y
    for i in range(n):
        x0, z0 = path[i]
        x1, z1 = path[(i + 1) % n]
        mesh.tri(mat, (0, top, 0), (x0, top, z0), (x1, top, z1))
        mesh.tri(mat, (0, bot, 0), (x1, bot, z1), (x0, bot, z0))
        mesh.quad(mat, (x0, bot + TRIM_H, z0), (x1, bot + TRIM_H, z1),
                  (x1, top, z1), (x0, top, z0))
        if trim_mat:                                    # the bright edge line
            mesh.quad(trim_mat, (x0, bot, z0), (x1, bot, z1),
                      (x1, bot + TRIM_H, z1), (x0, bot + TRIM_H, z0))


def crown_top(t, bays, humps):
    """
    Height of the crown band at position t along a face.

    The renders show a flat band interrupted by raised sections with large
    rounded corners, each carrying signage. A raised cosine gives that shoulder
    without the stepped-box look an approximated curve would have.
    """
    for centre, width in humps:
        d = abs(t - centre)
        if d < width / 2:
            return CROWN_BAND_H + CROWN_HUMP_H * (0.5 + 0.5 * math.cos(math.pi * d / (width / 2) * 0.82))
    return CROWN_BAND_H


def sweep_crown(mesh, frame_mat, panel_mat, trim_mat, path_fn, y, samples, humps):
    """Sweep the crown: a white frame with a dark louvred panel set inside it."""
    pts = [path_fn(i / samples) for i in range(samples + 1)]
    for i in range(samples):
        (x0, z0, ox0, oz0), (x1, z1, ox1, oz1) = pts[i], pts[i + 1]
        h0, h1 = crown_top(i / samples, 0, humps), crown_top((i + 1) / samples, 0, humps)

        def q(off, ha, hb):
            return ((x0 + ox0 * off, y + ha, z0 + oz0 * off),
                    (x1 + ox1 * off, y + hb, z1 + oz1 * off))

        o_lo = q(CROWN_FRAME_T / 2, 0.0, 0.0)
        o_hi = q(CROWN_FRAME_T / 2, h0, h1)
        i_lo = q(-CROWN_FRAME_T / 2, 0.0, 0.0)
        i_hi = q(-CROWN_FRAME_T / 2, h0, h1)
        mesh.quad(frame_mat, o_lo[0], o_lo[1], o_hi[1], o_hi[0])     # outer face
        mesh.quad(frame_mat, o_hi[0], o_hi[1], i_hi[1], i_hi[0])     # cap
        mesh.quad(frame_mat, i_lo[1], i_lo[0], o_lo[0], o_lo[1])     # soffit
        # The dark panel, set back behind the frame and stopping short of its top.
        p_lo = q(-CROWN_FRAME_T / 2 - 0.05, 0.45, 0.45)
        p_hi = q(-CROWN_FRAME_T / 2 - 0.05, h0 - 0.75, h1 - 0.75)
        mesh.quad(panel_mat, p_lo[0], p_lo[1], p_hi[1], p_hi[0])
        # Brass pinstripe following the frame's outer edge.
        t_lo = q(CROWN_FRAME_T / 2 + 0.02, h0 - 0.42, h1 - 0.42)
        t_hi = q(CROWN_FRAME_T / 2 + 0.02, h0 - 0.26, h1 - 0.26)
        mesh.quad(trim_mat, t_lo[0], t_lo[1], t_hi[1], t_hi[0])


def build():
    mesh = Mesh()
    CONCRETE, GLASS, CROWN, DECK, STONE, WATER, PLANT, BRASS = (
        "concrete", "glass", "crown", "deck", "stone", "water", "planting", "brass")

    path = perimeter_path()

    # ── Podium: ground plus three levels, each stepping back ────────────────
    # The renders show three distinct terraced levels, not one plinth. Each one
    # is inset from the one below, and the setback it leaves is a planted
    # terrace, which is what makes the stepping read from a distance.
    # Sized from the aerial: a little wider than the tower and about twice its
    # depth, not the vast apron the first pass drew.
    pod_l, pod_d = LENGTH * 1.10, DEPTH * 1.70
    levels = [(0.0, GROUND_H, 0.0)]
    for i in range(PODIUM_LEVELS):
        levels.append((GROUND_H + i * PODIUM_H, PODIUM_H, 3.2 + i * 3.0))
    for y, h, inset in levels:
        L, D = pod_l - inset * 2, pod_d - inset * 2
        mesh.box(STONE, 0, y, PODIUM_Z, L, h, D)
        # Glazed strip under each slab edge, so the levels do not read as blocks.
        mesh.box(GLASS, 0, y + 0.5, PODIUM_Z, L - 1.2, h - 1.4, D - 1.2)
        if inset > 0:                                   # planted terrace on the setback
            mesh.box(PLANT, 0, y - 0.1, PODIUM_Z + D / 2 + 1.3, L * 0.92, 0.7, 2.4)

    deck_y = TOWER_BASE
    deck_z = PODIUM_Z + DEPTH * 0.52
    mesh.box(DECK, 0, deck_y, deck_z, pod_l - 18, 0.25, DEPTH * 0.62)
    mesh.box(WATER, -LENGTH * 0.14, deck_y + 0.26, deck_z, 22.0, 0.12, 6.5)
    for sx in (-1, 1):
        mesh.box(PLANT, sx * LENGTH * 0.30, deck_y + 0.26, deck_z, 9.0, 0.9, 5.0)

    # ── Tower ───────────────────────────────────────────────────────────────
    for f in range(FLOORS):
        y = TOWER_BASE + f * FLOOR_H
        slab(mesh, CONCRETE, path, y, SLAB_T, trim_mat=BRASS)
        # The glazed envelope, set well back so the balcony reads as a shadow.
        mesh.box(GLASS, 0, y + SLAB_T, 0, CORE_HX * 2, FLOOR_H - SLAB_T, CORE_HZ * 2)
        sweep_band(mesh, CONCRETE, path, y + SLAB_T, PARAPET_H, PARAPET_T)

    # Piers: full height, standing forward of the deepest balcony run, so the
    # facade reads as a frame with the ribbon threading through it.
    pier_h = FLOORS * FLOOR_H + CROWN_BAND_H
    for px, pz in pier_stations():
        mesh.box(CONCRETE, px, TOWER_BASE, pz, PIER_W, pier_h, PIER_W)

    # ── Crown ───────────────────────────────────────────────────────────────
    slab(mesh, CONCRETE, path, TOWER_TOP, SLAB_T, trim_mat=BRASS)
    hx, hz = CORE_HX + BALCONY_DEEP * 0.72, CORE_HZ + BALCONY_DEEP * 0.72

    def face(sign_z):
        def fn(t):
            return (-hx + 2 * hx * t, sign_z * hz, 0.0, float(sign_z))
        return fn

    def end(sign_x):
        def fn(t):
            return (sign_x * hx, hz - 2 * hz * t, float(sign_x), 0.0)
        return fn

    long_humps = [(0.17, 0.26), (0.62, 0.34)]           # as placed in the renders
    short_humps = [(0.5, 0.6)]
    y_crown = TOWER_TOP + SLAB_T
    for fn, humps, n in ((face(1), long_humps, 72), (face(-1), long_humps, 72),
                         (end(1), short_humps, 24), (end(-1), short_humps, 24)):
        sweep_crown(mesh, CONCRETE, CROWN, BRASS, fn, y_crown, n, humps)

    # ── Roof ────────────────────────────────────────────────────────────────
    roof_y = y_crown + 0.4
    mesh.box(STONE, 0, roof_y, 0, hx * 2 - 1.0, 0.3, hz * 2 - 1.0)
    for x, sx, sz in ((-LENGTH * 0.20, 13.0, 8.0), (LENGTH * 0.08, 9.0, 6.5),
                      (LENGTH * 0.30, 6.5, 5.5)):
        mesh.box(STONE, x, roof_y + 0.3, 0, sx, 3.2, sz)

    return mesh


# ── glTF export ──────────────────────────────────────────────────────────────

MATERIALS = {
    # name:        (base colour rgba,              metallic, roughness)
    "concrete":    ((0.900, 0.894, 0.878, 1.0),    0.00, 0.62),
    # Bronze-tinted rather than black: the renders show glazing that catches
    # light, and a near-black value made the facade read as a dark tower.
    "glass":       ((0.232, 0.231, 0.219, 1.0),    0.30, 0.18),
    "crown":       ((0.128, 0.156, 0.145, 1.0),    0.15, 0.40),
    "deck":        ((0.556, 0.431, 0.302, 1.0),    0.00, 0.70),
    "stone":       ((0.839, 0.827, 0.800, 1.0),    0.00, 0.72),
    "water":       ((0.180, 0.580, 0.650, 1.0),    0.10, 0.10),
    "planting":    ((0.247, 0.380, 0.231, 1.0),    0.00, 0.85),
    # The bright line along every balcony edge and around the crown frame.
    "brass":       ((0.776, 0.631, 0.345, 1.0),    0.85, 0.28),
}


def export(mesh, out_path):
    # Centre the model on its own bounds and scale it, in the vertex data itself
    # so the mesh bounds the viewer frames on are the bounds it actually draws.
    xs = [v for g in mesh.groups.values() for v in g["pos"][0::3]]
    ys = [v for g in mesh.groups.values() for v in g["pos"][1::3]]
    zs = [v for g in mesh.groups.values() for v in g["pos"][2::3]]
    cx, cy, cz = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
    for g in mesh.groups.values():
        p = g["pos"]
        for i in range(0, len(p), 3):
            p[i] = (p[i] - cx) * SCALE
            p[i + 1] = (p[i + 1] - cy) * SCALE
            p[i + 2] = (p[i + 2] - cz) * SCALE
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
        # Index the geometry and merge identical vertices. Every face is written
        # with its own flat normal, so corners shared between differently-facing
        # faces stay separate and the hard edges survive — only genuine
        # duplicates collapse. Indices are also what the viewer's glTF loader
        # expects: a non-indexed primitive parsed without complaint and drew
        # nothing at all.
        raw_pos, raw_nrm = g["pos"], g["nrm"]
        lookup, pos, nrm, indices = {}, [], [], []
        for v in range(len(raw_pos) // 3):
            key = (round(raw_pos[v*3], 4), round(raw_pos[v*3+1], 4), round(raw_pos[v*3+2], 4),
                   round(raw_nrm[v*3], 3), round(raw_nrm[v*3+1], 3), round(raw_nrm[v*3+2], 3))
            idx = lookup.get(key)
            if idx is None:
                idx = lookup[key] = len(pos) // 3
                pos.extend(raw_pos[v*3:v*3+3])
                nrm.extend(raw_nrm[v*3:v*3+3])
            indices.append(idx)
        count = len(pos) // 3

        while len(buffers) % 4:
            buffers.append(0)
        wide = count > 65535
        fmt, comp, width = ("<%dI", 5125, 4) if wide else ("<%dH", 5123, 2)
        offset = len(buffers)
        buffers.extend(struct.pack(fmt % len(indices), *indices))
        views.append({"buffer": 0, "byteOffset": offset,
                      "byteLength": len(indices) * width, "target": 34963})
        accessors.append({"bufferView": len(views) - 1, "componentType": comp,
                          "count": len(indices), "type": "SCALAR"})
        index_accessor = len(accessors) - 1

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
                acc["min"] = [float(min(xs)), float(min(ys)), float(min(zs))]
                acc["max"] = [float(max(xs)), float(max(ys)), float(max(zs))]
            accessors.append(acc)

        prims.append({
            "attributes": {"POSITION": len(accessors) - 2, "NORMAL": len(accessors) - 1},
            "indices": index_accessor,
            "material": mat_index[name],
            "mode": 4,
        })

    while len(buffers) % 4:
        buffers.append(0)

    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "aarvasa-reef-996-massing",
            "copyright": ("Aarvasa visual reconstruction from REEF developer renders. "
                          "Not an official developer model. "
                          "Authored at 1:10; metresPerUnit 10."),
        },
        "scene": 0,
        "scenes": [{"nodes": [0], "name": "REEF 996"}],
        # Centre the tower on the origin and sit it on the ground plane, so the
        # viewer's own framing has nothing to correct for.
        # No node transform: the geometry is already centred and scaled, so the
        # bounds the viewer frames on and the bounds it draws are the same.
        "nodes": [{"mesh": 0, "name": "REEF996_massing"}],
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
    print(f"  exported at 1:{METERS_PER_UNIT:.0f} to fit the viewer's {200} m far clip")
