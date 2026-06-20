# blender_map_export.py — exporte la map Blender vers shared/map_custom.js (format __CUSTOM_MAP de FRACTURE).
# Modélise avec des CUBES, puis : Blender > onglet Scripting > Run (▶).
#
# CONVENTIONS
#  - 1 unité Blender = 1 mètre. X = est/ouest, Y = nord/sud, Z = hauteur (Z-up). -> moteur : x=BlenderX, z=BlenderY, hauteur=BlenderZ.
#  - Boîtes tournées en Z SEULEMENT -> exportées ORIENTÉES (rot = yaw, w/d = dimensions locales). Rotation X/Y -> approx par AABB.
#  - TYPE : nom du MATÉRIAU (concrete/metal/container/crate/grate) sinon nom de l'objet (Container*->container, Crate*->crate, Wall*->concrete, Floor*->metal).
#  - RAMPES : objets "Ramp*" -> rampes marchables. SPAWNS : Empties contenant "spawn".
#  - "Cylinder*" ignoré (gabarit de référence, pas un élément de map).
#
import bpy, math
from mathutils import Vector

OUT_PATH = "/Users/femz/Game Dev/FemzFPS /prototype-web/fps-r184/shared/map_custom.js"
MAP_COLLECTION = None
KNOWN_TYPES = ("concrete", "metal", "container", "crate", "grate")

def obj_type(o):
    if o.active_material and o.active_material.name:
        n = o.active_material.name.lower()
        for t in KNOWN_TYPES:
            if t in n: return t
    n = o.name.lower()
    if "container" in n: return "container"   # conteneur -> container.glb
    if "crate" in n:     return "crate"       # caisse -> crate.glb
    if "wall" in n:  return "concrete"
    if "floor" in n: return "metal"
    return "concrete"

def world_aabb(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    mx = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    return mn, mx, cs

def r(v): return round(float(v), 2)

def meshes():
    objs = (bpy.data.collections[MAP_COLLECTION].all_objects if (MAP_COLLECTION and MAP_COLLECTION in bpy.data.collections) else bpy.context.scene.objects)
    return [o for o in objs if o.type == 'MESH' and o.visible_get() and not o.name.lower().startswith('cylinder')]

def main():
    blocks, ramps = [], []
    gmn = [1e9, 1e9]; gmx = [-1e9, -1e9]
    for o in meshes():
        mn, mx, cs = world_aabb(o)
        w, d, h = (mx.x - mn.x), (mx.y - mn.y), (mx.z - mn.z)
        if w < 1e-3 or d < 1e-3 or h < 1e-3: continue
        cx, cz = (mn.x + mx.x) / 2.0, (mn.y + mx.y) / 2.0
        gmn[0] = min(gmn[0], mn.x); gmn[1] = min(gmn[1], mn.y)
        gmx[0] = max(gmx[0], mx.x); gmx[1] = max(gmx[1], mx.y)
        if o.name.lower().startswith("ramp"):
            lo = min(cs, key=lambda c: c.z); hi = max(cs, key=lambda c: c.z)
            rx, ry = (hi.x - lo.x), (hi.y - lo.y)
            asc = [1 if rx > 0 else -1, 0] if abs(rx) >= abs(ry) else [0, 1 if ry > 0 else -1]
            ramps.append({"x": r(cx), "z": r(cz), "w": r(w), "d": r(d), "h": r(max(1.0, mx.z)), "asc": asc}); continue
        y0 = max(0.0, mn.z)
        if mx.z - y0 < 1e-2: continue
        rz = o.rotation_euler.z
        zonly = abs(o.rotation_euler.x) < 0.01 and abs(o.rotation_euler.y) < 0.01
        if zonly and abs(rz) > 0.01:
            bb = o.bound_box
            lw = (max(c[0] for c in bb) - min(c[0] for c in bb)) * abs(o.scale.x)
            ld = (max(c[1] for c in bb) - min(c[1] for c in bb)) * abs(o.scale.y)
            b = {"x": r(cx), "z": r(cz), "w": r(lw), "h": r(mx.z - y0), "d": r(ld), "y0": r(y0), "type": obj_type(o), "rot": round(float(rz), 4)}
        else:
            b = {"x": r(cx), "z": r(cz), "w": r(w), "h": r(mx.z - y0), "d": r(d), "y0": r(y0), "type": obj_type(o)}
        if "c" in o.keys():
            try: b["c"] = int(o["c"]) & 0xffffff
            except Exception: pass
        blocks.append(b)

    spawns = []
    for o in bpy.context.scene.objects:
        if o.type == 'EMPTY' and "spawn" in o.name.lower():
            x, y, z = o.matrix_world.translation
            spawns.append([r(x), 0, r(y), round(math.atan2(-x, -y), 3)])

    HALF = int(math.ceil(max(abs(gmn[0]), abs(gmx[0]), abs(gmn[1]), abs(gmx[1])) + 8)) if blocks else 45

    def jb(b):
        p = ["x:%s" % b["x"], "z:%s" % b["z"], "w:%s" % b["w"], "h:%s" % b["h"], "d:%s" % b["d"]]
        if abs(b["y0"]) > 1e-3: p.append("y0:%s" % b["y0"])
        p.append("type:'%s'" % b["type"])
        if "rot" in b: p.append("rot:%s" % b["rot"])
        if "c" in b: p.append("c:0x%06x" % b["c"])
        return "{ " + ", ".join(p) + " }"
    def jr(x): return "{ x:%s, z:%s, w:%s, d:%s, h:%s, asc:[%d,%d] }" % (x["x"], x["z"], x["w"], x["d"], x["h"], x["asc"][0], x["asc"][1])
    def jsp(s): return "[%s, %s, %s, %s]" % (s[0], s[1], s[2], s[3])

    out = (
        "/* map_custom.js — genere par tools/blender_map_export.py (HALF=%d, %d blocs, %d rampes, %d spawns). Ne pas editer a la main. */\n"
        "(function (root) {\n  const DATA = {\n    HALF: %d,\n    BLOCKS: [\n      %s\n    ],\n    RAMPS: [\n      %s\n    ],\n    SPAWNS: [%s]\n  };\n"
        "  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;\n  else root.__CUSTOM_MAP = DATA;\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n"
    ) % (HALF, len(blocks), len(ramps), len(spawns), HALF,
         ",\n      ".join(jb(b) for b in blocks),
         ",\n      ".join(jr(x) for x in ramps),
         ", ".join(jsp(s) for s in spawns))
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(out)
    return {"HALF": HALF, "blocks": len(blocks), "ramps": len(ramps), "spawns": len(spawns), "oriented": sum(1 for b in blocks if "rot" in b)}

main()
