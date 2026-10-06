#!/usr/bin/env python3
"""Printable kit for the cube lab: every tetracube and pentacube, and every
room of "wrap the room" as a solid (the room's negative, to hold in the hand
and wrap), as STL files and plates that fit a 220 x 220 mm bed.

Each piece: 15 mm cubes, every side pulled in by 0.15 mm of clearance, the
outer (convex) edges and corners chamfered by 0.6 mm, laid with its largest
flat face down where that needs no support (first: fewest cubes over
empty space, then most cubes on the bed, then lowest). Every
mesh is checked closed, manifold and consistently oriented; each plate gets
a preview PNG.

Usage: python3 cube-lab/tools/make-print.py   (needs numpy, manifold3d,
trimesh, matplotlib, and node for the pieces and rooms).
Writes cube-lab/print/*.stl, *.png, report.json, and one zip per kit
(tetracubes.zip, pentacubes.zip, rooms.zip)."""
import itertools
import json
import os
import subprocess
import sys
import zipfile

import numpy as np
import manifold3d as m3
import trimesh
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(HERE)
OUT = os.path.join(LAB, "print")
SIZE, GAP, CHAMFER, BED, SPACE = 15.0, 0.15, 0.6, 220.0, 6.0

data = json.loads(subprocess.check_output(["node", "-e", """
const G = require(process.argv[1] + '/geometry.js'), R = require(process.argv[1] + '/rooms.js');
console.log(JSON.stringify({
  tetra: G.polycubes(4).map(G.orientations),
  penta: G.polycubes(5).map(G.orientations),
  rooms: R.map(r => ({ id: r.id, orients: G.orientations(r.room) }))
}));
""", LAB]))


def lay(orients):
    """The orientation with the fewest cubes over empty space (no support),
    then the most cubes on the bed, then the lowest. Cells come y up; the STL is z up."""
    def score(o):
        cells = {tuple(c) for c in o}
        base = sum(1 for c in o if c[1] == 0)
        over = sum(1 for c in o if c[1] > 0 and (c[0], c[1] - 1, c[2]) not in cells)
        height = max(c[1] for c in o)
        return (over, -base, height)
    best = min(orients, key=score)
    return [(c[0], c[2], c[1]) for c in best], score(best)


def body(cells):
    """The piece pulled in by GAP on every side, exactly: on the grid with
    lines at u, u + g, u + 1 - g of every unit, the small boxes whose middle
    keeps a g-cube around it inside the piece."""
    have = set(map(tuple, cells))
    g = GAP / SIZE
    lo = [min(c[a] for c in cells) for a in range(3)]
    hi = [max(c[a] for c in cells) for a in range(3)]
    lines = []
    for a in range(3):
        l = []
        for u in range(lo[a] - 1, hi[a] + 2):
            l += [u, u + g, u + 1 - g]
        l.append(hi[a] + 2)
        lines.append(l)
    inside = lambda p: (int(np.floor(p[0])), int(np.floor(p[1])), int(np.floor(p[2]))) in have
    boxes = []
    e = 1e-9
    for i in range(len(lines[0]) - 1):
        for j in range(len(lines[1]) - 1):
            for k in range(len(lines[2]) - 1):
                x0, x1 = lines[0][i], lines[0][i + 1]
                y0, y1 = lines[1][j], lines[1][j + 1]
                z0, z1 = lines[2][k], lines[2][k + 1]
                m = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
                if all(inside((m[0] + dx * (g - e), m[1] + dy * (g - e), m[2] + dz * (g - e)))
                       for dx, dy, dz in itertools.product((-1, 1), repeat=3)):
                    boxes.append(m3.Manifold.cube([(x1 - x0) * SIZE, (y1 - y0) * SIZE, (z1 - z0) * SIZE]).translate([x0 * SIZE, y0 * SIZE, z0 * SIZE]))
    return m3.Manifold.batch_boolean(boxes, m3.OpType.Add)


def chamfers(cells):
    """Cutters for the convex edges (one of the four cells around a unit
    edge is in the piece) and convex corners (one of eight), set on the
    pulled-in surface."""
    have = set(map(tuple, cells))
    g, c = GAP, CHAMFER
    cut = []
    for axis in range(3):
        # (o1, o2, axis) in cyclic order, so the map below is a rotation
        o1, o2 = (axis + 1) % 3, (axis + 2) % 3
        seen = set()
        for cell in have:
            for d1, d2 in itertools.product((0, 1), repeat=2):
                # the edge along `axis` at cell[o1] + d1, cell[o2] + d2
                e = list(cell)
                e[o1] += d1
                e[o2] += d2
                key = tuple(e)
                if key in seen:
                    continue
                seen.add(key)
                around = []
                for s1, s2 in itertools.product((-1, 0), repeat=2):
                    q = list(e)
                    q[o1] += s1
                    q[o2] += s2
                    around.append(((s1, s2), tuple(q) in have))
                occ = [s for s, h in around if h]
                if len(occ) != 1:
                    continue
                s1, s2 = occ[0]
                # direction from the edge into the occupied cell
                in1, in2 = (-1 if s1 == -1 else 1), (-1 if s2 == -1 else 1)
                p1 = e[o1] * SIZE + in1 * g
                p2 = e[o2] * SIZE + in2 * g
                # extent along the axis: full where the next edge is convex too
                def convex_at(k):
                    q = list(e)
                    q[axis] += k
                    n = 0
                    for t1, t2 in itertools.product((-1, 0), repeat=2):
                        r = list(q)
                        r[o1] += t1
                        r[o2] += t2
                        n += tuple(r) in have
                    occ_here = list(q)
                    occ_here[o1] += s1
                    occ_here[o2] += s2
                    return n == 1 and tuple(occ_here) in have
                start = e[axis] * SIZE + (0 if convex_at(-1) else g)
                end = (e[axis] + 1) * SIZE - (0 if convex_at(1) else g)
                tri = [(p1, p2), (p1 + in1 * c, p2), (p1, p2 + in2 * c)]
                # extrude the triangle (in o1, o2) along axis
                cs = m3.CrossSection([[(x, y) for x, y in tri]])
                if cs.area() <= 1e-9:
                    cs = m3.CrossSection([[(x, y) for x, y in reversed(tri)]])
                pr = m3.Manifold.extrude(cs, end - start + 0.002).translate([0, 0, start - 0.001])
                # map (x, y, z) of the extrusion to (o1, o2, axis)
                perm = np.zeros((3, 4))
                perm[o1, 0] = 1
                perm[o2, 1] = 1
                perm[axis, 2] = 1
                cut.append(pr.transform(perm.tolist()))
    # convex corners: one of the eight cells around a vertex
    verts = set()
    for cell in have:
        for d in itertools.product((0, 1), repeat=3):
            verts.add(tuple(cell[a] + d[a] for a in range(3)))
    for v in verts:
        occ = [s for s in itertools.product((-1, 0), repeat=3) if tuple(v[a] + s[a] for a in range(3)) in have]
        if len(occ) != 1:
            continue
        s = occ[0]
        inn = [(-1 if s[a] == -1 else 1) for a in range(3)]
        p = [v[a] * SIZE + inn[a] * g for a in range(3)]
        k = c * 1.5
        pts = [p, [p[0] + inn[0] * k, p[1], p[2]], [p[0], p[1] + inn[1] * k, p[2]], [p[0], p[1], p[2] + inn[2] * k]]
        cut.append(m3.Manifold.hull_points(pts))
    return cut


def piece(cells):
    b = body(cells)
    cuts = chamfers(cells)
    if cuts:
        b = b - m3.Manifold.batch_boolean(cuts, m3.OpType.Add)
    return b


def check(man, name, cells):
    mesh = man.to_mesh()
    tm = trimesh.Trimesh(vertices=np.array(mesh.vert_properties)[:, :3], faces=np.array(mesh.tri_verts), process=False)
    n = len(cells)
    full, inner = n * SIZE ** 3, n * (SIZE - 2 * GAP) ** 3 * 0.97
    res = {
        "name": name,
        "status_ok": man.status() == m3.Error.NoError,
        "watertight": bool(tm.is_watertight),
        "winding": bool(tm.is_winding_consistent),
        "volume_mm3": round(float(tm.volume), 1),
        "volume_ok": bool(inner < tm.volume < full),
        "genus": int(man.genus()),
        "triangles": int(len(tm.faces)),
    }
    res["ok"] = res["status_ok"] and res["watertight"] and res["winding"] and res["volume_ok"]
    return tm, res


def write_stl(tm, path):
    tm.export(path)


def plate(items, name):
    """Rows on a BED x BED plate; returns the joined mesh."""
    x = y = row = 0.0
    parts, width = [], 0.0
    for tm in items:
        b = tm.bounds
        w, d = b[1][0] - b[0][0], b[1][1] - b[0][1]
        if x > 0 and x + w > BED:
            x, y, row = 0.0, y + row + SPACE, 0.0
        m = tm.copy()
        m.apply_translation([x - b[0][0], y - b[0][1], -b[0][2]])
        parts.append(m)
        x += w + SPACE
        row = max(row, d)
        width = max(width, x - SPACE)
    depth = y + row
    if width > BED or depth > BED:
        raise SystemExit(f"{name}: plate {width:.0f} x {depth:.0f} mm does not fit")
    return trimesh.util.concatenate(parts), (round(width), round(depth))


def preview(tm, path, title):
    fig = plt.figure(figsize=(6, 6), dpi=120)
    ax = fig.add_subplot(111, projection="3d")
    tri = tm.vertices[tm.faces]
    light = np.array([0.4, -0.5, 0.8])
    light /= np.linalg.norm(light)
    shade = 0.45 + 0.55 * np.clip(tm.face_normals @ light, 0, 1)
    col = np.outer(shade, [0.36, 0.78, 0.96])
    ax.add_collection3d(Poly3DCollection(tri, facecolors=col, edgecolors="none"))
    ax.set_xlim(0, BED); ax.set_ylim(0, BED); ax.set_zlim(0, BED / 3)
    ax.set_box_aspect((1, 1, 1 / 3))
    ax.view_init(elev=38, azim=-60)
    ax.set_title(title, fontsize=10)
    ax.set_xlabel("mm"); ax.set_ylabel("mm")
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


os.makedirs(OUT, exist_ok=True)
report = {"cube_mm": SIZE, "clearance_mm": GAP, "chamfer_mm": CHAMFER, "pieces": [], "plates": []}
groups = {}
for step, name in (("tetra", "tetracube"), ("penta", "pentacube")):
    meshes = []
    for i, orients in enumerate(data[step]):
        cells, score = lay(orients)
        tm, res = check(piece(cells), f"{name}-{i + 1}", cells)
        res["over_empty"], res["on_bed"], res["layers"] = score[0], -score[1], score[2] + 1
        report["pieces"].append(res)
        write_stl(tm, os.path.join(OUT, f"{name}-{i + 1}.stl"))
        meshes.append(tm)
    groups[step] = meshes
rooms = []
for r in data["rooms"]:
    cells, score = lay(r["orients"])
    tm, res = check(piece(cells), f"room-{r['id']}", cells)
    res["over_empty"], res["on_bed"], res["layers"] = score[0], -score[1], score[2] + 1
    report["pieces"].append(res)
    write_stl(tm, os.path.join(OUT, f"room-{r['id']}.stl"))
    rooms.append(tm)

for name, items in (("tetracubes-all", groups["tetra"]), ("pentacubes-a", groups["penta"][:15]),
                    ("pentacubes-b", groups["penta"][15:]), ("rooms-all", rooms)):
    tm, size = plate(items, name)
    write_stl(tm, os.path.join(OUT, f"{name}.stl"))
    preview(tm, os.path.join(OUT, f"{name}.png"), f"{name} · {size[0]} x {size[1]} mm")
    report["plates"].append({"name": name, "pieces": len(items), "mm": size, "watertight": bool(tm.is_watertight)})
    print(f"{name}: {len(items)} pieces, {size[0]} x {size[1]} mm")

# One download per kit: the pieces, their plates and the plates' previews.
for zname, prefixes in (("tetracubes", ("tetracube-", "tetracubes-")), ("pentacubes", ("pentacube-", "pentacubes-")), ("rooms", ("room-", "rooms-"))):
    with zipfile.ZipFile(os.path.join(OUT, zname + ".zip"), "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(os.listdir(OUT)):
            if f.startswith(prefixes) and f.endswith((".stl", ".png")):
                z.write(os.path.join(OUT, f), f)
    print(zname + ".zip", os.path.getsize(os.path.join(OUT, zname + ".zip")) // 1024, "KB")

bad = [p["name"] for p in report["pieces"] if not p["ok"]]
json.dump(report, open(os.path.join(OUT, "report.json"), "w"), indent=1)
print("pieces checked:", len(report["pieces"]), "failing:", bad or "none")
print("cubes over empty space (need a bridge or support):",
      {p["name"]: p["over_empty"] for p in report["pieces"] if p["over_empty"]})
sys.exit(1 if bad else 0)
