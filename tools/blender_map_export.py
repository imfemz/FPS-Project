# blender_map_export.py — exporte la map Blender vers shared/map_custom.js (format __CUSTOM_MAP de FRACTURE).
# Modélise avec des CUBES, puis : Blender > onglet Scripting > Run (▶).
#
# CONVENTIONS
#  - 1 unité Blender = 1 mètre. Cubes ALIGNÉS sur les axes (une boîte tournée -> approx par sa boîte englobante).
#  - Repère : X = est/ouest, Y = nord/sud, Z = hauteur (Z-up).  ->  moteur : x=BlenderX, z=BlenderY, hauteur=BlenderZ.
#  - TYPE du bloc : depuis le nom du MATÉRIAU (concrete/metal/container/grate) SINON déduit du NOM de l'objet
#    (Crate*->container, Wall*->concrete, Floor*->metal, défaut concrete).
#  - RAMPES : objets nommés "Ramp*" -> converties en rampes MARCHABLES du jeu (pente auto depuis l'inclinaison).
#  - SPAWNS : Empties dont le nom CONTIENT "spawn" -> points d'apparition (orientés vers le centre).
#  - HALF (taille de l'arène) : calculé automatiquement depuis l'étendue de la map.
#  - Couleur custom : propriété perso "c" (entier) sur l'objet.
#
import bpy, math
from mathutils import Vector

OUT_PATH = "/Users/femz/Game Dev/FemzFPS /prototype-web/fps-r184/shared/map_custom.js"
MAP_COLLECTION = None
KNOWN_TYPES = ("concrete", "metal", "container", "grate")

def obj_type(o):
    if o.active_material and o.active_material.name:
        n = o.active_material.name.lower()
        for t in KNOWN_TYPES:
            if t in n:
                return t
    n = o.name.lower()
    if "crate" in n: return "container"
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
    if MAP_COLLECTION and MAP_COLLECTION in bpy.data.collections:
        return [o for o in bpy.data.collections[MAP_COLLECTION].all_objects if o.type == 'MESH' and o.visible_get()]
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.visible_get()]

def main():
    blocks, ramps = [], []
    gmn = [1e9, 1e9]; gmx = [-1e9, -1e9]
    for o in meshes():
        mn, mx, cs = world_aabb(o)
        w, d, h = (mx.x - mn.x), (mx.y - mn.y), (mx.z - mn.z)
        if w < 1e-3 or d < 1e-3 or h < 1e-3:
            continue  # plans/sols plats ignorés (le jeu a son propre sol)
        cx, cz = (mn.x + mx.x) / 2.0, (mn.y + mx.y) / 2.0
        gmn[0] = min(gmn[0], mn.x); gmn[1] = min(gmn[1], mn.y)
        gmx[0] = max(gmx[0], mx.x); gmx[1] = max(gmx[1], mx.y)
        if o.name.lower().startswith("ramp"):
            lo = min(cs, key=lambda c: c.z); hi = max(cs, key=lambda c: c.z)
            rx, ry = (hi.x - lo.x), (hi.y - lo.y)  # direction bas -> haut
            asc = [1 if rx > 0 else -1, 0] if abs(rx) >= abs(ry) else [0, 1 if ry > 0 else -1]
            ramps.append({"x": r(cx), "z": r(cz), "w": r(w), "d": r(d), "h": r(max(1.0, mx.z)), "asc": asc})
            continue
        y0 = max(0.0, mn.z)  # coupe ce qui passe sous le sol
        if mx.z - y0 < 1e-2:
            continue
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
        if "c" in b: p.append("c:0x%06x" % b["c"])
        return "{ " + ", ".join(p) + " }"
    def jr(x): return "{ x:%s, z:%s, w:%s, d:%s, h:%s, asc:[%d,%d] }" % (x["x"], x["z"], x["w"], x["d"], x["h"], x["asc"][0], x["asc"][1])
    def jsp(s): return "[%s, %s, %s, %s]" % (s[0], s[1], s[2], s[3])

    out = (
        "/* map_custom.js — généré par tools/blender_map_export.py (HALF=%d, %d blocs, %d rampes, %d spawns). Ne pas éditer à la main. */\n"
        "(function (root) {\n"
        "  const DATA = {\n"
        "    HALF: %d,\n"
        "    BLOCKS: [\n      %s\n    ],\n"
        "    RAMPS: [\n      %s\n    ],\n"
        "    SPAWNS: [%s]\n"
        "  };\n"
        "  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;\n"
        "  else root.__CUSTOM_MAP = DATA;\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n"
    ) % (HALF, len(blocks), len(ramps), len(spawns), HALF,
         ",\n      ".join(jb(b) for b in blocks),
         ",\n      ".join(jr(x) for x in ramps),
         ", ".join(jsp(s) for s in spawns))

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(out)
    print("[FRACTURE] map exportee: HALF=%d, %d blocs, %d rampes, %d spawns -> %s" % (HALF, len(blocks), len(ramps), len(spawns), OUT_PATH))

main()
