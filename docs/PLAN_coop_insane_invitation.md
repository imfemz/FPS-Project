# PLAN — Co-op INSANE : inviter un ami (+ UI d'invitation)

> Spec d'implémentation. **Aucun code écrit pour l'instant** — à valider avant de coder.
> Objectif : permettre à un joueur de **lancer une partie INSANE et d'inviter un ami** pour la jouer **à deux en co-op** (2 humains contre les vagues de bots), avec une **UI d'invitation soignée** (lien partageable, code, statut).

---

## 1. Résumé & contraintes actuelles

État du code aujourd'hui :
- **INSANE = 100 % local** : `localBotMode` + `LBOT.waveMode`, les bots (`botMgr`), vagues (`spawnBotWave`, `botsForWave`, `checkWaveClear`, `applyInsaneWave`) et l'IA (`updateLocalBots`) tournent **entièrement sur le client**. Le serveur n'est pas sollicité.
- **Serveur = une seule mêlée FFA globale** : `server.js` gère N sièges (`seats`/`players`), tout client qui se connecte rejoint **le même match**. **Pas de rooms, pas d'invitation, pas de code de partie.**
- Connexion client : `ws = new WebSocket(\`${proto}://${location.host}\`)` (un seul endpoint global).

Conséquence : le co-op insane demande **deux briques neuves** :
1. Des **rooms privées** + un **relais** côté serveur (pour que l'ami rejoigne TA partie, pas la mêlée globale).
2. Une **synchro de partie** entre les 2 joueurs (le 2e joueur + les bots/vagues).

---

## 2. Décision d'architecture : **HÔTE-AUTORITAIRE + serveur relais**

L'hôte (celui qui invite) **continue de faire tourner la simulation insane locale existante** (bots, IA, vagues, drones, sentinelles, dégâts) — quasi aucun changement. L'ami (invité) est un **client léger** : il **rend** l'état envoyé par l'hôte et **renvoie ses inputs** (position, tirs). Le serveur ne simule rien : il **relaie** les messages entre les 2 pairs d'une même room.

**Pourquoi ce choix :**
- ✅ Réutilise TOUT le code insane local déjà écrit et réglé (IA `LBOT`, courbe de difficulté, types d'ennemis). On ne réécrit pas l'IA des bots côté serveur (ce serait énorme).
- ✅ Le serveur ne gagne qu'une fonction simple : rooms + relais de messages. Léger, peu de risque de régression sur la mêlée FFA existante.
- ✅ Pas de souci NAT/P2P : tout passe par le WebSocket serveur (comme la mêlée).

**Compromis (acceptés pour la v1) :**
- L'hôte a 0 latence, l'invité voit les bots avec ~1 RTT de retard → **interpolation** côté invité. Acceptable pour du **PvE coopératif** (pas de compétition stricte entre les 2).
- Si l'**hôte se déconnecte**, la session co-op s'arrête (pas de migration d'hôte en v1).
- Pas d'anti-triche (l'hôte fait foi). Sans importance en co-op entre amis.

**Alternative écartée (notée pour le futur) :** *serveur-autoritaire* (le serveur simule les bots). Plus juste, nécessaire pour du compétitif/anti-triche, mais demande de **porter toute l'IA `LBOT` dans `server.js`** → hors budget v1. À envisager si le co-op devient un mode central ou pour le ranked.

---

## 3. Composants

### 3.A — Serveur : rooms + relais (`server.js`)

Ajouts (additifs, la mêlée FFA globale reste intacte) :
- `const rooms = new Map();` → `code -> { code, hostId, guestId|null, mode:'insane-coop', createdAt }`.
- **Code de room** : 4 caractères lisibles (alphabet sans ambiguïté : `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, pas de 0/O/1/I/L). Ex. `X7K2`.
- Nouveaux messages entrants (voir §4) :
  - `createRoom` → crée la room, renvoie `roomCreated {code}`.
  - `joinRoom {code, name}` → si la room existe et a une place : associe le guest, prévient les 2 (`roomReady {host, guest}`), sinon `roomError {reason}` (`notfound` | `full` | `closed`).
  - `relay {to:'host'|'guest', payload}` → le serveur transmet `payload` à l'autre pair de la room (enveloppe `roomMsg {from, payload}`). **Le serveur n'inspecte pas le payload** (transport pur).
  - `leaveRoom` / déconnexion → prévient l'autre pair (`roomPeerLeft`), détruit la room.
- **Isolation** : un client est soit en **room** (co-op), soit en **siège FFA** (mêlée). On ne mélange pas. Un client en room n'occupe pas de siège FFA.
- **Nettoyage** : room détruite quand un pair part ; TTL de sécurité (ex. supprimer les rooms vides > 10 min).

### 3.B — Client : flow d'invitation + connexion room

**Côté hôte :**
1. Menu FRACTURE → sélection difficulté **INSANE** → un bouton **« Inviter un ami »** apparaît (à côté de « Lancer »).
2. Clic → `ensureWS()` (connexion serveur) → `createRoom` → réception `roomCreated {code}`.
3. Ouvre l'**UI d'invitation** (§3.E) avec :
   - le **lien** `location.origin + '/?room=' + code`,
   - le **code** affiché en gros,
   - le **statut** « En attente de ton ami… ».
4. Quand `roomReady` arrive (l'ami a rejoint) → statut « **<pseudo> a rejoint ✓** », bouton **« Lancer le co-op »** activé.
5. Lancement → l'hôte démarre `startCoopInsane({role:'host'})` (= `startLocalBotMode` insane + couche réseau) et envoie `relay start` à l'invité.

**Côté invité :**
1. Ouvre le lien → au chargement, le menu détecte `new URLSearchParams(location.search).get('room')`.
2. Affiche un **panneau de jonction** : « Rejoindre la partie INSANE de **<hôte>** ? » + champ pseudo + bouton **« Rejoindre »** (et un fallback : champ « entrer un code » si pas de param URL).
3. Clic → `ensureWS()` → `joinRoom {code, name}` → `roomReady` → écran « En attente du lancement par l'hôte… ».
4. Réception `relay start` → `startCoopInsane({role:'guest'})`.

### 3.C — Synchro de partie co-op (hôte-autoritaire)

**Hôte → invité** (snapshot, ~15–20 Hz, via `relay`) :
- `bots[]` : pour chaque bot vivant `{id, type, x, y, z, yaw, anim(m/a/sl/c), hp}` (drones inclus avec leur position de vol).
- `host` : `{x, y, z, yaw, pitch, weapon, anim, firing}` (pour que l'invité voie l'hôte).
- `wave`, `timeLeft`, `score`, événements ponctuels : `botHit {id, dmg, head}`, `botDeath {id}`, `waveBanner {n}`, `buffItem {…}`.

**Invité → hôte** (input, à chaque frame ou ~30 Hz, via `relay`) :
- `{x, y, z, yaw, pitch, weapon, jump, anim}` (état de mouvement).
- Tirs : `shot {origin, dir, weapon}` → **l'hôte résout le tir** contre les bots (réutilise `localBotShoot` / `rayCapsuleT`) et applique les dégâts. (L'hôte fait foi → cohérence des kills.)
- Melee/overcharge : `melee {…}` → résolu côté hôte.

**Invité** : n'exécute **aucune** IA bot ; il **interpole** les positions reçues (lissage entre 2 snapshots) et joue les SFX/FX locaux (impacts, sons) déclenchés par les événements.

### 3.D — IA des bots multi-cible (côté hôte)

Aujourd'hui les bots ciblent `me` (joueur local unique). En co-op, l'hôte connaît la position de l'invité → les bots **ciblent le joueur vivant le plus proche** (hôte ou invité).
- Introduire une liste `coopPlayers = [host, guest]` (positions + vivant/mort).
- Dans `updateLocalBots` et l'IA de tir : remplacer les références à `me.pos` par « la cible la plus proche parmi les joueurs vivants ».
- `playerCanSee` / spawn hors-vue : tenir compte des **2** champs de vision (ne pas spawner dans la vue de l'un OU de l'autre, idéalement).
- Les **drones** (suivent le joueur au-dessus) : assignés au joueur le plus proche.

### 3.E — UI d'invitation (« améliore le prompt ») — design détaillé

Modale plein écran translucide, **DA FRACTURE** (panneau `blur`, bord `--accent` cyan, typo `--font`). Deux états : **Hôte** et **Invité**.

**État HÔTE — « Inviter un ami » :**
```
┌───────────────────────────────────────────┐
│             INSANE · CO-OP                 │   ← titre + sous-titre
│        Invite un ami à survivre            │
│                                            │
│   Lien de la partie                        │
│  ┌──────────────────────────┐ ┌────────┐  │
│  │ neon-compound.../?room=X7K2│ │ Copier │  │   ← champ readonly + bouton copier
│  └──────────────────────────┘ └────────┘  │
│                                            │
│            ou code :  X 7 K 2              │   ← code en gros (fallback manuel)
│                                            │
│   ● En attente de ton ami…                 │   ← statut (dot animé)
│                                            │
│        [  Lancer le co-op  ]  (désactivé)  │   ← actif quand l'ami a rejoint
│                  Annuler                    │
└───────────────────────────────────────────┘
```
- **Bouton Copier** : `navigator.clipboard.writeText(link)` → feedback « Copié ✓ » 1,5 s (fallback `execCommand('copy')` si clipboard indispo / http).
- **Partage natif mobile** : si `navigator.share` existe, bouton « Partager » (feuille de partage iOS/Android).
- **Statut live** : réutiliser la pastille `.fr-melee-live .dot` (déjà stylée) — vert pulsé en attente, plein quand connecté : « **<pseudo> a rejoint ✓** ».
- **Lancer le co-op** : désactivé tant que `guest == null`, puis activé (accent + glow).
- **Annuler** : `leaveRoom`, ferme la modale, revient au menu.

**État INVITÉ — « Rejoindre » :**
```
┌───────────────────────────────────────────┐
│             INSANE · CO-OP                 │
│      Rejoindre la partie de  <Hôte>        │
│                                            │
│        Ton pseudo : [  Femz_2   ]          │
│                                            │
│            [  Rejoindre  ]                  │
│                                            │
│   (sans lien : entre un code) [____]       │   ← fallback saisie code
└───────────────────────────────────────────┘
```
Après jonction → « En attente du lancement par l'hôte… » (même pastille live).

**Messages d'erreur** (toast/ligne rouge) : `roomError` → « Partie introuvable », « Partie pleine », « Partie fermée ». Déconnexion du pair pendant la partie → bandeau « **Ton ami a quitté** » + retour menu (ou fin de partie propre).

---

## 4. Protocole de messages (récapitulatif)

| Sens | Type | Payload | Effet |
|------|------|---------|-------|
| C→S | `createRoom` | `{name}` | crée room, renvoie code |
| S→C | `roomCreated` | `{code}` | hôte affiche l'UI |
| C→S | `joinRoom` | `{code, name}` | l'invité rejoint |
| S→C | `roomReady` | `{host, guest}` | les 2 pairs notifiés |
| S→C | `roomError` | `{reason}` | notfound/full/closed |
| C→S | `relay` | `{payload}` | transmis à l'autre pair |
| S→C | `roomMsg` | `{from, payload}` | reçu de l'autre pair |
| C→S | `leaveRoom` | — | quitte/détruit la room |
| S→C | `roomPeerLeft` | — | l'autre est parti |

**Payloads relayés** (dans `relay`/`roomMsg`) : `start`, `snapshot` (host→guest), `input` (guest→host), `shot`, `melee`, `event` (botHit/botDeath/wave/buff), `pause`, `gameover`.

---

## 5. Règles co-op (à trancher pendant l'implémentation)

- **Mort** : option A — *survie partagée* : si un joueur meurt, il devient spectateur ; la partie continue tant qu'1 joueur est vivant ; **fin quand les 2 sont morts**. Option B — *revive* (un coéquipier te relève en restant proche X s). → **v1 = option A** (simple), revive en évolution.
- **Vagues** : partagées (une vague est clear quand tous les bots sont morts, peu importe qui tue). `checkWaveClear` inchangé côté hôte.
- **Score & timer** : **partagés** (un seul chrono insane, un compteur de kills commun) — affichés identiques chez les 2. (Option : kills par joueur en plus.)
- **Difficulté** : on peut augmenter légèrement la densité en co-op (ex. `botsForWave` ×1.3 si 2 joueurs) — à régler.
- **Spawn des 2 joueurs** : 2 points de spawn proches au lancement.

---

## 6. Cas limites / robustesse

- Code invalide / room expirée → `roomError notfound`.
- Room déjà pleine (2/2) → `roomError full`.
- Hôte quitte → `roomPeerLeft` à l'invité → fin propre + retour menu.
- Invité quitte → l'hôte repasse en solo (la partie continue) **ou** propose de ré-inviter.
- Reconnexion réseau brève : buffer + resync snapshot complet (best-effort v1 : on coupe proprement).
- `navigator.clipboard` indispo (contexte non-sécurisé) → fallback `execCommand`.
- Onglet invité ouvert sans WS dispo → message « Serveur indisponible ».

---

## 7. Plan d'implémentation (tranches verticales)

1. **Serveur rooms + relais** (`server.js`) : `createRoom`/`joinRoom`/`relay`/`leaveRoom` + `rooms` Map + nettoyage. *(Rappel : redémarrer le serveur après modif `server.js`.)*
2. **UI d'invitation** (`index.html`) : modale hôte + invité, copier le lien, statut live, détection `?room=`. *(C'est le « améliore le prompt ».)* Testable seule (mock : 2 onglets, voir que la jonction marche, sans gameplay).
3. **Couche réseau co-op** (`index.html`) : `startCoopInsane(role)`, envoi/réception `snapshot` & `input`, rendu interpolé de l'invité + des bots côté invité.
4. **IA multi-cible** : bots ciblent le joueur le plus proche ; spawn hors-vue des 2.
5. **Résolution des tirs/melee de l'invité côté hôte** + événements (hit/death/wave) relayés pour FX/SFX.
6. **Règles co-op** (mort partagée, score/timer communs, densité ×2 joueurs) + polish.

Chaque tranche est **testable** (2 onglets du navigateur en local : un hôte, un invité).

---

## 8. Fichiers touchés

- `server.js` — rooms + relais (étape 1).
- `public/index.html` — UI d'invitation, détection `?room=`, `startCoopInsane`, snapshots/inputs, IA multi-cible, rendu invité (étapes 2–6).
- `shared/config.js` — éventuels réglages (taux de snapshot, densité co-op).
- (Optionnel) `docs/WORKLOG.md` — entrée de session.

---

## 9. Risques & limites v1

- **Latence invité** : bots/hôte interpolés → léger retard chez l'invité (ok PvE).
- **Hôte = juge** : pas d'anti-triche (sans objet entre amis).
- **Pas de migration d'hôte** : si l'hôte part, la session s'arrête.
- **Charge** : 28 bots × snapshot 20 Hz = ~quelques Ko/s par room → négligeable pour Render.
- **Évolutions** : revive, 3–4 joueurs (le relais room le permet, l'UI/règles à étendre), passage serveur-autoritaire pour le ranked.

---

*Spec rédigée à valider avant codage. Prochaine étape proposée : étape 1 (serveur rooms) + étape 2 (UI d'invitation), testables ensemble en 2 onglets.*
