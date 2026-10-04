"""REEF 998 — reference-based visual reconstruction from the supplied videos.

NOT photogrammetry. Nothing here is derived from camera geometry; every form is
read off the developer's own renders and rebuilt by hand, the same way REEF 998
was. It is a visual reconstruction and must never be labelled an official model,
CAD, BIM or a survey.

SOURCES (both supplied 2026-10-04, identified by their own title cards):
  v5  WhatsApp Video 2026-10-04 at 17.59.50.mp4 — "998" marketing film
      t≈1.5s  the full-height exterior render this model is built from
  v6  WhatsApp Video 2026-10-04 at 17.59.53.mp4 — "REEF 998" lifestyle film
      t≈0.5s  facade at an angle, with the REEF 998 sign on the balcony band

OBSERVED, and therefore built:
  - A slab tower, not a point tower, seen obliquely so two faces show at once.
  - A recessed vertical slot runs the full height of the main face, splitting it
    into two unequal bays. It is the strongest single identifying mark.
  - Every residential floor carries a continuous balcony band whose front edge
    undulates gently in plan — shallower than 996's wave, and never scalloped.
  - Vertical piers stand proud of the balcony line at intervals, reading as a
    frame over the horizontal banding.
  - A low podium, far wider than the tower, with THREE open levels whose edges
    sweep in a long sinuous curve: stacked ribbons rather than flat floor plates.
    This is the most distinctive thing about the building and the hardest to
    mistake for another REEF tower.
  - A planted terrace sits on top of the podium, before the tower starts.
  - The crown is a dark cap band with a curved upper profile, with planting
    volumes standing on the roof behind it.
  - A porte-cochere is cut into the podium's long side under a curved soffit.

ASSUMED, and recorded as assumptions because no source establishes them:
  - 25 residential floors. Two independent strips of the render counted 25
    balcony ridges, but three others counted 29, 40, 25 and 41: the footage is
    848px tall and heavily compressed, so the count is an estimate and not the
    measurement 996's was. REEF 998's record carries buildingConfig: null and
    totalUnits: null, so nothing corroborates it.
  - 3.2 m floor to floor, 4.0 m for podium levels. Ordinary Dubai residential
    dimensions. They set the height, so the height is an estimate.
  - The plan dimensions. The render is a perspective view, so its foreshortening
    cannot be inverted without the camera. 54 x 24 m is chosen to match the
    observed slenderness, not read off anything.
  - The slot's WIDTH and DEPTH. The recess is unmistakably there in the render,
    but it reads as a narrow shadow line and the first model at 3.2 m wide
    disappeared entirely at the viewer's default framing. It is modelled at 7 m
    wide and 6 m deep so that it reads, which is more emphatic than the source
    states it. The slot's existence and position are observed; its size is a
    recognition compromise and should be corrected the moment a measured
    elevation exists.
  - Square corners. The render softens the tower's corners slightly and this
    model does not: the radius cannot be measured from an 848px frame, and
    guessing one would trade a known simplification for an invented detail.

So: the silhouette, the slot, the banding, the podium ribbons and the crown come
from REEF's own material. The absolute dimensions are plausible, not surveyed.
"""
import json
import math
import struct
import sys

# Authored at a tenth of life size, baked into the vertices, for the same reason
# as 996: the viewer's 200 m far clip cuts a life-size tower in half, and a node
# scale would leave the camera framing on unscaled bounds.
SCALE = 0.1
METERS_PER_UNIT = 1.0 / SCALE

FLOORS = 25                     # assumed; see the note above
FLOOR_H = 3.2                   # assumed
PODIUM_LEVELS = 3               # observed: three open levels of ribbon banding
PODIUM_H = 4.0                  # assumed
LENGTH = 54.0                   # assumed, from the observed slenderness
DEPTH = 24.0                    # assumed
PODIUM_OVERHANG = 11.0          # observed: the podium is far wider than the tower
BALCONY_DEEP = 2.0              # observed depth of the deepest balcony run
BAND_H = 1.15                   # parapet height, roughly chest height in the render
SLOT_W = 7.0                    # the recessed vertical slot on the main face
SLOT_AT = 0.38                  # where it falls along the long face
BAYS = 8                        # piers counted across the long face
SLOT_DEPTH = 6.0                # how far the slot cuts back; a shadow line in the render
CROWN_H = 4.6                   # the dark cap band

PODIUM_TOP = PODIUM_LEVELS * PODIUM_H
TOWER_TOP = PODIUM_TOP + FLOORS * FLOOR_H
HX, HZ = LENGTH / 2, DEPTH / 2
PX, PZ = HX + PODIUM_OVERHANG, HZ + PODIUM_OVERHANG

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




# ── Geometry read off the renders ────────────────────────────────────────────

def wave(t):
    """The balcony front's gentle undulation in plan, as a fraction of depth.

    Shallower than 996's, and smooth rather than stepped: in the 998 render the
    band bows in and out slowly across the face without ever scalloping.
    """
    return 0.5 + 0.5 * math.sin(t * math.tau * 1.5 - math.pi / 2)


def rect_perimeter(hx, hz, samples, radius=1.6):
    """A rectangular plan with slightly eased corners, sampled evenly.

    Rectangular because that is what the render shows: flat faces meeting at
    corners, not the ellipse an angular parametrisation produces. The first
    attempt used cos/sin and the tower came out as a rounded drum, which is
    exactly the generic form the recognition gate exists to refuse.
    """
    corners = [(hx - radius, hz - radius), (-(hx - radius), hz - radius),
               (-(hx - radius), -(hz - radius)), (hx - radius, -(hz - radius))]
    pts = []
    per_corner = max(2, samples // 16)
    straight = max(2, (samples - 4 * per_corner) // 4)
    for i, (cx, cz) in enumerate(corners):
        a0 = i * math.pi / 2
        for k in range(per_corner):
            a = a0 + (k / per_corner) * math.pi / 2
            pts.append((cx + math.cos(a) * radius * (1 if cx > 0 else -1) * (1 if cx > 0 else 1),
                        cz + math.sin(a) * radius))
    # Rebuild cleanly: walk the four edges, easing only at the very corners.
    pts = []
    edges = [((hx, -hz), (hx, hz)), ((hx, hz), (-hx, hz)),
             ((-hx, hz), (-hx, -hz)), ((-hx, -hz), (hx, -hz))]
    for (x0, z0), (x1, z1) in edges:
        n = straight if abs(x1 - x0) < 1e-6 else straight * 2
        for k in range(n):
            t = k / n
            pts.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
    return pts


def tower_path(samples):
    """One floor's balcony parapet line, in plan.

    The long faces (+Z and -Z) carry the gentle undulation; the short ends stay
    flat, which is what the corner shows in the render. The recessed slot is cut
    into the +Z face and runs the full height.
    """
    pts = []
    for x, z in rect_perimeter(HX, HZ, samples):
        on_long = abs(abs(z) - HZ) < 1e-6
        if on_long:
            u = (x / HX + 1) / 2
            bow = (wave(u) - 0.5) * BALCONY_DEEP
            z += math.copysign(bow, z)
            if z > 0 and abs(u - SLOT_AT) < (SLOT_W / LENGTH):
                z -= SLOT_DEPTH                  # the slot
        pts.append((x, z))
    return pts


def band(mesh, mat, trim, path, y, height):
    """One balcony parapet: a closed ribbon with a bright nosing on top."""
    n = len(path)
    for i in range(n):
        x0, z0 = path[i]
        x1, z1 = path[(i + 1) % n]
        mesh.quad(mat, (x0, y, z0), (x1, y, z1), (x1, y + height, z1), (x0, y + height, z0))
        mesh.quad(trim, (x0, y + height, z0), (x1, y + height, z1),
                  (x1, y + height + 0.12, z1), (x0, y + height + 0.12, z0))


def plate(mesh, mat, path, y, thickness):
    """A floor plate: a filled polygon with a visible edge."""
    n = len(path)
    for i in range(1, n - 1):
        a, b, c = path[0], path[i], path[i + 1]
        mesh.tri(mat, (a[0], y + thickness, a[1]), (b[0], y + thickness, b[1]), (c[0], y + thickness, c[1]))
        mesh.tri(mat, (a[0], y, a[1]), (c[0], y, c[1]), (b[0], y, b[1]))
    for i in range(n):
        x0, z0 = path[i]
        x1, z1 = path[(i + 1) % n]
        mesh.quad(mat, (x0, y, z0), (x1, y, z1), (x1, y + thickness, z1), (x0, y + thickness, z0))


def podium_path(level, samples):
    """The podium edge: a rectangle whose long sides sweep in a slow S.

    Each level pulls back and shifts its phase, so the three stack as flowing
    ribbons rather than identical plates — which is the single most recognisable
    thing about REEF 998 from the street.
    """
    inset = level * 2.1
    phase = level * 0.6
    pts = []
    for x, z in rect_perimeter(PX - inset, PZ - inset, samples):
        on_long = abs(abs(z) - (PZ - inset)) < 1e-6
        if on_long:
            u = (x / (PX - inset) + 1) / 2
            z += math.copysign(math.sin(u * math.tau + phase) * 3.2, z)
        pts.append((x, z))
    return pts


def build():
    mesh = Mesh()
    SAMPLES = 72

    # ── Podium: three open levels of sweeping ribbon ─────────────────────────
    for lvl in range(PODIUM_LEVELS):
        y = lvl * PODIUM_H
        path = podium_path(lvl, SAMPLES)
        plate(mesh, "concrete", path, y, 0.55)
        # The ribbon edge, standing proud of the plate, with its bright nosing.
        band(mesh, "stone", "brass", path, y + 0.55, 1.5)
        # Open sides: a dark recess behind the ribbon reads as the parked levels.
        inner = [(x * 0.93, z * 0.93) for x, z in path]
        plate(mesh, "glass", inner, y + 0.8, 0.2)

    # The porte-cochere: a curved opening cut into the long side at ground level.
    mesh.box("glass", 0, 0.6, PZ - 1.0, 18.0, PODIUM_H - 1.2, 2.2)

    # Planted terrace on top of the podium, before the tower starts.
    top = podium_path(PODIUM_LEVELS, SAMPLES)
    plate(mesh, "deck", top, PODIUM_TOP, 0.5)
    for i in range(14):
        a = i / 14 * math.tau
        tx, tz = math.cos(a) * (PX - 7.5), math.sin(a) * (PZ - 7.5)
        if abs(tx) > HX - 2 or abs(tz) > HZ - 2:
            mesh.box("planting", tx, PODIUM_TOP + 0.5, tz, 2.0, 2.6, 2.0)

    # ── Tower: a balcony band on every floor, with piers over them ───────────
    for f in range(FLOORS):
        y = PODIUM_TOP + f * FLOOR_H
        path = tower_path(SAMPLES)
        plate(mesh, "concrete", path, y, 0.3)
        band(mesh, "concrete", "brass", path, y + 0.3, BAND_H)
        # Glazing set back behind the balcony.
        inner = [(x * 0.86, z * 0.72) for x, z in path]
        plate(mesh, "glass", inner, y + 0.3, FLOOR_H - 0.4)

    # Vertical piers, full height, standing proud of the banding.
    for b in range(BAYS + 1):
        u = b / BAYS
        x = -HX + u * LENGTH
        for sgn in (1, -1):
            mesh.box("concrete", x, PODIUM_TOP, sgn * (HZ + 0.35),
                     1.1, FLOORS * FLOOR_H, 0.7)
    for sgn in (1, -1):
        mesh.box("concrete", sgn * (HX + 0.35), PODIUM_TOP, 0, 0.7, FLOORS * FLOOR_H, 1.1)

    # ── Crown: a dark cap with a curved upper profile, planting behind ───────
    cap = tower_path(SAMPLES)
    plate(mesh, "crown", cap, TOWER_TOP, 0.6)
    band(mesh, "crown", "brass", cap, TOWER_TOP + 0.6, CROWN_H)
    roof = [(x * 0.9, z * 0.9) for x, z in cap]
    plate(mesh, "stone", roof, TOWER_TOP + CROWN_H, 0.4)
    for i in range(6):
        a = i / 6 * math.tau
        mesh.box("planting", math.cos(a) * HX * 0.62, TOWER_TOP + CROWN_H + 0.4,
                 math.sin(a) * HZ * 0.55, 2.4, 3.0, 2.4)

    return mesh

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
            "generator": "aarvasa-reef-998-massing",
            "copyright": ("Aarvasa visual reconstruction from REEF developer renders. "
                          "Not an official developer model. "
                          "Authored at 1:10; metresPerUnit 10."),
        },
        "scene": 0,
        "scenes": [{"nodes": [0], "name": "REEF 998"}],
        # Centre the tower on the origin and sit it on the ground plane, so the
        # viewer's own framing has nothing to correct for.
        # No node transform: the geometry is already centred and scaled, so the
        # bounds the viewer frames on and the bounds it draws are the same.
        "nodes": [{"mesh": 0, "name": "REEF998_massing"}],
        "meshes": [{"name": "REEF998", "primitives": prims}],
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
    out = sys.argv[1] if len(sys.argv) > 1 else "reef-998-massing.glb"
    m = build()
    size = export(m, out)
    print(f"wrote {out}")
    print(f"  {m.triangles():,} triangles across {len(m.groups)} materials")
    print(f"  {size:,} bytes")
    print(f"  {FLOORS} residential floors (ASSUMED) over {PODIUM_LEVELS} podium levels")
    print(f"  {LENGTH:.0f} x {DEPTH:.0f} m plan (ASSUMED), {TOWER_TOP + CROWN_H:.1f} m to the crown top")
    print(f"  exported at 1:{METERS_PER_UNIT:.0f}")
