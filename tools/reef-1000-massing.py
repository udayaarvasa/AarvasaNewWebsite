"""REEF 1000 — reference-based visual reconstruction. DRAFT CANDIDATE v0.1.

20 Oct 2026. Not reviewed, not approved, not published. NOT photogrammetry and
never an official model, CAD, BIM or survey: every form is read off two
developer renders and rebuilt by hand.

SOURCES (research/sources/reef-1000/, hashes in docs/reef-portfolio.md):
  F  reefchannelpartners.com/vr/vr1000/images/lastbg.jpg (1600x1905)
     street-corner view of the front (long) face and the west end.
  R  reefchannelpartners.com/vr/vr1000/images/lastbgb.jpg (1600x1905)
     elevated view of the rear: the courtyard, pool deck and car-park ramp.
  T  reefchannelpartners.com/vr/vr1000/ — the developer's interactive tour,
     whose floor picker runs 1-7.
  P  reefdevelopments.ae/projects/reef-1000 — 125 residences, studio to
     2BR duplex (437-1,905 sq.ft).

OBSERVED (F, R, T) and therefore built:
  - A U-shaped plan: a long bar on the street with two wings reaching back
    round a podium courtyard (R shows both wings and the recessed centre).
  - Seven residential levels above the podium (T 1-7; F counts six balcony
    floors plus a top floor; R counts the same on both wings).
  - The top level wrapped in a dark slatted screen under a thin, wide canopy
    roof with REEF signage (F, R); palms planted on the roof (F, R).
  - Wavy-edged balconies on the street face, both ends and the courtyard
    face of the bar (F, R); the wings' rear faces are glazed in a white frame,
    the west wing with a solid white panel beside a single window column (R).
  - One podium storey: glazed ground floor behind a sculpted cream fascia on the
    street (F); a pool deck with planting on the podium roof, and a curved,
    slatted car-park entrance in the rear podium wall (R).

ASSUMED — no source fixes these; each is a recorded estimate:
  - Plan: bar 62 x 15 m, wings 14 m wide reaching 17 m back. Chosen so a
    typical floor holds ~18 homes of the published sizes (125 over 7 floors)
    and to match the render proportions. Perspective views cannot be measured.
  - Heights: 3.3 m floor-to-floor, 3.6 m for the screened top floor, 6.0 m
    podium. The total height is therefore an estimate.
  - Podium footprint 80 x 52 m and its 4 m street setback.
  - Balcony depth (2.0 m) and wave period; the central balcony-free bay.
  - The north and east faces of the podium, which neither render shows.
Portals state "G+6"; T and F show seven residential levels. The conflict is
unresolved, so the record carries buildingConfig: null and this draft follows
the developer's own material (T, F, R).
"""
import json
import math
import struct
import sys

SCALE = 0.1
METERS_PER_UNIT = 1.0 / SCALE

FLOORS = 6                      # balcony floors (observed F, R) ...
TOP_FLOOR = 1                   # ... plus the screened 7th (observed; T 1-7)
FLOOR_H = 3.3                   # assumed
TOP_H = 3.6                     # assumed
PODIUM_H = 6.0                  # assumed
BAR_L, BAR_D = 62.0, 15.0       # assumed (see docstring)
WING_W, WING_D = 14.0, 17.0     # assumed
BALCONY_DEEP = 2.0              # assumed
CANOPY_OVER = 1.8               # observed overhang, size assumed
CANOPY_T = 0.45

# Plan, x along the street, +z towards the street.
BX0, BX1 = -BAR_L / 2, BAR_L / 2
BZ0, BZ1 = 3.0, 3.0 + BAR_D                   # the bar
WZ0 = BZ0 - WING_D                            # wings run back to here
PODIUM = (-40.0, 40.0, -28.0, BZ1 + 4.0)       # x0, x1, z0, z1
BODY_TOP = PODIUM_H + FLOORS * FLOOR_H
ROOF_Y = BODY_TOP + TOP_H


class Mesh:
    """Triangles with flat normals, grouped by material (as tools/reef-998-massing-v3.py)."""

    def __init__(self):
        self.groups = {}

    def tri(self, mat, a, b, c):
        ux, uy, uz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        vx, vy, vz = c[0] - a[0], c[1] - a[1], c[2] - a[2]
        nx, ny, nz = uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        if length < 1e-9:
            return
        n = (nx / length, ny / length, nz / length)
        g = self.groups.setdefault(mat, {"pos": [], "nrm": []})
        for p in (a, b, c):
            g["pos"].extend(p)
            g["nrm"].extend(n)

    def quad(self, mat, a, b, c, d):
        self.tri(mat, a, b, c)
        self.tri(mat, a, c, d)

    def box(self, mat, x0, x1, y0, y1, z0, z1):
        p = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
             (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
        self.quad(mat, p[4], p[7], p[6], p[5])
        self.quad(mat, p[0], p[1], p[2], p[3])
        self.quad(mat, p[0], p[4], p[5], p[1])
        self.quad(mat, p[3], p[2], p[6], p[7])
        self.quad(mat, p[0], p[3], p[7], p[4])
        self.quad(mat, p[1], p[5], p[6], p[2])

    def triangles(self):
        return sum(len(g["pos"]) // 9 for g in self.groups.values())


def u_rects(grow=0.0):
    """The U as three rectangles (x0, x1, z0, z1): the bar and the two wings.

    Rectangles rather than one concave polygon, which a fan triangulation
    cannot fill. Wings meet the bar exactly so no seam shows.
    """
    g = grow
    return [
        (BX0 - g, BX1 + g, BZ0 - g, BZ1 + g),
        (BX0 - g, BX0 + WING_W + g, WZ0 - g, BZ0 - g),
        (BX1 - WING_W - g, BX1 + g, WZ0 - g, BZ0 - g),
    ]


def u_box(mesh, mat, y0, y1, grow=0.0):
    for x0, x1, z0, z1 in u_rects(grow):
        mesh.box(mat, x0, x1, y0, y1, z0, z1)


def wavy_balcony(mesh, a, b, face, y, period=7.5):
    """A balcony along a straight facade run with a gently waving front edge.

    face: (axis, coordinate, outward sign) — e.g. ("z", BZ1, +1) is the street face.
    """
    axis, at, sign = face
    steps = max(4, int(abs(b - a) / 0.75))
    edge = []
    for i in range(steps + 1):
        t = a + (b - a) * i / steps
        d = BALCONY_DEEP * (0.72 + 0.28 * math.sin(2 * math.pi * t / period))
        edge.append((t, at + sign * d))
    def pt(t, d, yy):
        return (t, yy, d) if axis == "z" else (d, yy, t)

    top, bot = y + 0.32, y
    for (t0, s0), (t1, s1) in zip(edge, edge[1:]):
        # Slab top, underside and front edge, each drawn both ways so it reads
        # from any side regardless of which face the run sits on.
        for yy in (top, bot):
            q = [pt(t0, at, yy), pt(t1, at, yy), pt(t1, s1, yy), pt(t0, s0, yy)]
            mesh.quad("concrete", *q)
            mesh.quad("concrete", *q[::-1])
        f = [pt(t0, s0, bot), pt(t1, s1, bot), pt(t1, s1, top), pt(t0, s0, top)]
        mesh.quad("concrete", *f)
        mesh.quad("concrete", *f[::-1])
    # glass rail along the wavy front edge
    for (t0, s0), (t1, s1) in zip(edge, edge[1:]):
        p0 = (t0, s0) if axis == "z" else (s0, t0)
        p1 = (t1, s1) if axis == "z" else (s1, t1)
        mesh.quad("rail", (p0[0], y + 0.32, p0[1]), (p1[0], y + 0.32, p1[1]),
                  (p1[0], y + 1.32, p1[1]), (p0[0], y + 1.32, p0[1]))
        mesh.quad("rail", (p1[0], y + 0.32, p1[1]), (p0[0], y + 0.32, p0[1]),
                  (p0[0], y + 1.32, p0[1]), (p1[0], y + 1.32, p1[1]))


def build():
    m = Mesh()

    # ── Podium: glazed ground floor behind a sculpted fascia; deck on top ──
    x0, x1, z0, z1 = PODIUM
    m.box("stone", x0, x1, 0.0, PODIUM_H - 0.6, z0, z1 - 1.5)                # podium mass
    m.box("glass", x0 + 2, x1 - 2, 0.0, 3.4, z1 - 1.5, z1 - 0.2)              # street glazing
    # The fascia: a cream band whose lower edge sweeps up over the entrance (F).
    steps = 48
    for i in range(steps):
        ta, tb = x0 + (x1 - x0) * i / steps, x0 + (x1 - x0) * (i + 1) / steps
        lift = lambda t: 0.9 * (1 + math.cos(2 * math.pi * (t - 0.0) / 26.0))   # noqa: E731
        ya, yb = 3.4 + lift(ta), 3.4 + lift(tb)
        m.quad("concrete", (ta, ya, z1), (tb, yb, z1), (tb, PODIUM_H, z1), (ta, PODIUM_H, z1))
        m.quad("concrete", (ta, ya, z1 - 1.5), (ta, ya, z1), (tb, yb, z1), (tb, yb, z1 - 1.5))
    m.box("concrete", x0, x1, PODIUM_H - 0.6, PODIUM_H, z0, z1)                 # deck slab
    m.box("deck", x0 + 0.5, x1 - 0.5, PODIUM_H, PODIUM_H + 0.05, z0 + 0.5, z1 - 0.5)
    m.box("concrete", x0, x1, PODIUM_H, PODIUM_H + 1.1, z1 - 0.4, z1)            # street parapet
    m.box("concrete", x0, x1, PODIUM_H, PODIUM_H + 1.1, z0, z0 + 0.4)            # rear parapet
    # Rear car-park entrance: a dark slatted, recessed arc in the podium wall (R).
    for i in range(14):
        a0 = math.pi * (0.15 + 0.7 * i / 14)
        a1 = math.pi * (0.15 + 0.7 * (i + 1) / 14)
        r = 16.0
        p0 = (r * math.cos(a0) * -1, z0 - 0.05 + 1.2 * math.sin(a0) - 1.2)
        p1 = (r * math.cos(a1) * -1, z0 - 0.05 + 1.2 * math.sin(a1) - 1.2)
        m.quad("crown", (p0[0], 1.2, p0[1]), (p1[0], 1.2, p1[1]), (p1[0], PODIUM_H - 0.8, p1[1]), (p0[0], PODIUM_H - 0.8, p0[1]))
    # Courtyard: pool and planting on the deck (R).
    m.box("water", -12.0, 12.0, PODIUM_H, PODIUM_H + 0.12, -22.0, -9.0)
    for px, pz in ((-30, -24), (-20, -25), (20, -25), (30, -24), (-36, 10), (36, 10)):
        m.box("planting", px - 2.2, px + 2.2, PODIUM_H, PODIUM_H + 1.6, pz - 1.6, pz + 1.6)

    # ── Residential floors 1-6: glazed U, slab edges, balconies ──
    for f in range(FLOORS):
        y = PODIUM_H + f * FLOOR_H
        u_box(m, "glass", y, y + FLOOR_H - 0.32)
        u_box(m, "concrete", y + FLOOR_H - 0.32, y + FLOOR_H, grow=0.35)           # slab edge
        by = y + 0.02
        wavy_balcony(m, BX0 + 0.5, -2.5, ("z", BZ1, +1), by)                      # street face, west
        wavy_balcony(m, 2.5, BX1 - 0.5, ("z", BZ1, +1), by)                       # street face, east
        wavy_balcony(m, BZ1 - 0.5, BZ0 + 0.5, ("x", BX0, -1), by, period=6.0)     # west end (F)
        wavy_balcony(m, BZ0 + 0.5, BZ1 - 0.5, ("x", BX1, +1), by, period=6.0)     # east end (R)
        wavy_balcony(m, BX0 + WING_W + 0.8, BX1 - WING_W - 0.8, ("z", BZ0, -1), by)  # courtyard face (R)
    u_box(m, "concrete", PODIUM_H - 0.32, PODIUM_H, grow=0.35)

    # White frames: corner fins on the bar ends and the wing ends (F, R).
    for fx in (BX0 - 0.4, BX1 + 0.4):
        for fz in (BZ1 + 0.4, WZ0 - 0.4):
            m.box("concrete", fx - 0.6, fx + 0.6, PODIUM_H, BODY_TOP, fz - 0.6, fz + 0.6)
    # West wing rear face: a solid white panel beside one window column (R,
    # where the rear view puts west on the right).
    m.box("concrete", BX0 + 6.0, BX0 + WING_W, PODIUM_H, BODY_TOP, WZ0 - 0.35, WZ0 + 0.2)

    # ── Floor 7: dark slatted screen; canopy roof; roof palms ──
    u_box(m, "crown", BODY_TOP, ROOF_Y, grow=-0.6)
    for i in range(0, 62, 2):                                                   # slats on the street face
        sx = BX0 + 0.5 + i
        m.box("brass", sx, sx + 0.18, BODY_TOP + 0.2, ROOF_Y - 0.1, BZ1 - 0.6, BZ1 - 0.25)
    u_box(m, "concrete", ROOF_Y, ROOF_Y + CANOPY_T, grow=CANOPY_OVER)
    for px in range(-26, 27, 6):
        m.box("planting", px - 1.0, px + 1.0, ROOF_Y + CANOPY_T, ROOF_Y + CANOPY_T + 3.0, 9.0, 11.0)
    return m


MATERIALS = {
    "concrete": ((0.920, 0.912, 0.890, 1.0), 0.00, 0.60),
    "glass":    ((0.250, 0.282, 0.300, 1.0), 0.30, 0.15),
    "crown":    ((0.110, 0.120, 0.118, 1.0), 0.15, 0.45),
    "deck":     ((0.700, 0.640, 0.560, 1.0), 0.00, 0.70),
    "stone":    ((0.860, 0.850, 0.820, 1.0), 0.00, 0.72),
    "water":    ((0.200, 0.640, 0.700, 1.0), 0.10, 0.10),
    "planting": ((0.247, 0.400, 0.231, 1.0), 0.00, 0.85),
    "brass":    ((0.560, 0.520, 0.450, 1.0), 0.40, 0.40),
    "rail":     ((0.620, 0.700, 0.730, 0.38), 0.10, 0.08),
}


def export(mesh, out_path):
    """Centred, scaled, indexed GLB — the same layout as the REEF 998 generator."""
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
    buffers, views, accessors, prims, materials, mat_index = bytearray(), [], [], [], [], {}
    for name in sorted(mesh.groups):
        colour, metallic, roughness = MATERIALS[name]
        mat_index[name] = len(materials)
        materials.append({
            "name": name,
            "pbrMetallicRoughness": {"baseColorFactor": list(colour), "metallicFactor": metallic, "roughnessFactor": roughness},
            "doubleSided": False,
            **({"alphaMode": "BLEND"} if colour[3] < 1.0 else {}),
        })
    for name in sorted(mesh.groups):
        raw_pos, raw_nrm = mesh.groups[name]["pos"], mesh.groups[name]["nrm"]
        lookup, pos, nrm, indices = {}, [], [], []
        for v in range(len(raw_pos) // 3):
            key = tuple(round(x, 4) for x in raw_pos[v*3:v*3+3]) + tuple(round(x, 3) for x in raw_nrm[v*3:v*3+3])
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
        views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(indices) * width, "target": 34963})
        accessors.append({"bufferView": len(views) - 1, "componentType": comp, "count": len(indices), "type": "SCALAR"})
        index_accessor = len(accessors) - 1
        for data, kind in ((pos, "POSITION"), (nrm, "NORMAL")):
            while len(buffers) % 4:
                buffers.append(0)
            offset = len(buffers)
            buffers.extend(struct.pack(f"<{len(data)}f", *data))
            views.append({"buffer": 0, "byteOffset": offset, "byteLength": len(data) * 4, "target": 34962})
            acc = {"bufferView": len(views) - 1, "componentType": 5126, "count": count, "type": "VEC3"}
            if kind == "POSITION":
                acc["min"] = [float(min(data[0::3])), float(min(data[1::3])), float(min(data[2::3]))]
                acc["max"] = [float(max(data[0::3])), float(max(data[1::3])), float(max(data[2::3]))]
            accessors.append(acc)
        prims.append({"attributes": {"POSITION": len(accessors) - 2, "NORMAL": len(accessors) - 1},
                      "indices": index_accessor, "material": mat_index[name], "mode": 4})
    while len(buffers) % 4:
        buffers.append(0)
    gltf = {
        "asset": {
            "version": "2.0",
            "generator": "aarvasa-reef-1000-massing 0.1-draft",
            "copyright": ("Aarvasa visual reconstruction (DRAFT) from REEF developer renders. "
                          "Not an official developer model. Authored at 1:10; metresPerUnit 10."),
        },
        "scene": 0,
        "scenes": [{"nodes": [0], "name": "REEF 1000"}],
        "nodes": [{"mesh": 0, "name": "REEF1000_massing"}],
        "meshes": [{"name": "REEF1000", "primitives": prims}],
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
    with open(out_path, "wb") as f:
        f.write(b"glTF" + struct.pack("<II", 2, 12 + len(body)) + body)
    return 12 + len(body)


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "reef-1000-massing.glb"
    m = build()
    size = export(m, out)
    print(f"wrote {out}")
    print(f"  {m.triangles():,} triangles across {len(m.groups)} materials, {size:,} bytes")
    print(f"  podium + {FLOORS} balcony floors + {TOP_FLOOR} screened floor (OBSERVED); "
          f"{ROOF_Y + CANOPY_T:.1f} m to the canopy (ESTIMATED)")
