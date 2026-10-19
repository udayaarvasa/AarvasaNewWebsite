"""Shared mesh builder and GLB writer for the REEF massing generators.

The same flat-shaded, indexed, 1:10-scaled glTF 2.0 output the 996 and 998 v1
generators write (those keep their own copies so their published checksums stay
reproducible). New generators import this instead of copying it again.
"""
import json
import math
import struct


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
            return
        n = (nx / length, ny / length, nz / length)
        g = self.groups.setdefault(mat, {"pos": [], "nrm": []})
        for p in (a, b, c):
            g["pos"].extend(p)
            g["nrm"].extend(n)

    def quad(self, mat, a, b, c, d):
        self.tri(mat, a, b, c)
        self.tri(mat, a, c, d)

    def box(self, mat, cx, cy, cz, sx, sy, sz):
        """Axis-aligned box; cy is the BASE, not the centre."""
        x0, x1 = cx - sx / 2, cx + sx / 2
        y0, y1 = cy, cy + sy
        z0, z1 = cz - sz / 2, cz + sz / 2
        p = [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1),
             (x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)]
        self.quad(mat, p[4], p[7], p[6], p[5])
        self.quad(mat, p[0], p[1], p[2], p[3])
        self.quad(mat, p[0], p[4], p[5], p[1])
        self.quad(mat, p[3], p[2], p[6], p[7])
        self.quad(mat, p[0], p[3], p[7], p[4])
        self.quad(mat, p[1], p[5], p[6], p[2])

    def prism(self, mat, path, y, height):
        """Extrude a closed counter-clockwise plan polygon (x, z): caps + walls.

        The caps are fanned from the centroid, so `path` must be star-shaped
        about it (true for the rounded rectangles the generators use).
        """
        n = len(path)
        cx = sum(p[0] for p in path) / n
        cz = sum(p[1] for p in path) / n
        top, bot = y + height, y
        for i in range(n):
            x0, z0 = path[i]
            x1, z1 = path[(i + 1) % n]
            self.tri(mat, (cx, top, cz), (x1, top, z1), (x0, top, z0))
            self.tri(mat, (cx, bot, cz), (x0, bot, z0), (x1, bot, z1))
            self.quad(mat, (x0, bot, z0), (x0, top, z0), (x1, top, z1), (x1, bot, z1))

    def triangles(self):
        return sum(len(g["pos"]) // 9 for g in self.groups.values())


def rounded_rect(x0, z0, x1, z1, r, per_corner=6):
    """Counter-clockwise (seen from +Y) rounded rectangle in plan."""
    r = min(r, (x1 - x0) / 2 - 1e-3, (z1 - z0) / 2 - 1e-3)
    centres = [(x1 - r, z1 - r, 0), (x0 + r, z1 - r, 1), (x0 + r, z0 + r, 2), (x1 - r, z0 + r, 3)]
    pts = []
    for cx, cz, q in centres:
        for k in range(per_corner + 1):
            a = (q + k / per_corner) * math.pi / 2
            pts.append((cx + math.cos(a) * r, cz + math.sin(a) * r))
    # walk clockwise in (x, z) == counter-clockwise seen from +Y (z points at the viewer)
    return pts[::-1]


def offset_path(path, d):
    """Offset a closed polygon outward (d > 0) along averaged edge normals."""
    n = len(path)
    out = []
    area = sum(path[i][0] * path[(i + 1) % n][1] - path[(i + 1) % n][0] * path[i][1] for i in range(n))
    sign = 1 if area < 0 else -1
    for i in range(n):
        p0, p1, p2 = path[i - 1], path[i], path[(i + 1) % n]
        nx = nz = 0.0
        for a, b in ((p0, p1), (p1, p2)):
            dx, dz = b[0] - a[0], b[1] - a[1]
            l = math.hypot(dx, dz) or 1
            nx += sign * dz / l
            nz += -sign * dx / l
        l = math.hypot(nx, nz) or 1
        out.append((p1[0] + nx / l * d, p1[1] + nz / l * d))
    return out


def export(mesh, out_path, *, materials, scale, generator, scene_name, copyright_text, center_y=True):
    """Centre on bounds, scale into the vertices, write an indexed GLB. Returns bytes written."""
    xs = [v for g in mesh.groups.values() for v in g["pos"][0::3]]
    ys = [v for g in mesh.groups.values() for v in g["pos"][1::3]]
    zs = [v for g in mesh.groups.values() for v in g["pos"][2::3]]
    cx, cy, cz = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
    if not center_y:
        cy = 0.0
    for g in mesh.groups.values():
        p = g["pos"]
        for i in range(0, len(p), 3):
            p[i] = (p[i] - cx) * scale
            p[i + 1] = (p[i + 1] - cy) * scale
            p[i + 2] = (p[i + 2] - cz) * scale

    buffers, views, accessors, prims, mats = bytearray(), [], [], [], []
    mat_index = {}
    for name in sorted(mesh.groups):
        colour, metallic, roughness = materials[name]
        mat_index[name] = len(mats)
        m = {"name": name, "pbrMetallicRoughness": {"baseColorFactor": list(colour),
             "metallicFactor": metallic, "roughnessFactor": roughness}, "doubleSided": False}
        if colour[3] < 1.0:
            m["alphaMode"] = "BLEND"
        mats.append(m)

    for name in sorted(mesh.groups):
        g = mesh.groups[name]
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
        "asset": {"version": "2.0", "generator": generator, "copyright": copyright_text},
        "scene": 0,
        "scenes": [{"nodes": [0], "name": scene_name}],
        "nodes": [{"mesh": 0, "name": scene_name.replace(" ", "") + "_massing"}],
        "meshes": [{"name": scene_name.replace(" ", ""), "primitives": prims}],
        "materials": mats, "accessors": accessors, "bufferViews": views,
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
