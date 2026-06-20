# Éditer la map dans Blender → réimporter dans FRACTURE

La map du jeu est de la **géométrie AABB** (boîtes alignées sur les axes) : chaque mur/caisse/structure
est un bloc `{ x, z, w, h, d, y0, type }`. Ce workflow te laisse **modéliser la map avec des cubes dans
Blender** et la réinjecter dans le jeu, sans casser la collision (qui reste AABB, rapide).

## 1. Modéliser
- 1 unité Blender = **1 mètre**. La map fait 90×90 (de -45 à +45 en X et Y).
- Utilise des **CUBES alignés sur les axes** (pas de rotation libre : une boîte tournée serait approximée
  par sa boîte englobante).
- Repère : **X = est/ouest, Y = nord/sud, Z = hauteur**.
- Le **type** (matériau du jeu) vient du **nom du matériau** du cube : il doit contenir
  `concrete`, `metal`, `container` ou `grate` (sinon `concrete` par défaut).
- Couleur custom (optionnel) : ajoute une **propriété personnalisée** `c` à l'objet (entier, ex `4156558`).

## 2. Exporter
- Ouvre l'onglet **Scripting** dans Blender, ouvre `tools/blender_map_export.py`, vérifie `OUT_PATH`
  (le chemin de `shared/map_custom.js`), puis **Run** (▶).
- Le script écrit `shared/map_custom.js` avec tes blocs.

## 3. Réimporter dans le jeu
- **Recharge la page** (client) — tes blocs remplacent la map par défaut.
- Si tu joues en ligne / mode bots : **redémarre le serveur** (`npm start`) car il valide les tirs
  contre la map.

## Limites (v1)
- Seuls les **blocs** sont exportés. Les **rampes**, la **plateforme centrale** et les **spawns**
  restent définis à la main dans `shared/map.js` (on pourra les ajouter ensuite : Empties nommés `spawn`, etc.).
- Pour revenir à la map d'origine : vide `BLOCKS` dans `shared/map_custom.js` (ou supprime le fichier).
