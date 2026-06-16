/* =====================================================
   NEON COMPOUND — Serveur autoritaire 1v1 + SALON (v7)
   - Jusqu'à 8 connectés : 2 joueurs (sièges) + spectateurs
   - Chacun entre un pseudo ; salon entre les manches :
     2 personnes cliquent JOUER, les autres regardent
   - Le serveur reste autoritaire : PV/shield, dégâts,
     kills, scores, respawn, validation des tirs
   ===================================================== */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const MAP = require('./shared/map.js');
const GAMECFG = require('./shared/config.js');

/* ---------- CONFIG gameplay (autorité serveur) ---------- */
const CONFIG = {
  PORT: process.env.PORT || 3000,
  TICK_MS: 50,              // 20 ticks/s
  WIN_SCORE: 10,
  MAX_HP: 100,
  MAX_SHIELD: 75,
  DMG_BODY: GAMECFG.DAMAGE.BODY,   // réglable dans shared/config.js
  DMG_HEAD: GAMECFG.DAMAGE.HEAD,   // réglable dans shared/config.js
  MIN_SHOT_INTERVAL: Math.floor(GAMECFG.FIRE_RATE * 1000 * 0.8), // suit FIRE_RATE de shared/config.js
  WEAPONS: (GAMECFG.WEAPONS || []).map(w => ({
    body: w.damage_body, head: w.damage_head,
    melee: !!w.melee,
    minInterval: Math.floor((w.fire_rate || GAMECFG.FIRE_RATE) * 1000 * 0.8),
  })),
  MAX_SPEED: GAMECFG.MAX_SPEED_SERVER,
  // Sabre laser (mêlée) — valeurs lues depuis shared/config.js > MELEE
  MELEE: {
    dmg: (GAMECFG.MELEE && GAMECFG.MELEE.damage) || 70,
    range: (GAMECFG.MELEE && GAMECFG.MELEE.range) || 3.2,
    cos: Math.cos((((GAMECFG.MELEE && GAMECFG.MELEE.cone_deg) || 75) * Math.PI / 180) / 2),
    interval: (GAMECFG.MELEE && GAMECFG.MELEE.interval_ms) || 240,
  },
  RESPAWN_MS: 7800,        // couvre tp (~2.6s) + killcam (~3s) + post-kill (~1.5s) + marges
  RESET_MS: 6000,           // durée de l'écran de fin avant retour au salon
  MAX_CLIENTS: 8,
};

/* ---------- Serveur HTTP statique ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.obj': 'text/plain' };
const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const base = url.startsWith('/shared/') ? __dirname : path.join(__dirname, 'public');
  const file = path.join(base, url);
  if (!file.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

/* ---------- Salon & état de partie ---------- */
const clients = new Map(); // id → {id, ws, name, seat:null|0|1}
let nextId = 1;
let seats = [null, null];      // ids des clients assis
let players = [null, null];    // état de match par siège
let scores = [0, 0];
let phase = 'lobby';           // lobby | playing | ended
let orbs = [];                 // orbes de soin lâchées par les morts
let nextOrbId = 1;
let tickN = 0;
// ----- Bot mode -----
let botMode = false;           // true quand une partie solo contre des bots est en cours
let bots = [];                 // entités bots : {id, pos, yaw, hp, sh, dead, anim, mv:{...}}
let nextBotId = 1;
const BOT_COUNT = 4;           // nombre de bots simultanés
const BOT_SPEED = 1.6;         // vitesse de déplacement (lente)
const BOT_STRAFE_TIME = [1.2, 2.6]; // durée min/max d'un strafe avant de changer de direction

function send(c, msg) { if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function broadcast(msg) { for (const c of clients.values()) send(c, msg); }
function broadcastExcept(id, msg) { for (const c of clients.values()) if (c.id !== id) send(c, msg); }
function seatName(s) { const c = seats[s] && clients.get(seats[s]); return c ? c.name : 'Joueur ' + (s + 1); }
function rosterMsg() {
  return { t: 'roster', phase, seatNames: [seatName(0), seatName(1)],
    clients: [...clients.values()].map(c => ({ id: c.id, name: c.name, seat: c.seat })) };
}
function broadcastRoster() { broadcast(rosterMsg()); }
function startInfo(countdown) {
  return { t: 'start', spawns: MAP.spawns, countdown, orbs,
    seats: { 0: { id: seats[0], name: seatName(0) }, 1: { id: seats[1], name: seatName(1) } } };
}
function makePlayerState(seat) {
  const s = MAP.spawns[seat];
  return { pos: [s[0], 0, s[2]], yaw: s[3], pitch: 0,
    anim: { m: 0, c: 0, a: 0, r: 0, sl: 0, h: 0, cl: 0, f: 0, ad: 0 },
    hp: CONFIG.MAX_HP, sh: CONFIG.MAX_SHIELD, dead: false,
    weaponIdx: 0, lastShot: 0, lastMelee: 0, lastStateAt: Date.now(),
    // historique horodaté des positions pour la compensation de latence (lag comp)
    history: [] };
}
// Enregistre la position actuelle d'un joueur dans son historique (purge > 600ms)
function recordHistory(p, now) {
  p.history.push({ t: now, pos: [p.pos[0], p.pos[1], p.pos[2]], crouch: p.anim.c ? 1 : 0 });
  const cutoff = now - 600;
  while (p.history.length && p.history[0].t < cutoff) p.history.shift();
}
// Renvoie la position interpolée d'un joueur à un instant passé (rembobinage)
function rewindPos(p, when) {
  const h = p.history;
  if (!h.length) return { pos: [p.pos[0], p.pos[1], p.pos[2]], crouch: p.anim.c ? 1 : 0 };
  if (when >= h[h.length - 1].t) { const e = h[h.length - 1]; return { pos: e.pos.slice(), crouch: e.crouch }; }
  if (when <= h[0].t) { const e = h[0]; return { pos: e.pos.slice(), crouch: e.crouch }; }
  for (let i = 0; i < h.length - 1; i++) {
    if (when >= h[i].t && when <= h[i + 1].t) {
      const span = Math.max(1, h[i + 1].t - h[i].t);
      const k = (when - h[i].t) / span;
      const a = h[i], b = h[i + 1];
      return {
        pos: [a.pos[0] + (b.pos[0] - a.pos[0]) * k,
              a.pos[1] + (b.pos[1] - a.pos[1]) * k,
              a.pos[2] + (b.pos[2] - a.pos[2]) * k],
        crouch: k < 0.5 ? a.crouch : b.crouch,
      };
    }
  }
  const e = h[h.length - 1]; return { pos: e.pos.slice(), crouch: e.crouch };
}
function startMatch() {
  phase = 'playing'; scores = [0, 0]; orbs = [];
  players = [makePlayerState(0), makePlayerState(1)];
  broadcast(startInfo(3));
}
function endToLobby() {
  phase = 'lobby';
  for (const c of clients.values()) c.seat = null;
  seats = [null, null]; players = [null, null]; scores = [0, 0]; orbs = [];
  botMode = false; bots = [];
  broadcastRoster();
}

/* ---------- Bot mode ---------- */
function randSpawnAround(center, minR, maxR) {
  // position aléatoire dans un anneau autour d'un centre, dans les limites de la map
  for (let i = 0; i < 20; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = center[0] + Math.cos(ang) * r;
    const z = center[2] + Math.sin(ang) * r;
    if (Math.abs(x) < MAP.HALF - 2 && Math.abs(z) < MAP.HALF - 2 && !botBlocked(x, z)) return [x, 0, z];
  }
  return [center[0], 0, center[2] + minR];
}
function makeBot(center) {
  const pos = randSpawnAround(center, 6, 14);
  // le bot regarde vers le joueur
  const yaw = Math.atan2(center[0] - pos[0], center[2] - pos[2]);
  return {
    id: nextBotId++, pos, yaw,
    hp: CONFIG.MAX_HP, sh: CONFIG.MAX_SHIELD, dead: false,
    anim: { m: 0, c: 0, a: 0, r: 0, sl: 0, h: 0, cl: 0, f: 0, ad: 0 },
    history: [],
    mv: { dir: Math.random() < 0.5 ? 1 : -1, timer: 0, dur: rand(BOT_STRAFE_TIME[0], BOT_STRAFE_TIME[1]) },
  };
}
function rand(a, b) { return a + Math.random() * (b - a); }
function startBotMode(humanSeat) {
  botMode = true; phase = 'playing'; scores = [0, 0]; orbs = [];
  players = [null, null];
  players[humanSeat] = makePlayerState(humanSeat);
  const center = players[humanSeat].pos;
  bots = [];
  for (let i = 0; i < BOT_COUNT; i++) bots.push(makeBot(center));
  broadcast(botStartInfo(humanSeat));
}
function botStartInfo(humanSeat) {
  return {
    t: 'botstart', humanSeat,
    spawns: MAP.spawns, countdown: 1,
    bots: bots.map((b) => ({ id: b.id, p: b.pos, yaw: b.yaw })),
  };
}
function respawnBot(b) {
  const human = players[0] || players[1];
  const center = human ? human.pos : [0, 0, 0];
  const np = randSpawnAround(center, 8, 16);
  b.pos = np;
  b.yaw = Math.atan2(center[0] - np[0], center[2] - np[2]);
  b.hp = CONFIG.MAX_HP; b.sh = CONFIG.MAX_SHIELD; b.dead = false;
  b.history = [];
  b.mv = { dir: Math.random() < 0.5 ? 1 : -1, timer: 0, dur: rand(BOT_STRAFE_TIME[0], BOT_STRAFE_TIME[1]) };
  broadcast({ t: 'botrespawn', id: b.id, p: b.pos, yaw: b.yaw });
}
// IA très simple : strafe gauche/droite lent, face au joueur
function updateBots(dt) {
  const human = players[0] || players[1];
  const center = human ? human.pos : [0, 0, 0];
  for (const b of bots) {
    if (b.dead) continue;
    // toujours regarder vers le joueur
    b.yaw = Math.atan2(center[0] - b.pos[0], center[2] - b.pos[2]);
    // strafe : on se déplace perpendiculairement à la direction du joueur
    b.mv.timer += dt;
    if (b.mv.timer >= b.mv.dur) { b.mv.dir *= -1; b.mv.timer = 0; b.mv.dur = rand(BOT_STRAFE_TIME[0], BOT_STRAFE_TIME[1]); }
    const strafeX = Math.cos(b.yaw) * b.mv.dir;   // perpendiculaire au regard
    const strafeZ = -Math.sin(b.yaw) * b.mv.dir;
    let nx = b.pos[0] + strafeX * BOT_SPEED * dt;
    let nz = b.pos[2] + strafeZ * BOT_SPEED * dt;
    let moved = false;
    // bord de map : on inverse la direction de strafe
    if (Math.abs(nx) > MAP.HALF - 2 || Math.abs(nz) > MAP.HALF - 2) {
      b.mv.dir *= -1; b.mv.timer = 0;
    } else if (!botBlocked(nx, nz)) {
      b.pos[0] = nx; b.pos[2] = nz; moved = true;          // chemin libre
    } else if (!botBlocked(nx, b.pos[2])) {
      b.pos[0] = nx; moved = true;                          // glisse le long de l'obstacle (axe X)
    } else if (!botBlocked(b.pos[0], nz)) {
      b.pos[2] = nz; moved = true;                          // glisse le long de l'obstacle (axe Z)
    } else {
      b.mv.dir *= -1; b.mv.timer = 0;                       // coincé dans un coin → demi-tour
    }
    b.pos[1] = 0;
    b.anim.m = moved ? 0.5 : 0; // marche seulement si on a réellement bougé
  }
}

/* ---------- Maths : rayons (inchangé) ---------- */
function rayAABB(o, d, b) {
  let tmin = 0, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < b.min[i] || o[i] > b.max[i]) return null;
    } else {
      let t1 = (b.min[i] - o[i]) / d[i], t2 = (b.max[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin >= 0 ? tmin : null;
}
const AABBS = [
  ...MAP.blocks.map((b) => ({
    min: [b.x - b.w / 2, 0, b.z - b.d / 2],
    max: [b.x + b.w / 2, b.h, b.z + b.d / 2],
  })),
  {
    min: [MAP.platform.x - MAP.platform.w / 2, 0, MAP.platform.z - MAP.platform.d / 2],
    max: [MAP.platform.x + MAP.platform.w / 2, MAP.platform.h, MAP.platform.z + MAP.platform.d / 2],
  },
];
function losBlockedBefore(o, d, maxT) {
  for (const b of AABBS) {
    const t = rayAABB(o, d, b);
    if (t !== null && t < maxT - 0.05) return true;
  }
  return false;
}
// Collision bot ↔ structures : empêche les bots de traverser caisses / murs / plateforme.
// On teste l'empreinte au sol (x,z) de chaque AABB, élargie du rayon du bot.
const BOT_RADIUS = 0.45;
function botBlocked(x, z) {
  for (const b of AABBS) {
    if (b.max[1] <= 0.25) continue; // surface au ras du sol → on l'ignore (on peut marcher dessus)
    if (x > b.min[0] - BOT_RADIUS && x < b.max[0] + BOT_RADIUS &&
        z > b.min[2] - BOT_RADIUS && z < b.max[2] + BOT_RADIUS) return true;
  }
  return false;
}
function rayCapsule(o, d, target, rewind) {
  // rewind (optionnel) = { pos:[x,y,z], crouch } : position rembobinée pour la lag comp.
  const tpos = rewind ? rewind.pos : target.pos;
  const lowered = rewind ? rewind.crouch : (target.anim.c || target.anim.sl);
  const ground = tpos[1] || 0;
  // Dimensions de la hitbox depuis la config, multipliées par l'échelle du perso (la
  // hitbox suit donc character_scale). Valeurs par défaut si la config est absente.
  const M = (GAMECFG.MODELS) || {};
  const HB = M.hitbox || {};
  const sc = M.character_scale || 1;
  const R = (HB.radius != null ? HB.radius : 0.32) * sc;
  const bottom = (HB.bottom != null ? HB.bottom : 0.10) * sc;
  const topStand = (HB.top != null ? HB.top : 1.80) * sc;
  const topCrouch = (HB.top_crouch != null ? HB.top_crouch : 1.15) * sc;
  const headThick = (HB.head != null ? HB.head : 0.30) * sc;
  const a = [tpos[0], ground + bottom, tpos[2]];
  const top = ground + (lowered ? topCrouch : topStand);
  const segY = top - a[1];
  const w0 = [o[0] - a[0], o[1] - a[1], o[2] - a[2]];
  const A = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const B = d[1] * segY;
  const C = segY * segY;
  const D = d[0] * w0[0] + d[1] * w0[1] + d[2] * w0[2];
  const E = segY * w0[1];
  const denom = A * C - B * B;
  let s;
  if (denom < 1e-8) s = 0;
  else s = (A * E - B * D) / denom;
  s = Math.min(1, Math.max(0, s));
  const t = -(d[0] * w0[0] + d[1] * (w0[1] - s * segY) + d[2] * w0[2]) / A;
  if (t < 0) return null;
  const px = o[0] + d[0] * t - a[0];
  const py = o[1] + d[1] * t - (a[1] + s * segY);
  const pz = o[2] + d[2] * t - a[2];
  if (px * px + py * py + pz * pz > R * R) return null;
  return { t, y: a[1] + s * segY, headLine: top - headThick };
}
function applyDamage(target, dmg) {
  let rest = dmg;
  if (target.sh > 0) {
    const absorbed = Math.min(target.sh, rest);
    target.sh -= absorbed; rest -= absorbed;
  }
  if (rest > 0) target.hp -= rest;
}

/* ---------- Manche ---------- */
function respawn(seat) {
  const p = players[seat]; if (!p) return;
  const other = players[1 - seat];
  let best = MAP.spawns[0], bd = -1;
  for (const s of MAP.spawns) {
    const dx = s[0] - other.pos[0], dz = s[2] - other.pos[2];
    if (dx * dx + dz * dz > bd) { bd = dx * dx + dz * dz; best = s; }
  }
  p.pos = [best[0], 0, best[2]]; p.yaw = best[3];
  p.hp = CONFIG.MAX_HP; p.sh = CONFIG.MAX_SHIELD; p.dead = false;
  broadcast({ t: 'respawn', id: seat, p: p.pos, yaw: p.yaw });
}
function onKill(victimSeat, bySeat, head) {
  players[victimSeat].dead = true;
  // la victime lâche une orbe de soin à l'endroit de sa mort
  const vp = players[victimSeat].pos;
  // Une seule orbe à la fois : on retire toutes les anciennes avant d'ajouter la nouvelle
  while (orbs.length) { const old = orbs.shift(); broadcast({ t: 'orbgone', id: old.id }); }
  const orb = { id: nextOrbId++, p: [vp[0], (vp[1] || 0) + 1.1, vp[2]] };
  orbs.push(orb);
  broadcast({ t: 'orb', id: orb.id, p: orb.p });
  scores[bySeat]++;
  broadcast({ t: 'kill', victim: victimSeat, by: bySeat, head, scores });
  if (scores[bySeat] >= CONFIG.WIN_SCORE) {
    phase = 'ended';
    broadcast({ t: 'end', winner: bySeat, scores });
    setTimeout(endToLobby, CONFIG.RESET_MS);
  } else {
    setTimeout(() => { if (phase === 'playing' && players[victimSeat]) respawn(victimSeat); }, CONFIG.RESPAWN_MS);
  }
}

/* ---------- WebSocket ---------- */
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  if (clients.size >= CONFIG.MAX_CLIENTS) { ws.send(JSON.stringify({ t: 'full' })); return ws.close(); }
  const c = { id: nextId++, ws, name: 'Joueur ' + nextId, seat: null };
  clients.set(c.id, c);

  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }

    if (m.t === 'hello') {
      c.name = String(m.name || '').replace(/[<>&]/g, '').trim().slice(0, 16) || ('Joueur ' + c.id);
      send(c, { t: 'init', proto: 8, id: c.id, maxHp: CONFIG.MAX_HP, maxShield: CONFIG.MAX_SHIELD });
      // si un match est en cours, l'arrivant le regarde immédiatement
      if (phase !== 'lobby') send(c, startInfo(0));
      broadcastRoster();
    }

    if (m.t === 'botmode' && phase === 'lobby') {
      // démarre une partie solo contre des bots : le joueur prend le siège 0
      seats = [c.id, null]; c.seat = 0;
      startBotMode(0);
    }

    if (m.t === 'seat' && phase === 'lobby') {
      if (m.want && c.seat === null) {
        const free = seats[0] === null ? 0 : (seats[1] === null ? 1 : -1);
        if (free >= 0) { seats[free] = c.id; c.seat = free; }
      } else if (!m.want && c.seat !== null) {
        seats[c.seat] = null; c.seat = null;
      }
      broadcastRoster();
      if (seats[0] !== null && seats[1] !== null) startMatch();
    }

    if (m.t === 'state' && phase === 'playing' && c.seat !== null) {
      const p = players[c.seat];
      if (!p || p.dead) return;
      const now = Date.now();
      const dt = Math.max(0.015, (now - p.lastStateAt) / 1000);
      p.lastStateAt = now;
      const dx = m.p[0] - p.pos[0], dz = m.p[2] - p.pos[2];
      const dist = Math.hypot(dx, dz), maxD = CONFIG.MAX_SPEED * dt * 1.6;
      if (dist > maxD && dist > 0) {
        const k = maxD / dist;
        p.pos[0] += dx * k; p.pos[2] += dz * k;
      } else { p.pos[0] = m.p[0]; p.pos[2] = m.p[2]; }
      p.pos[0] = Math.max(-MAP.HALF + 0.6, Math.min(MAP.HALF - 0.6, p.pos[0]));
      p.pos[2] = Math.max(-MAP.HALF + 0.6, Math.min(MAP.HALF - 0.6, p.pos[2]));
      p.pos[1] = m.p[1];
      p.yaw = m.yaw; p.pitch = m.pitch;
      p.anim = m.anim || p.anim;
      if (typeof m.w === 'number' && m.w >= 0 && m.w < CONFIG.WEAPONS.length) p.weaponIdx = m.w | 0;
    }

    if (m.t === 'shoot' && phase === 'playing' && c.seat !== null) {
      const shooter = players[c.seat];
      if (!shooter || shooter.dead) return;
      const now = Date.now();
      const wi = (m.w === 1) ? 1 : 0;
      const W = CONFIG.WEAPONS[wi] || { body: CONFIG.DMG_BODY, head: CONFIG.DMG_HEAD, minInterval: CONFIG.MIN_SHOT_INTERVAL };
      if (now - shooter.lastShot < W.minInterval) return;
      if (shooter.anim.h) return; // arme rangée
      if (W.melee) return;        // le sabre ne tire pas (il passe par le handler 'melee')
      shooter.weaponIdx = wi;
      shooter.lastShot = now;
      broadcastExcept(c.id, { t: 'shot', seat: c.seat, o: m.o, d: m.d, w: wi }); // visuels + arme

      // ----- BOT MODE : on teste le tir contre tous les bots vivants -----
      if (botMode) {
        const lagB = Math.max(0, Math.min(600, m.lag || 0));
        let best = null;
        for (const b of bots) {
          if (b.dead) continue;
          const rewind = lagB > 0 ? rewindPos(b, now - lagB) : null;
          const h = rayCapsule(m.o, m.d, b, rewind);
          if (h && !losBlockedBefore(m.o, m.d, h.t)) {
            if (!best || h.t < best.h.t) best = { b, h };
          }
        }
        if (best) {
          const head = best.h.y > best.h.headLine;
          const dmg = head ? W.head : W.body;
          applyDamage(best.b, dmg);
          broadcast({ t: 'bothit', id: best.b.id, by: c.seat, dmg, head,
            hp: Math.max(0, best.b.hp), sh: Math.max(0, best.b.sh) });
          if (best.b.hp <= 0) {
            best.b.dead = true;
            broadcast({ t: 'botkill', id: best.b.id, by: c.seat, head });
            // respawn du bot ailleurs après un court délai
            const bb = best.b;
            setTimeout(() => { if (botMode && bb.dead) respawnBot(bb); }, 1500);
          }
        }
        return;
      }

      const targetSeat = 1 - c.seat;
      const target = players[targetSeat];
      if (!target || target.dead) return;
      // COMPENSATION DE LATENCE : on rembobine la cible à l'instant où le tireur la voyait.
      // m.lag = délai (ms) annoncé par le client = interpolation + demi-ping. Borné à 600ms.
      const lag = Math.max(0, Math.min(600, m.lag || 0));
      const rewind = lag > 0 ? rewindPos(target, now - lag) : null;
      const hit = rayCapsule(m.o, m.d, target, rewind);
      if (!hit) return;
      if (losBlockedBefore(m.o, m.d, hit.t)) return;
      const head = hit.y > hit.headLine;
      const dmg = head ? W.head : W.body;
      applyDamage(target, dmg);
      broadcast({ t: 'hit', target: targetSeat, by: c.seat, dmg, head,
        hp: Math.max(0, target.hp), sh: Math.max(0, target.sh) });
      if (target.hp <= 0) onKill(targetSeat, c.seat, head);
    }

    // ----- SABRE LASER : coup de mêlée (cône frontal à courte portée) -----
    if (m.t === 'melee' && phase === 'playing' && c.seat !== null) {
      const att = players[c.seat];
      if (!att || att.dead) return;
      if (att.anim.h) return;                              // arme rangée (holster)
      const aw = CONFIG.WEAPONS[att.weaponIdx];
      if (!aw || !aw.melee) return;                        // doit tenir le sabre (anti-exploit 70 dmg)
      const now = Date.now();
      if (now - (att.lastMelee || 0) < CONFIG.MELEE.interval) return;
      att.lastMelee = now;
      // direction de visée normalisée
      const d = m.d || [0, 0, -1];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      const dir = [d[0] / dl, d[1] / dl, d[2] / dl];
      const o = m.o || [att.pos[0], (att.pos[1] || 0) + 1.4, att.pos[2]];
      const dmg = CONFIG.MELEE.dmg;
      // cible dans le cône frontal la plus proche
      const inCone = (ent) => {
        const dx = ent.pos[0] - o[0];
        const dy = (ent.pos[1] || 0) + 1.1 - o[1]; // centre torse approximatif
        const dz = ent.pos[2] - o[2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist > CONFIG.MELEE.range) return null;
        const dot = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (dist || 1);
        if (dot < CONFIG.MELEE.cos) return null;
        return dist;
      };
      if (botMode) {
        let best = null;
        for (const b of bots) {
          if (b.dead) continue;
          const dist = inCone(b);
          if (dist != null && (!best || dist < best.dist)) best = { b, dist };
        }
        if (best) {
          applyDamage(best.b, dmg);
          broadcast({ t: 'bothit', id: best.b.id, by: c.seat, dmg, head: false, melee: true,
            hp: Math.max(0, best.b.hp), sh: Math.max(0, best.b.sh) });
          if (best.b.hp <= 0) {
            best.b.dead = true;
            broadcast({ t: 'botkill', id: best.b.id, by: c.seat, head: false });
            const bb = best.b;
            setTimeout(() => { if (botMode && bb.dead) respawnBot(bb); }, 1500);
          }
        }
        return;
      }
      const tgtSeat = 1 - c.seat;
      const tgt = players[tgtSeat];
      if (!tgt || tgt.dead) return;
      if (inCone(tgt) == null) return;
      applyDamage(tgt, dmg);
      broadcast({ t: 'hit', target: tgtSeat, by: c.seat, dmg, head: false, melee: true,
        hp: Math.max(0, tgt.hp), sh: Math.max(0, tgt.sh) });
      if (tgt.hp <= 0) onKill(tgtSeat, c.seat, false);
      return;
    }

    if (m.t === 'ping') send(c, { t: 'pong', n: m.n });
  });

  ws.on('close', () => {
    const wasSeat = c.seat;
    clients.delete(c.id);
    if (wasSeat !== null) {
      seats[wasSeat] = null;
      if (phase !== 'lobby') {
        broadcast({ t: 'aborted', name: c.name });
        endToLobby();
        return;
      }
    }
    broadcastRoster();
  });
});

/* ---------- Tick 20 Hz : snapshots ---------- */
setInterval(() => {
  // En 1v1 il faut les 2 joueurs ; en bot mode, juste le joueur humain + des bots.
  if (phase === 'lobby') return;
  if (!botMode && (!players[0] || !players[1])) return;
  if (botMode && !players[0] && !players[1]) return;
  tickN++;
  const nowT = Date.now();

  // IA des bots (déplacement) + enregistrement de leur historique (lag comp)
  if (botMode) {
    updateBots(CONFIG.TICK_MS / 1000);
    for (const b of bots) if (!b.dead) recordHistory(b, nowT);
  }

  // Ramassage des orbes de soin : proximité → PV et bouclier restaurés à fond
  if (phase === 'playing') {
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      for (let s2 = 0; s2 < 2; s2++) {
        const p = players[s2];
        if (!p || p.dead) continue;
        const dx = p.pos[0] - o.p[0], dy = (p.pos[1] || 0) + 1 - o.p[1], dz = p.pos[2] - o.p[2];
        if (dx * dx + dy * dy + dz * dz < 1.8 * 1.8) {
          p.hp = CONFIG.MAX_HP; p.sh = CONFIG.MAX_SHIELD;
          broadcast({ t: 'orbtaken', id: o.id, by: s2, hp: p.hp, sh: p.sh });
          orbs.splice(i, 1);
          break;
        }
      }
    }
  }
  const snap = { t: 'snap', n: tickN, ts: nowT, scores, players: {} };
  for (let s = 0; s < 2; s++) {
    const p = players[s];
    if (!p) continue; // siège vide (ex : bot mode → un seul joueur)
    if (!p.dead) recordHistory(p, nowT); // pour la compensation de latence
    snap.players[s] = {
      p: p.pos.map((v) => Math.round(v * 1000) / 1000),
      yaw: Math.round(p.yaw * 1000) / 1000,
      pitch: Math.round(p.pitch * 1000) / 1000,
      anim: p.anim, hp: p.hp, sh: p.sh, dead: p.dead ? 1 : 0,
    };
  }
  // bots inclus dans le snapshot en bot mode
  if (botMode) {
    snap.bots = bots.map((b) => ({
      id: b.id,
      p: b.pos.map((v) => Math.round(v * 1000) / 1000),
      yaw: Math.round(b.yaw * 1000) / 1000,
      anim: b.anim, hp: b.hp, sh: b.sh, dead: b.dead ? 1 : 0,
    }));
  }
  broadcast(snap);
}, CONFIG.TICK_MS);

server.listen(CONFIG.PORT, () => {
  console.log(`NEON COMPOUND v7 — serveur prêt : http://localhost:${CONFIG.PORT}`);
  console.log('Salon jusqu\'à 8 connectés : 2 joueurs + spectateurs. Chacun entre son pseudo.');
});
