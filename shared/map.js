/* Carte partagée serveur/client — style low-poly nocturne (sable + néons chauds) */
(function (root) {
  const HALF = 34;

  // Blocs AABB : {x,z,w,h,d, c:couleur, glow:'top'|'side'|null, gc:couleur néon}
  const blocks = [
    // Murs d'enceinte
    { x: 0, z: -HALF, w: HALF * 2, h: 5, d: 1, c: 0xb9ab93 },
    { x: 0, z: HALF, w: HALF * 2, h: 5, d: 1, c: 0xb9ab93 },
    { x: -HALF, z: 0, w: 1, h: 5, d: HALF * 2, c: 0xb9ab93 },
    { x: HALF, z: 0, w: 1, h: 5, d: HALF * 2, c: 0xb9ab93 },
    // Murets bas avec liseré néon orange (comme les refs)
    { x: -14, z: -7, w: 11, h: 1.5, d: 1, c: 0xa89a82, glow: 'top', gc: 0xffaa33 },
    { x: 14, z: 7, w: 11, h: 1.5, d: 1, c: 0xa89a82, glow: 'top', gc: 0xffaa33 },
    { x: -7, z: 14, w: 1, h: 1.5, d: 11, c: 0xa89a82, glow: 'top', gc: 0xffaa33 },
    { x: 7, z: -14, w: 1, h: 1.5, d: 11, c: 0xa89a82, glow: 'top', gc: 0xffaa33 },
    // Piliers lumineux
    { x: -9, z: -16, w: 1.5, h: 4.2, d: 1.5, c: 0x7d7264, glow: 'side', gc: 0xffc36b },
    { x: 9, z: 16, w: 1.5, h: 4.2, d: 1.5, c: 0x7d7264, glow: 'side', gc: 0xffc36b },
    { x: 16, z: -9, w: 1.5, h: 4.2, d: 1.5, c: 0x7d7264, glow: 'side', gc: 0xffc36b },
    { x: -16, z: 9, w: 1.5, h: 4.2, d: 1.5, c: 0x7d7264, glow: 'side', gc: 0xffc36b },
    // Caisses de couverture
    { x: -20, z: -20, w: 3, h: 2.1, d: 3, c: 0x9c8f78 },
    { x: 20, z: 20, w: 3, h: 2.1, d: 3, c: 0x9c8f78 },
    { x: -22, z: 12, w: 2, h: 1.3, d: 2, c: 0x8f836e },
    { x: 22, z: -12, w: 2, h: 1.3, d: 2, c: 0x8f836e },
    { x: 12, z: 22, w: 2, h: 1.3, d: 2, c: 0x8f836e },
    { x: -12, z: -22, w: 2, h: 1.3, d: 2, c: 0x8f836e },
    // Cabine de garde + gros blocs d'angle
    { x: -24, z: 24, w: 6, h: 4, d: 5, c: 0xa3957d },
    { x: 24, z: -24, w: 6, h: 4, d: 5, c: 0xa3957d },
    { x: 27, z: 27, w: 4, h: 2.6, d: 4, c: 0x95876f },
    { x: -27, z: -27, w: 4, h: 2.6, d: 4, c: 0x95876f },
  ];

  // Plateforme centrale surélevée (marchable) + rampes d'accès
  const platform = { x: 0, z: 0, w: 10, d: 10, h: 1.4 };
  // asc = direction de montée (vers la plateforme)
  const ramps = [
    { x: 0, z: 8.5, w: 7, d: 7, h: 1.4, asc: [0, -1] },
    { x: 0, z: -8.5, w: 7, d: 7, h: 1.4, asc: [0, 1] },
  ];

  // 6 points de spawn répartis sur le pourtour, chacun orienté vers le centre.
  // (yaw = atan2(-x, -z) pour regarder l'origine.)
  const spawns = [
    [-28, 0,   0,  Math.PI * 0.5],   // ouest
    [ 28, 0,   0, -Math.PI * 0.5],   // est
    [  0, 0, -28,  0],               // sud
    [  0, 0,  28,  Math.PI],         // nord
    [-28, 0,  28,  Math.PI * 0.75],  // nord-ouest
    [ 28, 0, -28, -Math.PI * 0.25],  // sud-est
  ];

  function groundHeightAt(px, pz) {
    let g = 0;
    const p = platform;
    if (Math.abs(px - p.x) <= p.w / 2 && Math.abs(pz - p.z) <= p.d / 2) g = Math.max(g, p.h);
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

  const MAP = { HALF, blocks, platform, ramps, spawns, groundHeightAt, rampSideWalls };
  if (typeof module !== 'undefined' && module.exports) module.exports = MAP;
  else root.MAP = MAP;
})(typeof window !== 'undefined' ? window : globalThis);
