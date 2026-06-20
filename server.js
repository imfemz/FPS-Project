/* =====================================================
   NEON COMPOUND — Serveur autoritaire FREE-FOR-ALL (v9)
   - Jusqu'à 6 joueurs simultanés en mêlée générale.
   - Au-delà de 6 connectés joueurs : SPECTATEURS, promus
     automatiquement dès qu'une place se libère.
   - Premier à 10 kills => victoire, puis la partie se
     relance automatiquement (scores remis à zéro).
   - Aucun minimum de joueurs : la partie tourne dès 1 joueur.
   - Le serveur reste autoritaire : PV/shield, dégâts,
     kills, scores, respawn, validation des tirs (lag comp).
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
  DMG_BODY: GAMECFG.DAMAGE.BODY,
  DMG_HEAD: GAMECFG.DAMAGE.HEAD,
  MIN_SHOT_INTERVAL: Math.floor(GAMECFG.FIRE_RATE * 1000 * 0.8),
  WEAPONS: (GAMECFG.WEAPONS || []).map(w => ({
    body: w.damage_body, head: w.damage_head,
    melee: !!w.melee,
    minInterval: Math.floor((w.fire_rate || GAMECFG.FIRE_RATE) * 1000 * 0.8),
  })),
  MAX_SPEED: GAMECFG.MAX_SPEED_SERVER,
  MELEE: {
    dmg: (GAMECFG.MELEE && GAMECFG.MELEE.damage) || 70,
    range: (GAMECFG.MELEE && GAMECFG.MELEE.range) || 3.2,
    cos: Math.cos((((GAMECFG.MELEE && GAMECFG.MELEE.cone_deg) || 75) * Math.PI / 180) / 2),
    interval: (GAMECFG.MELEE && GAMECFG.MELEE.interval_ms) || 240,
    knockback: (GAMECFG.MELEE && GAMECFG.MELEE.knockback) || 11, // impulsion (m/s) de recul envoyée à la victime touchée au sabre
  },
  RESPAWN_MS: 3200,        // mort -> deathcam courte -> respawn
  RESET_MS: 6000,          // durée de l'écran de victoire avant relance auto
  MAX_PLAYERS: 6,          // sièges jouables simultanés
  MAX_CLIENTS: 16,         // joueurs + spectateurs
  PROTO: 9,
};

/* ---------- Serveur HTTP statique ---------- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.obj': 'text/plain' };
const DEV = !process.env.RENDER;            // dev local (pas sur Render) -> auto-reload + pas de cache

/* ---------- Scoreboard "Kill contre la montre" (classement persistant, fichier JSON) ---------- */
const LB_FILE = path.join(__dirname, 'leaderboard.json');
// Persistance EN LIGNE : si un KV REST (Upstash / Vercel KV) est configure (env), on l'utilise -> survit aux redeploiements Render.
// Sinon fichier local (OK en dev ; ephemere sur Render). Variables : KV_REST_API_URL + KV_REST_API_TOKEN.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
const KV_ON = !!(KV_URL && KV_TOKEN), KV_KEY = 'fracture_leaderboard';
let leaderboard = [];
async function kvLoad() {
  try {
    const r = await fetch(KV_URL + '/get/' + KV_KEY, { headers: { Authorization: 'Bearer ' + KV_TOKEN } });
    const j = await r.json();
    if (j && j.result) { leaderboard = JSON.parse(j.result) || []; console.log('[LB] charge depuis KV :', leaderboard.length, 'entrees'); }
  } catch (e) { console.warn('[LB] KV load echec :', e.message); }
}
if (KV_ON) { console.log('[LB] persistance KV en ligne ACTIVE'); kvLoad(); }
else { try { leaderboard = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')) || []; } catch (e) { leaderboard = []; } }
function lbTop(n) { return leaderboard.slice().sort((a, b) => b.kills - a.kills).slice(0, n || 20); }
function lbSave() {
  if (KV_ON) { fetch(KV_URL + '/set/' + KV_KEY, { method: 'POST', headers: { Authorization: 'Bearer ' + KV_TOKEN }, body: JSON.stringify(leaderboard) }).catch(() => {}); return; }
  try { fs.writeFile(LB_FILE, JSON.stringify(leaderboard), () => {}); } catch (e) {}
}
function lbSubmit(name, kills) {
  name = String(name || 'Joueur').slice(0, 16).trim() || 'Joueur';
  kills = Math.max(0, Math.min(9999, kills | 0));
  const ex = leaderboard.find(e => e.name === name);
  if (ex) { if (kills > ex.kills) { ex.kills = kills; ex.ts = Date.now(); } }
  else leaderboard.push({ name, kills, ts: Date.now() });
  leaderboard = lbTop(200);   // garde le top 200 (ne grossit pas a l'infini)
  lbSave();
}
const devClients = new Set();                // connexions SSE pour le live-reload
const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (DEV && url === '/__dev_reload') {       // canal Server-Sent Events : le navigateur ecoute les changements
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write('retry: 1000\n\n');
    devClients.add(res);
    req.on('close', () => devClients.delete(res));
    return;
  }
  if (url === '/status') {                       // compteur live pour le menu (joueurs en partie)
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ seated: playerCount(), max: N, phase }));
  }
  if (url === '/leaderboard') {                  // classement Kill contre la montre
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
    return res.end(JSON.stringify({ top: lbTop(20) }));
  }
  if (url === '/score' && req.method === 'POST') {   // soumission d'un score de run
    let body = '';
    req.on('data', d => { body += d; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try { const m = JSON.parse(body || '{}'); lbSubmit(m.name, m.kills); } catch (e) {}
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ top: lbTop(20) }));
    });
    return;
  }
  if (url === '/') url = '/index.html';
  const base = url.startsWith('/shared/') ? __dirname : path.join(__dirname, 'public');
  const file = path.join(base, url);
  if (!file.startsWith(__dirname)) { res.writeHead(403); return res.end(); }
  // STREAMING (pas fs.readFile) : sert les gros .glb/.jpg sans tout charger en RAM -> robuste sous charge (fini les 503).
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('404'); }
    const headers = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Length': st.size };
    if (DEV) headers['Cache-Control'] = 'no-store';                 // toujours frais en local
    else headers['Cache-Control'] = 'public, max-age=3600';         // prod : cache navigateur (allège le serveur)
    res.writeHead(200, headers);
    const stream = fs.createReadStream(file);
    stream.on('error', () => { try { res.destroy(); } catch (e) {} });
    req.on('close', () => stream.destroy());                        // client parti -> on stoppe la lecture
    stream.pipe(res);
  });
});

/* ---------- État du free-for-all ---------- */
const N = CONFIG.MAX_PLAYERS;
const clients = new Map();           // id -> {id, ws, name, seat:null|0..N-1}
let nextId = 1;
let seats = new Array(N).fill(null); // seat -> clientId
let players = new Array(N).fill(null); // seat -> état de match
let scores = new Array(N).fill(0);
let phase = 'idle';                  // idle | playing | ended
let orbs = [];
let nextOrbId = 1;
let tickN = 0;

function send(c, msg) { if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function broadcast(msg) { for (const c of clients.values()) send(c, msg); }
function broadcastExcept(id, msg) { for (const c of clients.values()) if (c.id !== id) send(c, msg); }

function playerCount() { let n = 0; for (const s of seats) if (s !== null) n++; return n; }
function freeSeat() { for (let s = 0; s < N; s++) if (seats[s] === null) return s; return -1; }
function nameOf(seat) { const c = seats[seat] != null && clients.get(seats[seat]); return c ? c.name : ('Joueur ' + (seat + 1)); }
function namesMap() { const o = {}; for (let s = 0; s < N; s++) if (seats[s] !== null) o[s] = nameOf(s); return o; }

function rosterMsg() {
  return {
    t: 'roster', phase, scores,
    names: namesMap(),
    seated: playerCount(), maxPlayers: N,
    specs: [...clients.values()].filter(c => c.seat === null).length,
  };
}
function broadcastRoster() { broadcast(rosterMsg()); }

function snapshotPlayers() {
  const o = {};
  for (let s = 0; s < N; s++) {
    const p = players[s]; if (!p) continue;
    o[s] = {
      p: p.pos.map(v => Math.round(v * 1000) / 1000),
      yaw: Math.round(p.yaw * 1000) / 1000,
      pitch: Math.round((p.pitch || 0) * 1000) / 1000,
      anim: p.anim, hp: p.hp, sh: p.sh, dead: p.dead ? 1 : 0,
      w: p.weaponIdx | 0,   // arme tenue -> anim 3e personne (couches) + modele d'arme attache
    };
  }
  return o;
}
// Message d'entrée en jeu (ou de relance) envoyé à UN client : lui dit son siège
// (ou -1 = spectateur) + l'état courant pour afficher tout le monde immédiatement.
function joinMsg(seat) {
  return {
    t: 'joingame', proto: CONFIG.PROTO, seat,
    spawns: MAP.spawns, scores, names: namesMap(), orbs,
    players: snapshotPlayers(),
  };
}

function makePlayerState(seat) {
  const s = MAP.spawns[seat % MAP.spawns.length];
  return {
    pos: [s[0], 0, s[2]], yaw: s[3], pitch: 0,
    anim: { m: 0, c: 0, a: 0, r: 0, sl: 0, h: 0, cl: 0, f: 0, ad: 0 },
    hp: CONFIG.MAX_HP, sh: CONFIG.MAX_SHIELD, dead: false,
    weaponIdx: 0, lastShot: 0, lastMelee: 0, lastStateAt: Date.now(),
    history: [],
  };
}
// Point de spawn le plus éloigné de l'ennemi vivant le plus proche (anti spawn-kill).
function spawnPointAwayFrom(selfSeat) {
  let best = MAP.spawns[0], bestScore = -1;
  for (const sp of MAP.spawns) {
    let nearest = Infinity;
    for (let s = 0; s < N; s++) {
      if (s === selfSeat) continue;
      const p = players[s]; if (!p || p.dead) continue;
      const dx = sp[0] - p.pos[0], dz = sp[2] - p.pos[2];
      nearest = Math.min(nearest, dx * dx + dz * dz);
    }
    if (nearest > bestScore) { bestScore = nearest; best = sp; }
  }
  return best;
}

function recordHistory(p, now) {
  p.history.push({ t: now, pos: [p.pos[0], p.pos[1], p.pos[2]], crouch: p.anim.c ? 1 : 0 });
  const cutoff = now - 600;
  while (p.history.length && p.history[0].t < cutoff) p.history.shift();
}
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

/* ---------- Gestion des places ---------- */
// Place le client sur un siège libre s'il y en a un, sinon -> spectateur (-1).
function seatClient(c) {
  if (c.seat !== null) return c.seat;
  const s = freeSeat();
  if (s < 0) return -1;
  seats[s] = c.id; c.seat = s;
  scores[s] = 0;
  players[s] = makePlayerState(s);
  if (phase === 'idle') phase = 'playing';
  return s;
}
// Quand une place se libère, on y promeut le spectateur connecté depuis le plus longtemps.
function promoteSpectator(exceptId) {
  if (freeSeat() < 0) return;
  for (const c of clients.values()) {
    if (exceptId != null && c.id === exceptId) continue; // ne pas re-asseoir celui qui vient de passer spectateur
    if (c.seat === null) {
      const s = seatClient(c);
      if (s >= 0) { send(c, joinMsg(s)); return; }
    }
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
    min: [b.x - b.w / 2, b.y0 || 0, b.z - b.d / 2],
    max: [b.x + b.w / 2, (b.y0 || 0) + b.h, b.z + b.d / 2],
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
function rayCapsule(o, d, target, rewind) {
  const tpos = rewind ? rewind.pos : target.pos;
  const lowered = rewind ? rewind.crouch : (target.anim.c || target.anim.sl);
  const ground = tpos[1] || 0;
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
  const sp = spawnPointAwayFrom(seat);
  p.pos = [sp[0], 0, sp[2]]; p.yaw = sp[3]; p.pitch = 0;
  p.hp = CONFIG.MAX_HP; p.sh = CONFIG.MAX_SHIELD; p.dead = false;
  p.history = [];
  broadcast({ t: 'respawn', seat, p: p.pos, yaw: p.yaw });
}
function dropOrb(pos) {
  while (orbs.length) { const old = orbs.shift(); broadcast({ t: 'orbgone', id: old.id }); }
  const orb = { id: nextOrbId++, p: [pos[0], (pos[1] || 0) + 1.1, pos[2]] };
  orbs.push(orb);
  broadcast({ t: 'orb', id: orb.id, p: orb.p });
}
function onKill(victimSeat, bySeat, head) {
  const v = players[victimSeat]; if (!v) return;
  v.dead = true;
  dropOrb(v.pos);
  if (bySeat != null && bySeat >= 0 && bySeat < N && bySeat !== victimSeat && players[bySeat]) {
    scores[bySeat]++;
  }
  broadcast({ t: 'kill', victim: victimSeat, by: bySeat, head, scores });
  if (bySeat != null && scores[bySeat] >= CONFIG.WIN_SCORE) {
    phase = 'ended';
    broadcast({ t: 'end', winner: bySeat, scores });
    setTimeout(resetMatch, CONFIG.RESET_MS);
  } else {
    setTimeout(() => {
      if (phase === 'playing' && players[victimSeat] && players[victimSeat].dead) respawn(victimSeat);
    }, CONFIG.RESPAWN_MS);
  }
}
// Relance automatique après une victoire : scores remis à zéro, tout le monde
// repositionné, puis on renvoie un 'joingame' frais à chaque client.
function resetMatch() {
  orbs = [];
  if (playerCount() === 0) { phase = 'idle'; scores.fill(0); return; }
  scores.fill(0);
  for (let s = 0; s < N; s++) {
    if (seats[s] === null) { players[s] = null; continue; }
    players[s] = makePlayerState(s);
    const sp = spawnPointAwayFrom(s);
    players[s].pos = [sp[0], 0, sp[2]]; players[s].yaw = sp[3];
  }
  phase = 'playing';
  for (const c of clients.values()) send(c, joinMsg(c.seat === null ? -1 : c.seat));
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
      send(c, { t: 'init', proto: CONFIG.PROTO, id: c.id, maxHp: CONFIG.MAX_HP, maxShield: CONFIG.MAX_SHIELD, maxPlayers: N });
      const seat = seatClient(c);                 // siège libre -> joueur, sinon spectateur
      send(c, joinMsg(seat));
      broadcastRoster();
      return;
    }

    // Un spectateur peut demander à entrer dès qu'une place se libère.
    if (m.t === 'play' && c.seat === null) {
      const seat = seatClient(c);
      if (seat >= 0) { send(c, joinMsg(seat)); broadcastRoster(); }
      else send(c, { t: 'spectatefull' }); // aucune place libre → on reste spectateur
      return;
    }
    // Un joueur peut PASSER spectateur volontairement (libère sa place).
    if (m.t === 'spectate' && c.seat !== null) {
      const s = c.seat;
      seats[s] = null; players[s] = null; scores[s] = 0; c.seat = null;
      broadcast({ t: 'playerleft', seat: s, name: c.name });
      if (playerCount() === 0) { phase = 'idle'; orbs = []; }
      send(c, joinMsg(-1));          // renvoie l'état en spectateur
      promoteSpectator(c.id);         // une place s'est libérée → promeut un AUTRE spectateur (pas le partant)
      broadcastRoster();
      return;
    }

    if (m.t === 'state' && phase !== 'idle' && c.seat !== null) {
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
      if (shooter.anim.h) return;
      if (W.melee) return;
      shooter.weaponIdx = wi;
      shooter.lastShot = now;
      broadcastExcept(c.id, { t: 'shot', seat: c.seat, o: m.o, d: m.d, w: wi });

      // FFA : on teste le tir contre TOUS les autres joueurs vivants, on garde le plus proche.
      const lag = Math.max(0, Math.min(600, m.lag || 0));
      let best = null;
      for (let s = 0; s < N; s++) {
        if (s === c.seat) continue;
        const tgt = players[s]; if (!tgt || tgt.dead) continue;
        const rewind = lag > 0 ? rewindPos(tgt, now - lag) : null;
        const h = rayCapsule(m.o, m.d, tgt, rewind);
        if (h && !losBlockedBefore(m.o, m.d, h.t)) {
          if (!best || h.t < best.h.t) best = { seat: s, tgt, h };
        }
      }
      if (!best) return;
      const head = best.h.y > best.h.headLine;
      const dmg = head ? W.head : W.body;
      applyDamage(best.tgt, dmg);
      broadcast({ t: 'hit', target: best.seat, by: c.seat, dmg, head,
        hp: Math.max(0, best.tgt.hp), sh: Math.max(0, best.tgt.sh) });
      if (best.tgt.hp <= 0) onKill(best.seat, c.seat, head);
      return;
    }

    // ----- SABRE LASER : coup de mêlée (cône frontal à courte portée) -----
    if (m.t === 'melee' && phase === 'playing' && c.seat !== null) {
      const att = players[c.seat];
      if (!att || att.dead) return;
      if (att.anim.h) return;
      const aw = CONFIG.WEAPONS[att.weaponIdx];
      if (!aw || !aw.melee) return;
      const now = Date.now();
      if (now - (att.lastMelee || 0) < CONFIG.MELEE.interval) return;
      att.lastMelee = now;
      // anime le swing sabre chez les autres clients (touche OU manque) -> Sword_Slash 3e pers
      broadcastExcept(c.id, { t: 'swing', seat: c.seat });
      const d = m.d || [0, 0, -1];
      const dl = Math.hypot(d[0], d[1], d[2]) || 1;
      const dir = [d[0] / dl, d[1] / dl, d[2] / dl];
      const o = m.o || [att.pos[0], (att.pos[1] || 0) + 1.4, att.pos[2]];
      const dmg = CONFIG.MELEE.dmg;
      const inCone = (ent) => {
        const dx = ent.pos[0] - o[0];
        const dy = (ent.pos[1] || 0) + 1.1 - o[1];
        const dz = ent.pos[2] - o[2];
        const dist = Math.hypot(dx, dy, dz);
        if (dist > CONFIG.MELEE.range) return null;
        const dot = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (dist || 1);
        if (dot < CONFIG.MELEE.cos) return null;
        return dist;
      };
      let best = null;
      for (let s = 0; s < N; s++) {
        if (s === c.seat) continue;
        const tgt = players[s]; if (!tgt || tgt.dead) continue;
        const dist = inCone(tgt);
        if (dist != null && (!best || dist < best.dist)) best = { seat: s, tgt, dist };
      }
      if (!best) return;
      applyDamage(best.tgt, dmg);
      // Knockback : la victime est repoussée dans la direction du coup (horizontale). Le mouvement
      // étant client-autoritatif, on envoie l'impulsion à la victime qui l'applique elle-même à sa vélocité.
      const _hkl = Math.hypot(dir[0], dir[2]) || 1;
      const _KBF = CONFIG.MELEE.knockback;
      const kb = [ (dir[0] / _hkl) * _KBF, (dir[2] / _hkl) * _KBF ];
      broadcast({ t: 'hit', target: best.seat, by: c.seat, dmg, head: false, melee: true, kb,
        hp: Math.max(0, best.tgt.hp), sh: Math.max(0, best.tgt.sh) });
      if (best.tgt.hp <= 0) onKill(best.seat, c.seat, false);
      return;
    }

    if (m.t === 'ping') send(c, { t: 'pong', n: m.n });
  });

  ws.on('close', () => {
    const wasSeat = c.seat;
    clients.delete(c.id);
    if (wasSeat !== null) {
      seats[wasSeat] = null;
      players[wasSeat] = null;
      scores[wasSeat] = 0;
      broadcast({ t: 'playerleft', seat: wasSeat, name: c.name });
      if (playerCount() === 0) { phase = 'idle'; orbs = []; }
      else promoteSpectator();   // une place s'est libérée -> un spectateur entre
    }
    broadcastRoster();
  });
});

/* ---------- Tick 20 Hz : snapshots ---------- */
setInterval(() => {
  if (phase !== 'playing') return;
  if (playerCount() === 0) { phase = 'idle'; return; }
  tickN++;
  const nowT = Date.now();

  // Ramassage des orbes de soin : proximité => PV et bouclier restaurés à fond
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    let taken = false;
    for (let s = 0; s < N && !taken; s++) {
      const p = players[s];
      if (!p || p.dead) continue;
      const dx = p.pos[0] - o.p[0], dy = (p.pos[1] || 0) + 1 - o.p[1], dz = p.pos[2] - o.p[2];
      if (dx * dx + dy * dy + dz * dz < 1.8 * 1.8) {
        p.hp = CONFIG.MAX_HP; p.sh = CONFIG.MAX_SHIELD;
        broadcast({ t: 'orbtaken', id: o.id, by: s, hp: p.hp, sh: p.sh });
        orbs.splice(i, 1);
        taken = true;
      }
    }
  }

  for (let s = 0; s < N; s++) {
    const p = players[s];
    if (p && !p.dead) recordHistory(p, nowT); // pour la compensation de latence
  }

  broadcast({ t: 'snap', n: tickN, ts: nowT, scores, players: snapshotPlayers() });
}, CONFIG.TICK_MS);

if (DEV) {                                   // surveille public/ et shared/ -> recharge le navigateur
  let _t = null;
  const notify = () => { for (const r of devClients) { try { r.write('data: reload\n\n'); } catch (e) {} } };
  const onChange = (ev, fn) => { if (fn && (/\.bak|~$|\.swp$/.test(fn))) return; clearTimeout(_t); _t = setTimeout(notify, 150); };
  try {
    fs.watch(path.join(__dirname, 'public'), { recursive: true }, onChange);
    fs.watch(path.join(__dirname, 'shared'), { recursive: true }, onChange);
  } catch (e) { console.warn('[dev] fs.watch KO', e); }
}
server.listen(CONFIG.PORT, () => {
  console.log(`NEON COMPOUND v9 (FFA) — serveur prêt : http://localhost:${CONFIG.PORT}`);
  console.log(`Free-for-all : jusqu'à ${N} joueurs + spectateurs (max ${CONFIG.MAX_CLIENTS} connectés). Premier à ${CONFIG.WIN_SCORE} kills gagne.`);
});
