"""Approximate HOLM Central study from the developer's three floor-plan sheets.

Plan vertices are traced in sheet coordinates. The plan has no scale or surveyed
orientation. The metre conversion, floor heights and landscaping details are
assumptions. The exported model is for an orbit viewer only.

Usage: python3 tools/holm-central-massing.py path/to/scene.glb
"""
import math
import sys

from massing_glb import Mesh, export, offset_path

# Tower A envelope from the typical even-floor drawing. Tower B mirrors it.
TOWER = [
    (630, 176), (660, 176), (674, 146), (916, 146), (916, 181),
    (936, 191), (936, 267), (900, 267), (898, 333), (824, 333),
    (824, 497), (980, 497), (980, 484), (1060, 484), (1060, 690),
    (690, 690), (690, 628), (630, 628),
]
DECK_Y = 10.3
FLOOR_HEIGHT = 3.2
FLOORS = 8

MATERIALS = {
    "plinth": ((0.32, 0.24, 0.17, 1), 0.12, 0.76),
    "limestone": ((0.68, 0.54, 0.39, 1), 0.06, 0.52),
    "ivory": ((0.87, 0.77, 0.61, 1), 0.06, 0.52),
    "glass": ((0.17, 0.25, 0.28, 1), 0.30, 0.37),
    "balustrade": ((0.28, 0.37, 0.37, 1), 0.28, 0.37),
    "mullions": ((0.28, 0.21, 0.14, 1), 0.32, 0.65),
    "roof": ((0.49, 0.43, 0.36, 1), 0.02, 0.84),
    "paving": ((0.64, 0.57, 0.44, 1), 0.0, 0.82),
    "pool": ((0.025, 0.43, 0.51, 1), 0.22, 0.23),
    "garden": ((0.17, 0.31, 0.13, 1), 0, 0.95),
    "foliage": ((0.23, 0.42, 0.17, 1), 0, 0.98),
    "foliage-dark": ((0.09, 0.23, 0.11, 1), 0, 0.98),
}


def ccw(path):
    signed_area = sum(a[0] * b[1] - a[1] * b[0] for a, b in zip(path, path[1:] + path[:1]))
    return path if signed_area > 0 else path[::-1]


def rounded_corners(path, radius=1.15):
    points = []
    for i, (x, z) in enumerate(path):
        before, after = path[i - 1], path[(i + 1) % len(path)]
        u, v = math.dist((x, z), before), math.dist((x, z), after)
        p = (x + (before[0] - x) * min(radius / u, .38), z + (before[1] - z) * min(radius / u, .38))
        q = (x + (after[0] - x) * min(radius / v, .38), z + (after[1] - z) * min(radius / v, .38))
        for j in range(5):
            t = j / 4
            points.append(tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * b + t ** 2 * c for a, b, c in zip(p, (x, z), q)))
    return points


def turn(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def triangulate(path):
    """Ear clipping for the concave envelopes around each tower's courtyard."""
    points = list(range(len(path)))
    triangles = []
    while len(points) > 3:
        for i, b in enumerate(points):
            a, c = points[i - 1], points[(i + 1) % len(points)]
            pa, pb, pc = path[a], path[b], path[c]
            if turn(pa, pb, pc) <= 1e-8:
                continue
            if any(
                min(turn(pa, pb, path[p]), turn(pb, pc, path[p]), turn(pc, pa, path[p])) >= -1e-8
                for p in points if p not in (a, b, c)
            ):
                continue
            triangles.append((a, b, c))
            del points[i]
            break
        else:
            raise ValueError("Could not triangulate the traced floor polygon")
    return triangles + [tuple(points)]


def solid(mesh, material, path, base, height):
    bottom = [(x, base, z) for x, z in path]
    top = [(x, base + height, z) for x, z in path]
    for a, b, c in triangulate(path):
        mesh.tri(material, top[a], top[c], top[b])
        mesh.tri(material, bottom[a], bottom[b], bottom[c])
    for i, a in enumerate(bottom):
        j = (i + 1) % len(bottom)
        mesh.quad(material, a, top[i], top[j], bottom[j])


def outline(mesh, material, path, base, height):
    for (x, z), (end_x, end_z) in zip(path, path[1:] + path[:1]):
        mesh.quad(material, (x, base, z), (x, base + height, z),
                  (end_x, base + height, end_z), (end_x, base, end_z))
        mesh.quad(material, (end_x, base, end_z), (end_x, base + height, end_z),
                  (x, base + height, z), (x, base, z))


def oval(x, z, rx, rz, phase=0):
    return [
        (x + rx * math.cos(a) * (1 + .11 * math.sin(3 * a + phase)),
         z + rz * math.sin(a) * (1 + .14 * math.sin(3 * a + phase)))
        for a in (i * math.tau / 36 for i in range(36))
    ]


def tree(mesh, x, z, height, material):
    mesh.box("mullions", x, DECK_Y, z, .27, height, .27)
    mesh.prism(material, oval(x, z, height * .43, height * .38), DECK_Y + height * .6, height * .48)
    mesh.prism(material, oval(x, z, height * .30, height * .29), DECK_Y + height * 1.08, height * .33)


def tower(mesh, traced, mirrored):
    original = ccw([((1130 - x if mirrored else x - 1130) * .113, (418 - z) * .113) for x, z in traced])
    def band(distance):
        return rounded_corners(offset_path(original, -distance))

    glazing = band(-1.0)
    for level in range(FLOORS):
        height = DECK_Y + level * FLOOR_HEIGHT
        ledge = .22 if level % 2 else .62
        slab = band(ledge)
        solid(mesh, "ivory", slab, height, .34)
        outline(mesh, "balustrade", band(ledge - .13), height + .34, .65)
        solid(mesh, "glass", glazing, height + .34, FLOOR_HEIGHT - .34)
        for (x, z), (u, v) in zip(glazing, glazing[1:] + glazing[:1]):
            length = math.hypot(u - x, v - z)
            for bay in range(1, int(length // 3.0) + 1):
                t = bay / (int(length // 3.0) + 1)
                mesh.box("ivory" if bay % 3 == 0 else "mullions",
                         x + t * (u - x), height + .33, z + t * (v - z),
                         .24, FLOOR_HEIGHT - .32, .24)
    roof_y = DECK_Y + FLOORS * FLOOR_HEIGHT
    solid(mesh, "ivory", band(.16), roof_y, .53)
    solid(mesh, "roof", band(-1), roof_y + .53, .16)
    outline(mesh, "limestone", band(-.34), roof_y + .53, .92)
    side = 1 if mirrored else -1
    for x, z, sx, sz in ((49, -8, 9, 18), (41, -23, 12, 6), (45, 22, 8, 6)):
        mesh.box("roof", side * x, roof_y + .66, z, sx, 1.2, sz)


def build():
    mesh = Mesh()
    podium = ccw([(-57, -32), (57, -32), (58, 30), (-58, 30)])
    podium = rounded_corners(podium, 3)
    solid(mesh, "plinth", offset_path(podium, .28), 0, .55)
    solid(mesh, "glass", offset_path(podium, .42), .55, DECK_Y - .74)
    for base in (3.0, 6.3, DECK_Y - .6):
        solid(mesh, "limestone", offset_path(podium, .17), base, .57)
    for x in range(-54, 55, 3):
        for side in (-1, 1):
            mesh.box("limestone", x, .55, 29.72 if side == 1 else -31.72, .44, 9.1, .7)
    for z in range(-27, 27, 3):
        for side in (-1, 1):
            mesh.box("limestone", 57.2 * side, .55, z, .78, 9.1, .44)
    solid(mesh, "paving", podium, DECK_Y - .07, .07)

    # The pool and winding garden paths occupy the gap between the two wings.
    for x, z, rx, rz, phase in ((-.7, 20.0, 7.5, 10, .6), (-8.5, 13.0, 2.8, 2.8, 2)):
        solid(mesh, "ivory", oval(x, z, rx + .58, rz + .58, phase), DECK_Y, .06)
        solid(mesh, "pool", oval(x, z, rx, rz, phase), DECK_Y + .06, .018)
    for x, z, rx, rz, phase in ((-19, -.5, 7.8, 7.1, 1.1), (20, -1.5, 7.5, 6.2, 2.8),
                               (1, -10, 5.7, 7.1, 1.9), (4, -23, 3.6, 4.1, 2)):
        solid(mesh, "garden", oval(x, z, rx, rz, phase), DECK_Y + .02, .31)
    for i, (x, z) in enumerate([(-14, 25), (10, 26), (-14, 15), (12, 12), (-19, 6),
                                  (18, 5), (-20, -1), (23, -3), (-17, -6), (15, -7),
                                  (-4, -13), (5, -14), (-2, -22), (3, -25), (8, -25)]):
        tree(mesh, x, z, 2.2 + (i % 5) * .33, "foliage-dark" if i % 3 == 0 else "foliage")
    tower(mesh, TOWER, False)
    tower(mesh, TOWER, True)
    return mesh


if __name__ == "__main__":
    model = build()
    size = export(model, sys.argv[1], materials=MATERIALS, scale=.1,
                  generator="Aarvasa HOLM Central reconstruction 1.0.0",
                  scene_name="HOLM Central exterior study",
                  copyright_text="Aarvasa exterior study from HOLM marketing plans and renders")
    print(f"{size:,} bytes, {model.triangles():,} triangles")
