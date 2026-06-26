/* Carte partagée serveur/client — COMPLEXE INDUSTRIEL (acier + béton, néons froids)
   - 90×90 (HALF=45), MIROIR Nord/Sud : les deux bases sont identiques (équitable 1v1).
   - Forte verticalité : toits MARCHABLES (h5) + PASSERELLES (on marche dessus ET on court dessous, via y0).
   - Structures HAUTES (h≥5) pour enchaîner wall-bounce / wall-climb.
   - Petites CAISSES (h≈0.9–1.2) pour le bunny hop.
   - COULOIRS latéraux le long de l'enceinte pour le combat rapproché (CQB).

   ⚙️ DEUX VARIANTES exposées via makeMAP(useBig) :
     - useBig=false → "MAP 2" = ce complexe industriel HALF=45 (1v1 + entraînement).
     - useBig=true  → "GRANDE MAP" = export Blender map_custom.js HALF=109 (mode INSANE).
   Le DÉFAUT (et le serveur, pour le 1v1) = MAP 2 (arène HALF=45).

   Schéma d'un bloc (AABB) :
     { x, z, w, h, d,           position centre + dimensions
       y0?,                     bas du volume (défaut 0). y0>0 = volume FLOTTANT (passerelle/parapet) : on passe dessous.
       type?,                   'concrete' | 'metal' | 'container' | 'grate'  (pilote le matériau)
       c?,                      couleur override (sinon couleur par défaut du type)
       glow?, gc?, light?,      liseré émissif ('top'|'edge'|'side'), couleur néon, +PointLight si light:true
       rail? }                  garde-corps émissifs (passerelles)
*/
(function (root) {
  const HALF = 45;

  // Map personnalisee (exportee depuis Blender via tools/blender_map_export.py) : utilisee SEULEMENT
  // par la variante "grande map" (makeMAP(true)). Le 1v1/entrainement gardent l'arene HALF=45.
  let CUSTOM = null;
  try { if (typeof module !== 'undefined' && module.exports) CUSTOM = require('./map_custom.js'); } catch (e) {}
  if (!CUSTOM && root) CUSTOM = root.__CUSTOM_MAP || root.__CUSTOM_BLOCKS || null;
  if (Array.isArray(CUSTOM)) CUSTOM = { BLOCKS: CUSTOM };   // compat ancien format (tableau de blocs)

  // Couleurs conteneurs (acier peint) + néons
  const RUST = 0x9e4b39, BLUE = 0x3f6f8e, AMBER = 0x9c7d3a, GREEN = 0x4f7a55;
  const CYAN = 0x59d8ff, WARN = 0xffb000;

  const blocks = [];
  const add = (b) => { blocks.push(b); return b; };
  // Miroir Nord→Sud (z → -z). Géométrie identique ; l'identité d'équipe vient des spawns, pas des couleurs.
  const mir = (b) => { add(b); add(Object.assign({}, b, { z: -b.z })); return b; };

  // ---------- ENCEINTE (murs externes hauts : h=12) ----------
  mir({ x: 0, z: HALF, w: HALF * 2, h: 12, d: 1.2, type: 'concrete' });   // murs Nord + Sud
  add({ x: HALF, z: 0, w: 1.2, h: 12, d: HALF * 2, type: 'concrete' });   // mur Est
  add({ x: -HALF, z: 0, w: 1.2, h: 12, d: HALF * 2, type: 'concrete' });  // mur Ouest
  // Tours d'angle (perchoirs + wall-bounce)
  mir({ x: 42, z: 42, w: 5, h: 8, d: 5, type: 'concrete' });
  mir({ x: -42, z: 42, w: 5, h: 8, d: 5, type: 'concrete' });

  // ---------- BASES (U ouvert vers le centre, toit marchable à h=5) ----------
  mir({ x: 0, z: 40, w: 20, h: 5, d: 2, type: 'metal' });            // mur de fond
  mir({ x: -13, z: 34, w: 8, h: 5, d: 13, type: 'metal' });          // aile gauche
  mir({ x: 13, z: 34, w: 8, h: 5, d: 13, type: 'metal' });           // aile droite
  // Parapet sur le toit (cover en hauteur + wall-bounce niveau toit) — FLOTTANT (posé sur le toit)
  mir({ x: 0, z: 29.5, w: 16, h: 1.6, y0: 5, d: 0.8, type: 'metal', glow: 'edge', gc: WARN });

  // ---------- PASSERELLES (2e étage : on marche dessus, on court/tire dessous) ----------
  // top = 4.4, dégagement au sol = 4.0 m (on passe largement dessous). Reliées aux toits (h5) et aux marches.
  add({ x: -16, z: 0, w: 3, h: 0.4, y0: 4.0, d: 72, type: 'grate', rail: true, glow: 'edge', gc: CYAN });
  add({ x: 16, z: 0, w: 3, h: 0.4, y0: 4.0, d: 72, type: 'grate', rail: true, glow: 'edge', gc: CYAN });
  add({ x: 0, z: 0, w: 35, h: 0.4, y0: 4.0, d: 3, type: 'grate', rail: true, glow: 'edge', gc: CYAN }); // croix centrale

  // ---------- MARCHES D'ACCÈS aux passerelles (conteneurs étagés : sol → 2.5 → 3.4 → 4.4) ----------
  mir({ x: -13, z: 7, w: 3, h: 2.5, d: 3, type: 'container', c: BLUE });
  mir({ x: 13, z: 7, w: 3, h: 2.5, d: 3, type: 'container', c: BLUE });
  mir({ x: -15, z: 11.5, w: 3, h: 3.4, d: 3, type: 'container', c: RUST });
  mir({ x: 15, z: 11.5, w: 3, h: 3.4, d: 3, type: 'container', c: RUST });

  // ---------- PYLÔNES MID (structures hautes : wall-bounce en plein milieu) ----------
  mir({ x: -24, z: 12, w: 6, h: 5, d: 2.5, type: 'metal' });
  mir({ x: 24, z: 12, w: 6, h: 5, d: 2.5, type: 'metal' });
  mir({ x: -24, z: 24, w: 2.5, h: 5, d: 6, type: 'metal' });
  mir({ x: 24, z: 24, w: 2.5, h: 5, d: 6, type: 'metal' });

  // ---------- CONTENEURS (couverture mi-hauteur, grimpables) ----------
  mir({ x: -8, z: 16, w: 2.4, h: 2.5, d: 6, type: 'container', c: BLUE });
  mir({ x: 8, z: 16, w: 2.4, h: 2.5, d: 6, type: 'container', c: GREEN });
  mir({ x: -30, z: 14, w: 6, h: 2.5, d: 2.4, type: 'container', c: AMBER });
  mir({ x: 30, z: 14, w: 6, h: 2.5, d: 2.4, type: 'container', c: AMBER });

  // ---------- PETITES CAISSES (bunny hop : on les franchit sans casser l'élan) ----------
  mir({ x: -6, z: 8, w: 1.6, h: 1.0, d: 1.6, type: 'container', c: GREEN });
  mir({ x: 6, z: 8, w: 1.6, h: 1.0, d: 1.6, type: 'container', c: AMBER });
  mir({ x: -18, z: 6, w: 1.8, h: 1.1, d: 1.8, type: 'container', c: RUST });
  mir({ x: 18, z: 6, w: 1.8, h: 1.1, d: 1.8, type: 'container', c: BLUE });
  mir({ x: -3, z: 22, w: 2, h: 0.9, d: 2, type: 'container', c: AMBER });
  mir({ x: 3, z: 22, w: 2, h: 0.9, d: 2, type: 'container', c: RUST });
  mir({ x: -12, z: 26, w: 1.8, h: 1.0, d: 1.8, type: 'container', c: GREEN });
  mir({ x: 12, z: 26, w: 1.8, h: 1.0, d: 1.8, type: 'container', c: BLUE });

  // ---------- COULOIRS LATÉRAUX (CQB le long de l'enceinte E/O) ----------
  add({ x: -37, z: 0, w: 2.6, h: 4, d: 9, type: 'container', c: RUST });
  add({ x: 37, z: 0, w: 2.6, h: 4, d: 9, type: 'container', c: RUST });
  mir({ x: -37, z: 22, w: 2.6, h: 4, d: 9, type: 'container', c: BLUE });
  mir({ x: 37, z: 22, w: 2.6, h: 4, d: 9, type: 'container', c: BLUE });

  // ---------- PLATEFORME + RAMPES + SPAWNS par défaut (arène HALF=45) ----------
  const defPlatform = { x: 0, z: 0, w: 12, d: 12, h: 1.6 };
  const defRamps = [
    { x: 0, z: -9, w: 8, d: 8, h: 1.6, asc: [0, 1] },
    { x: 0, z: 9, w: 8, d: 8, h: 1.6, asc: [0, -1] },
    { x: 0, z: 33, w: 6, d: 12, h: 5, asc: [0, 1] },
    { x: 0, z: -33, w: 6, d: 12, h: 5, asc: [0, -1] },
  ];
  const defSpawns = [
    [6, 0, 38], [-6, 0, 38], [6, 0, -38], [-6, 0, -38], [30, 0, 0], [-30, 0, 0],
  ].map(([x, y, z]) => [x, y, z, Math.atan2(-x, -z)]);

  // ---------- FABRIQUE de MAP : useBig=false → arène HALF=45 (map 2) ; useBig=true → Blender HALF=109 ----------
  function makeMAP(useBig) {
    const hasCustom = !!(useBig && CUSTOM && Array.isArray(CUSTOM.BLOCKS) && CUSTOM.BLOCKS.length);
    const MAP_HALF = (hasCustom && CUSTOM.HALF) ? CUSTOM.HALF : HALF;
    const finalBlocks = hasCustom ? CUSTOM.BLOCKS : blocks;
    // pas de plateforme centrale sur une map custom (le décor vient de Blender)
    const platform = hasCustom ? { x: 0, z: 0, w: 0, d: 0, h: 0 } : defPlatform;
    const ramps = (hasCustom && Array.isArray(CUSTOM.RAMPS) && CUSTOM.RAMPS.length) ? CUSTOM.RAMPS : defRamps;
    let spawns;
    if (hasCustom && Array.isArray(CUSTOM.SPAWNS) && CUSTOM.SPAWNS.length) spawns = CUSTOM.SPAWNS;
    else if (hasCustom) { const k = MAP_HALF / 45; spawns = defSpawns.map(s => [s[0]*k, s[1], s[2]*k, s[3]]); } // pas de spawns custom -> on étale à l'échelle
    else spawns = defSpawns;

    function groundHeightAt(px, pz) {
      let g = 0;
      const p = platform;
      if (p.w > 0 && Math.abs(px - p.x) <= p.w / 2 && Math.abs(pz - p.z) <= p.d / 2) g = Math.max(g, p.h);
      for (const r of ramps) {
        // emprise stricte de la rampe (pas de marge latérale : on n'escalade pas par le côté)
        if (Math.abs(px - r.x) <= r.w / 2 && Math.abs(pz - r.z) <= r.d / 2) {
          let t;
          if (r.asc[1] === -1) t = (r.z + r.d / 2 - pz) / r.d;
          else if (r.asc[1] === 1) t = (pz - (r.z - r.d / 2)) / r.d;
          else if (r.asc[0] === -1) t = (r.x + r.w / 2 - px) / r.w;
          else t = (px - (r.x - r.w / 2)) / r.w;
          g = Math.max(g, r.h * Math.min(1, Math.max(0, t)));
        }
      }
      return g;
    }
    // Bords latéraux de chaque rampe (murets bloquants pour ne pas la traverser par le côté)
    function rampSideWalls() {
      const walls = [];
      for (const r of ramps) {
        const along = r.asc[1] !== 0; // rampe orientée en z
        if (along) {
          walls.push({ minx: r.x - r.w/2 - 0.25, maxx: r.x - r.w/2 + 0.05, minz: r.z - r.d/2, maxz: r.z + r.d/2, h: r.h });
          walls.push({ minx: r.x + r.w/2 - 0.05, maxx: r.x + r.w/2 + 0.25, minz: r.z - r.d/2, maxz: r.z + r.d/2, h: r.h });
        } else {
          walls.push({ minx: r.x - r.w/2, maxx: r.x + r.w/2, minz: r.z - r.d/2 - 0.25, maxz: r.z - r.d/2 + 0.05, h: r.h });
          walls.push({ minx: r.x - r.w/2, maxx: r.x + r.w/2, minz: r.z + r.d/2 - 0.05, maxz: r.z + r.d/2 + 0.25, h: r.h });
        }
      }
      return walls;
    }

    return { HALF: MAP_HALF, blocks: finalBlocks, platform, ramps, spawns, groundHeightAt, rampSideWalls, big: hasCustom };
  }

  const MAP_ARENA = makeMAP(false);   // MAP 2 (HALF=45) — défaut + serveur 1v1 + entraînement
  const MAP_BIG   = makeMAP(true);    // GRANDE MAP (HALF=109 Blender) — mode INSANE
  const MAP = MAP_ARENA;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MAP;             // serveur (1v1 FFA) = arène HALF=45
  } else {
    root.MAP = MAP;                   // défaut au chargement = arène
    root.MAP_ARENA = MAP_ARENA;
    root.MAP_BIG = MAP_BIG;
    root.makeMAP = makeMAP;
  }
})(typeof window !== 'undefined' ? window : globalThis);
