# Session de travail — Femz FPS (prototype web r184)

> Récapitulatif de la conversation avec Claude Code.
> Projet : `prototype-web/fps-r184` — FPS navigateur Three.js r184, déployé sur Render (fps-project.onrender.com).
> Dates : 17–18 juin 2026.

---

## Contexte

- Le jeu vise un **FPS multijoueur AAA réaliste**, à terme reconstruit sur **Unity 6 (HDRP)**.
- Le **prototype web** (`prototype-web/fps-r184/`) sert désormais de **cahier des charges** (feeling de déplacement, map, équilibrage, netcode) et de **banque d'assets** (.glb, audio).
- Tout le client tient dans un seul `public/index.html` (~6300 lignes, un gros `<script type="module">`).
- Config partagée : `shared/config.js` (GAMECFG) + `shared/map.js` (géométrie de la map).
- Serveur : `server.js` (Node `ws`, FFA server-authoritative).
- **Règle permanente** : après chaque changement, pousser sur GitHub via `./publier.sh "message"` (Render redéploie en ~2-3 min).

---

## Demandes traitées dans la session

### HUD / interface
- Cartes du HUD en bas **de taille égale** (gauche alignée sur droite), puis **réduites verticalement**.
- DA premium minimaliste (police Inter, cartes flottantes blur).

### Rendu / éclairage
- **AO buggé** (GTAO view-dependent, scintillant, carrés noirs dans le ciel/HUD) → **AO bakée** à la place (`GRAPHICS.AO:false`, `BAKED_AO` activé).
- **Carrés noirs supprimés** : le GTAOPass traitait les sprites overlay (nuages, dégâts, vie) comme occludeurs → caméra GTAO dédiée (layer 0) + tag des overlays sur `AO_SKIP_LAYER`, puis GTAO désactivé.
- **Death dissolve** : particules émises depuis la vraie géométrie du modèle (skinned mesh, `applyBoneTransform`).

### Bots / mode entraînement
- Plus de bots, qui **bougent**, **espacés** entre eux, **contournent** les obstacles, ne traversent pas le joueur.
- **Mode bot accessible depuis le menu principal** (bouton « Mode entraînement (bots) »), en plus du mode 1v1 en ligne.

### Audio
- Sons d'input sabre : `saber_equip` (équiper), `saber_holster` (ranger), `saber1/2/3` (attaques aléatoires).
- **Son de vitesse** (`velocity`) au max de vélocité, avec **fade out** si on interrompt.
- Correctif **.m4a périmé** : le loader charge le `.m4a` avant le `.mp3` → régénérer le `.m4a` (`afconvert -f m4af -d aac -b 96000 x.mp3 x.m4a`) après modif d'un son. (cf. mémoire `audio-m4a-priority`)
- **Plus de bruit d'arme dans les menus** (un clic ne déclenche plus de son de tir).
- **Volume des tirs ennemis** augmenté, même distants.

### Gameplay / feeling
- **Killcam retirée** (trop de bugs).
- **Indicateur de dégâts directionnel** (arc rouge HUD pointant vers le tireur).
- **Crouch toggle** : relèvement **instantané** depuis un slide (plus besoin d'attendre la fin).
- **Deadzone manette réglable** dans les options.
- **Accoups souris macOS** corrigés (`requestPointerLock({ unadjustedMovement: true })` + fallback).
- **Aim assist** : ajouté au hip-fire (plus faible qu'en ADS), puis **retuné** (était devenu trop lent et accrochait de trop loin).
- **Point central de visée** précis (marque exactement où part la balle = centre écran).

---

## Problème récurrent : hitbox des bots

Symptôme rapporté : « je suis pile sur le bot mais ça ne touche pas / la balle (rayon jaune) passe à travers ».

Pistes explorées et état :
- La capsule de hit (`rayCapsuleT`, `MODELS.hitbox` rayon 0.42, ×1.4 sur les bots) a été vérifiée **généreuse et correcte** en test isolé (capsule wireframe enveloppe le modèle).
- Désalignement **balle / viseur ADS** identifié : la balle part du **centre écran**, l'iron sight est légèrement décalé → ajout d'un point central.
- **Cause probable restante** (diagnostic de Femz, confirmé en cours) : interaction **bot ↔ collider**.
  - Quand un bot **entre dans la géométrie** (clip la rampe), sa position de capsule ne correspond plus au visuel → la balle passe « à travers ».
  - Quand un bot est **près d'un collider**, le check « mur devant » peut rejeter le hit.

---

## Corrections en cours (dernier lot, non encore poussé)

1. **Bots orientés à 180°** (dos au joueur) → corrigé : l'IA fixait `b.yaw = atan2(dxp, dzp)`, soit **π de décalage** par rapport à la convention réseau (rendu = `yaw + π`). Corrigé en `atan2(-dxp, -dzp)` (et idem pour la direction de marche). Vérifié : rendu passe de rotation `0` (dos) à `π` (face).
2. **Bots traversent la rampe** → ajout d'un **contournement de l'emprise au sol** des rampes dans `updateLocalBots` (push-out AABB), car `collide()` ne gère pas la géométrie inclinée. *(À re-vérifier : encore rapporté.)*

---

## Demandes ouvertes (à traiter)

1. **Balles qui ne touchent pas toujours** le bot même en pointant clairement dessus (on voit le rayon jaune passer à travers). Lié au clipping géométrie.
2. **Bots qui traversent encore la rampe** (« n'entrent pas dans la géométrie de la map »).
3. **Les bots doivent tirer sur le joueur** et avoir un **déplacement plus intelligent** (comme de vrais joueurs).
4. **Animation de reload du Wingman** à raccourcir un peu.
5. **Son d'arme de l'adversaire en ligne** : entendre l'arme/sabre **avec laquelle il attaque** (pas toujours le même son générique). → utiliser l'index d'arme `m.w` du message de tir distant.
6. **Aim assist hip-fire renforcé** : le viseur doit être **légèrement attiré** vers l'ennemi au tir au jugé, **même sans bouger** le stick.

---

## Repères techniques (fichiers / fonctions)

- `public/index.html`
  - `LBOT` (config bots), `initLocalBotAI`, `lbotSpawnPoint`, `updateLocalBots(dt)` (roam/chase/strafe/séparation/collision).
  - Boucle de rendu des bots (≈ ligne 6443) : `b.soldier.root.rotation.set(0, b.yaw + Math.PI, 0)`.
  - `localBotShoot(o, dir, end)` : hit local des bots (`rayCapsuleT`, check `t < wallDist`).
  - `collide(pos, radius, feetY)` : push hors des AABB (caisses/murs/plateforme), **pas les rampes**.
  - `rayCapsuleT(o, d, tpos, lowered, radMul)` : test capsule.
  - Aim assist dans `playerUpdate` (`if(g){...}`) : slowdown + magnétisme rotation.
- `shared/map.js` : `groundHeightAt(px,pz)` gère la hauteur des **rampes** (pente) et de la plateforme ; `ramps` = 2 rampes 7×7 en `z = ±8.5`, `h 1.4`.
- `shared/config.js` (GAMECFG) : graphics/AO, WEAPONS (R-69, Wingman), `AIM_ASSIST`, `MODELS.hitbox`, SFX.
- `server.js` : `rayCapsule`, `rewindPos` (lag-comp), shoot handler.

---

*Document généré à la demande de Femz pour archiver la session.*
