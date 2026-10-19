"""Offline validation renders of a massing GLB, from fixed named views.

Pure Python + Pillow (no GPU, no numpy) so a render is reproducible anywhere the
generators run. Perspective camera orbiting the model's bounds, flat shading from
one key light plus ambient, painter's-algorithm triangle sort, 2x supersampling.
It is a review tool for silhouette, proportion, banding and crown — not a
beauty render.

  python3 tools/render-glb.py model.glb out-prefix [--views front,side,rear,corner,aerial,street] [--size 900]

Writes <out-prefix>-<view>.png per view. Views are yaw/pitch in degrees around
the model, with yaw 0 looking at the model's +Z face.
"""
import json
import math
import struct
import sys

from PIL import Image, ImageDraw

VIEWS = {
    "front": (0, 8),
    "corner": (35, 12),
    "side": (90, 8),
    "rear": (180, 8),
    "corner-rear": (215, 12),
    "aerial": (30, 55),
    "top": (0, 89),
    "street": (25, 3),
    "sw": (-50, 10),
    "nw": (-130, 10),
}


def load(path):
    data = open(path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    bin_off = 20 + jlen + 8
    binary = data[bin_off:]

    def accessor(i):
        a = gltf["accessors"][i]
        v = gltf["bufferViews"][a["bufferView"]]
        off = v.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = a["count"] * {"SCALAR": 1, "VEC3": 3}[a["type"]]
        fmt = {5126: "f", 5123: "H", 5125: "I"}[a["componentType"]]
        return struct.unpack_from(f"<{n}{fmt}", binary, off)

    tris = []
    for mesh in gltf["meshes"]:
        for prim in mesh["primitives"]:
            pos = accessor(prim["attributes"]["POSITION"])
            idx = accessor(prim["indices"]) if "indices" in prim else range(len(pos) // 3)
            mat = gltf["materials"][prim.get("material", 0)] if "materials" in gltf else {}
            col = mat.get("pbrMetallicRoughness", {}).get("baseColorFactor", [0.8, 0.8, 0.8, 1])
            for t in range(0, len(idx), 3):
                tris.append((tuple(pos[idx[t + k] * 3: idx[t + k] * 3 + 3] for k in range(3)), col))
    return tris


def render(tris, yaw, pitch, size, fov=30.0):
    xs = [p[0] for t, _ in tris for p in t]
    ys = [p[1] for t, _ in tris for p in t]
    zs = [p[2] for t, _ in tris for p in t]
    c = ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2)
    radius = math.sqrt((max(xs) - min(xs)) ** 2 + (max(ys) - min(ys)) ** 2 + (max(zs) - min(zs)) ** 2) / 2
    dist = radius / math.sin(math.radians(fov / 2)) * 1.02
    yr, pr = math.radians(yaw), math.radians(pitch)
    eye = (c[0] + dist * math.cos(pr) * math.sin(yr), c[1] + dist * math.sin(pr), c[2] + dist * math.cos(pr) * math.cos(yr))
    fwd = [c[i] - eye[i] for i in range(3)]
    fl = math.sqrt(sum(v * v for v in fwd)); fwd = [v / fl for v in fwd]
    up0 = (0, 1, 0) if abs(fwd[1]) < 0.99 else (0, 0, -1)
    right = [fwd[1] * up0[2] - fwd[2] * up0[1], fwd[2] * up0[0] - fwd[0] * up0[2], fwd[0] * up0[1] - fwd[1] * up0[0]]
    rl = math.sqrt(sum(v * v for v in right)); right = [v / rl for v in right]
    up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]]
    f = (size / 2) / math.tan(math.radians(fov / 2))
    light = (-0.45, 0.8, 0.4); ll = math.sqrt(sum(v * v for v in light)); light = [v / ll for v in light]

    S = size * 2
    img = Image.new("RGB", (S, S), (236, 233, 226))
    draw = ImageDraw.Draw(img)
    polys = []
    for (a, b, cc), col in tris:
        u = [b[i] - a[i] for i in range(3)]; v = [cc[i] - a[i] for i in range(3)]
        n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
        nl = math.sqrt(sum(x * x for x in n)) or 1; n = [x / nl for x in n]
        centre = [(a[i] + b[i] + cc[i]) / 3 for i in range(3)]
        to_eye = [eye[i] - centre[i] for i in range(3)]
        if sum(n[i] * to_eye[i] for i in range(3)) <= 0:
            continue                                   # back face
        pts, depth = [], 0
        for p in (a, b, cc):
            d = [p[i] - eye[i] for i in range(3)]
            z = sum(d[i] * fwd[i] for i in range(3))
            if z <= 0.01:
                break
            pts.append((S / 2 + 2 * f * sum(d[i] * right[i] for i in range(3)) / z,
                        S / 2 - 2 * f * sum(d[i] * up[i] for i in range(3)) / z))
            depth += z
        if len(pts) < 3:
            continue
        shade = 0.42 + 0.58 * max(0.0, sum(n[i] * light[i] for i in range(3)))
        rgb = tuple(int(255 * min(1.0, (col[i] ** (1 / 2.2)) * shade)) for i in range(3))
        polys.append((depth, pts, rgb))
    polys.sort(key=lambda t: -t[0])
    for _, pts, rgb in polys:
        draw.polygon(pts, fill=rgb)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    path, prefix = sys.argv[1], sys.argv[2]
    views = list(VIEWS)
    size = 900
    if "--views" in sys.argv:
        views = sys.argv[sys.argv.index("--views") + 1].split(",")
    if "--size" in sys.argv:
        size = int(sys.argv[sys.argv.index("--size") + 1])
    tris = load(path)
    for name in views:
        yaw, pitch = VIEWS[name]
        render(tris, yaw, pitch, size).save(f"{prefix}-{name}.png")
        print(f"wrote {prefix}-{name}.png")
