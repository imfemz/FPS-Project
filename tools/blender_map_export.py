# blender_map_export.py — exporte les CUBES de la scène Blender vers shared/map_custom.js
# (format "blocs AABB" du jeu FRACTURE). Édite la map avec des cubes, puis : Blender > onglet Scripting > Run.
#
# CONVENTIONS
#  - 1 unité Blender = 1 mètre. Modélise avec des CUBES alignés sur les axes (la collision est AABB ;
#    une boîte tournée sera approximée par sa boîte englobante).
#  - Repère : X = est/ouest, Y = nord/sud, Z = hauteur (Z-up Blender).  ->  moteur : x=BlenderX, z=BlenderY, hauteur=BlenderZ.
#  - TYPE du bloc = nom du MATÉRIAU (doit contenir : concrete / metal / container / grate). Défaut : concrete.
#  - Couleur custom : propriété personnalisée "c" (entier, ex 4156558 pour 0x3f6f8e) sur l'objet.
#  - Pour n'exporter qu'une collection : mets MAP_COLLECTION = "MAP".
#
import bpy
from mathutils import Vector

# ===== RÉGLAGES =====
OUT_PATH = "/Users/femz/Game Dev/FemzFPS /prototype-web/fps-r184/shared/map_custom.js"  # adapte si besoin
MAP_COLLECTION = None     # ex "MAP" pour filtrer ; None = tous les meshes visibles
FLIP_Z = False            # True si le Nord/Sud apparaît inversé en jeu
KNOWN_TYPES = ("concrete", "metal", "container", "grate")

def obj_type(o):
    if o.active_material and o.active_material.name:
        n = o.active_material.name.lower()
        for t in KNOWN_TYPES:
            if t in n:
                return t
    return "concrete"

def world_aabb(o):
    cs = [o.matrix_world @ Vector(c) for c in o.bound_box]
    mn = Vector((min(c.x for c in cs), min(c.y for c in cs), min(c.z for c in cs)))
    mx = Vector((max(c.x for c in cs), max(c.y for c in cs), max(c.z for c in cs)))
    return mn, mx

def r(v):
    return round(float(v), 2)

def collect():
    if MAP_COLLECTION and MAP_COLLECTION in bpy.data.collections:
        return [o for o in bpy.data.collections[MAP_COLLECTION].all_objects if o.type == 'MESH']
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.visible_get()]

def main():
    rows = []
    for o in collect():
        mn, mx = world_aabb(o)
        cx, cy = (mn.x + mx.x) / 2.0, (mn.y + mx.y) / 2.0
        w, d, h = (mx.x - mn.x), (mx.y - mn.y), (mx.z - mn.z)
        if w < 1e-3 or d < 1e-3 or h < 1e-3:
            continue
        z = -cy if FLIP_Z else cy
        b = {"x": r(cx), "z": r(z), "w": r(w), "h": r(h), "d": r(d), "y0": r(mn.z), "type": obj_type(o)}
        if "c" in o.keys():
            try: b["c"] = int(o["c"]) & 0xffffff
            except Exception: pass
        rows.append(b)

    def js(b):
        p = ["x:%s" % b["x"], "z:%s" % b["z"], "w:%s" % b["w"], "h:%s" % b["h"], "d:%s" % b["d"]]
        if abs(b["y0"]) > 1e-3: p.append("y0:%s" % b["y0"])
        p.append("type:'%s'" % b["type"])
        if "c" in b: p.append("c:0x%06x" % b["c"])
        return "{ " + ", ".join(p) + " }"

    body = ",\n    ".join(js(b) for b in rows)
    out = (
        "/* map_custom.js — généré par tools/blender_map_export.py (%d blocs). Ne pas éditer à la main. */\n"
        "(function (root) {\n"
        "  const BLOCKS = [\n    %s\n  ];\n"
        "  if (typeof module !== 'undefined' && module.exports) module.exports = BLOCKS;\n"
        "  else root.__CUSTOM_BLOCKS = BLOCKS;\n"
        "})(typeof window !== 'undefined' ? window : globalThis);\n"
    ) % (len(rows), body)

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(out)
    print("[FRACTURE] %d blocs exportés -> %s" % (len(rows), OUT_PATH))

main()
