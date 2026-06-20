/* map_custom.js — BLOCS de map exportés depuis Blender (généré par tools/blender_map_export.py).
   Vide par défaut => la map procédurale de map.js est utilisée.
   Après un export Blender, ce fichier contient tes blocs et ils REMPLACENT les blocs par défaut.
   (ramps / plateforme / spawns restent définis dans map.js pour l'instant.) */
(function (root) {
  const BLOCKS = [];   // <-- rempli automatiquement par l'exporteur Blender
  if (typeof module !== 'undefined' && module.exports) module.exports = BLOCKS;
  else root.__CUSTOM_BLOCKS = BLOCKS;
})(typeof window !== 'undefined' ? window : globalThis);
