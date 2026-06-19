# Récap session — Animation 3ᵉ personne · Armes · Tir · Textures

**Projet :** Femz FPS — prototype web Three.js (`prototype-web/fps-r184`)
**Date :** 2026-06-19
**Portée :** refonte de l'**animation 3ᵉ personne** du SWAT (système en couches : locomotion par input + haut du corps indépendant + délai de rotation), **déplacement directionnel**, **réaction des bots**, **armes en main** (R69/Wingman/Saber), **muzzle flash + ligne de tir**, **anim de hit**, **swing sabre réseau**, et **textures de la map**. Tout est poussé sur GitHub (`main`) ; Render redéploie automatiquement.

> ⚠️ `server.js` a été modifié cette session (swing sabre) → **redémarrer le serveur** (`Ctrl+C` puis `npm start`) pour l'online.

---

## 1. Animation 3ᵉ personne — système en COUCHES

Le rendu 3ᵉ pers (bots + joueurs réseau) utilise un driver en **couches** sur un seul `AnimationMixer` par soldat. Le joueur LOCAL en 1ʳᵉ pers n'utilise PAS ce système.

- **Couches** : `makeLayerClip()` filtre les tracks d'un clip par bone →
  - **LOWER** (jambes + `Body`) : `Run, Run_Back, Run_Left, Run_Right, Walk, Idle_Neutral, Death`
  - **UPPER** (torse + bras + tête + doigts) : `Gun_Shoot, Idle_Sword, Sword_Slash, Idle_Neutral, HitRecieve`
  - **AIM** (procédural, après mixer) : `Hips/Abdomen/Torso`.
- **Bones SWAT** : le rig réel n'a **pas de séparateurs** (`Index1R`, `UpperLegL`, `WristR`, `FootL`…). Matching tolérant via `_normBone(n)=(n||'').replace(/[._\s]/g,'')`. Ce détail avait cassé l'attache des armes + le mapping des jambes (découvert au runtime, pas à l'audit statique).
- **Pieds (déformation corrigée)** : `UpperLeg/LowerLeg` sont sous `Body`, `Foot/PT` sous `Root` (IK). Les clips animent la **position** de `Body` (bob vertical). La couche LOWER inclut donc `Body` **entièrement** (position + rotation) → jambes/chevilles/pieds restent alignés.
- **Séparation propre haut/bas** : le lean de course de `Body` est **annulé au niveau du Hips** en mode couches :
  `Hips_local = Body_local⁻¹ × Body_rest × Hips_rest × twist` → le haut du corps est piloté **uniquement par la visée + les clips de bras** (stable en course), indépendamment des jambes.
- **Visée procédurale** (après `mixer.update`) :
  - `applySpineAim()` : **pitch** (regard haut/bas) sur la colonne. *(inversion corrigée : `spine_aim.sign = -1`.)*
  - `applyBodyAim()` : **twist** du buste vers la visée + délai de rotation (cf. §3).
- **Debug** : overlay `ANIM_DEBUG` (touche **J**).

## 2. Bas du corps piloté par INPUT (refonte)

Le bas du corps choisit un **clip** selon l'input (vitesse locale `vx`/`vz`), avec crossfade fluide :

| Input | Clip |
|-------|------|
| Avancer (course) | `Run` |
| Marche (vitesse modérée / oblique) | `Walk` |
| Reculer | `Run_Back` |
| Strafe droite / gauche | `Run_Left` / `Run_Right` *(mapping inversé volontaire)* |
| Immobile | `Idle_Neutral` |
| **Accroupi** | `Death` **figé** (frame 7) |
| **Saut / air** | `Run` **figé** (frame 4) |

- Saut & crouch = **poses statiques** : `freezeLowerPose(s, key, time)` joue le clip puis `paused=true; time=frame/fps`.
- Locomotion = `crossfadeLayer(s,'lower',key,0.12)`.
- Les anciennes **rotations manuelles des jambes** (`applyCrouchPose`/`applyJumpPose` procéduraux) ont été **retirées** du mode couches.
- Config : `MODELS.lower_pose = { fps:24, jump_clip:'Run', jump_frame:4, crouch_clip:'Death', crouch_frame:7 }`.
- Réglage live : **`tuneLowerFrame(jumpFrame, crouchFrame)`**.

## 3. Délai de rotation HAUT / BAS

Quand le perso tourne, le **bas** ne pivote plus d'un bloc avec le regard :

- `applyBodyAim()` fait **rattraper progressivement** `s.legYaw` (facing des jambes) vers la direction voulue (`turn_follow`), pendant que le **haut** twiste vers la visée.
- Clamp dur : le bas n'a jamais plus de `max_deg` de retard.
- Config : `MODELS.body_aim.turn_follow` (défaut **7** ; plus bas = plus de délai).
- Réglage live : **`tuneTurn(follow)`**.

## 4. Haut du corps — tir / sabre / hit

- **R69 / Wingman** : tir → `Gun_Shoot` (one-shot, restart par tir) ; sinon **freeze frame 1** (pose de combat).
- **Sabre** : `anim.saber_attack` → `Sword_Slash` (one-shot) ; sinon `Idle_Sword`.
- **Hit** : `HitRecieve` joue sur le **HAUT du corps seulement** → les jambes gardent leur anim d'input.
  - `playHitAnim()` : en mode couches, pose `s.hitUpperUntil` (≈420 ms) au lieu de figer le plein-corps. Fallback plein-corps si couches pas prêtes.
  - Helper générique : `playUpperOnce(s, key, fade)` (utilisé pour `HitRecieve` et `Sword_Slash`).

## 5. Swing sabre en RÉSEAU (online)

Le serveur ne relayait que le **hit** résultant d'un coup de sabre, jamais le **swing** → l'adversaire ne s'animait pas.

- **`server.js`** : dans le handler `t:'melee'`, ajout de `broadcastExcept(c.id, { t:'swing', seat:c.seat })` (touché **ou** manqué).
- **Client** : `case 'swing' → onRemoteSwing(m)` pose `b.saberSwingUntil = now + 450 ms`.
- `enrichNetAnim()` règle `b.anim.saber_attack` tant que le timer court → `Sword_Slash` 3ᵉ pers.

## 6. Armes en main (R69 / Wingman / Saber)

- Attache sur le bone **`Index1.R`** via `weaponSocket` ; GLB chargé une fois + cloné. **Compensation de l'échelle monde du bone** (les bones du rig sont à l'échelle ~99) dans `_applyWeaponOffset()` : `scale = native × cfg.scale / worldScale`.
- **`WEAPON_ATTACH_CONFIG`** (`public/index.html`) :
  - **R69** : `weapon.glb`, pos `(0, 0.001, 0)`, rot `(100, -22, 95)°`, **scale 0.35** *(calé en jeu, validé)*.
  - **Wingman** : `Wingman_swat.glb`, **scale 1** (taille bakée Blender), rot **`(-80, 22, 85)°`** = R69 retourné de 180° (flip local Y) pour que le **canon pointe vers l'avant** (et pas vers le joueur).
  - **Saber** : `Saber_swat.glb`, **scale 1**, rot `(100, -22, 95)°` (= R69).
- Réglage live : **`tuneWeapon(key, px,py,pz, rxDeg,ryDeg,rzDeg, scale)`** — réapplique à tous les bots/remotes (rotation en degrés), pour caler sans deviner.

## 7. Muzzle flash + ligne de tir alignés à l'ARME

Avant : le tracer distant partait de `m.o` (= position **œil/tête** de l'envoyeur) et le flash tombait sur `root` (le bone main n'était jamais trouvé).

- **Flash** : sur `root` (échelle 1 — un flash enfant d'un bone serait géant), **repositionné au canon à chaque tir** (`root.worldToLocal(muzzle)`).
- **Tracer** : part de `soldierMuzzleWorld(soldier, dir)` = position monde du `weaponSocket` (Index1.R) avancée vers la cible, au lieu de l'œil.
- S'applique au tir réseau (`onRemoteShot`) et au remote 1v1 (`triggerRemoteMuzzleFlash`).

## 8. Déplacement directionnel

- Vitesse **décomposée** avant/latéral sur le `wishDir` :
  - **Course (avancer)** : `WALK_SPEED = 7` m/s (plafonné même en sprint/autosprint).
  - **Strafe (g/d) + recul** : `STRAFE_SPEED = 4` m/s.
- Le **momentum** (slide / dash / bunnyhop) reste au-dessus (vélocité directe, bornée par `MAX_SPEED`). Crouch + ADS conservés.

## 9. Bots — réaction au hit retardée

- Quand un bot est touché, il **n'esquive plus à l'instant du tir** : esquive + saut déclenchés après un délai → plus facile à viser/enchaîner.
- Config : `LBOT.ai.evade_react` (défaut **0.3 s**).

## 10. Textures de la map (réactivées)

`applyCustomTextures()` était **désactivé** → les changements dans `GAMECFG.TEXTURES` n'avaient aucun effet.

- **Réactivé** : appelé à la fin de `buildMap()`. Applique une texture par surface : **sol / mur / caisse / plateforme / rampe** (les caisses utilisent un UV métrique via `bakeBoxUV`).
- Pilotage : `GAMECFG.TEXTURES` (fichiers) + `GAMECFG.TEXTURE_REPEAT` (densité) dans `shared/config.js` ; `GRAPHICS.tex_brightness` pour la luminosité (scène de nuit = sombre par défaut).
- Réglage live : **`window.applyMapTextures()`** (réapplique après édition du config en console).

---

## Fichiers principaux touchés
- `public/index.html` — tout le client (anim 3ᵉ pers, armes, tir, hit, textures, déplacement, bots).
- `shared/config.js` — `MODELS` (`spine_aim`, `body_aim.turn_follow`, `layer_anim`, `lower_pose`), vitesses (`WALK_SPEED`/`STRAFE_SPEED`), `LBOT.ai.evade_react`, `TEXTURES`/`TEXTURE_REPEAT`.
- `server.js` — broadcast du swing sabre (`t:'swing'`). **→ redémarrer le serveur.**
- `public/models/` — `Wingman_swat.glb`, `Saber_swat.glb` (armes 3ᵉ pers).
- `public/textures/` — `Asphalt_001_COLOR.png` (sol/mur).

## Réglages live (console navigateur)
| Commande | Effet |
|----------|-------|
| `tuneWeapon('WINGMAN', 0,0.001,0, -80,22,85, 1)` | pos/rot(°)/scale d'une arme en main (tous les soldats) |
| `tuneLowerFrame(jumpFrame, crouchFrame)` | frames figées saut/crouch (lues @ `lower_pose.fps`) |
| `tuneTurn(follow)` | délai de rotation haut/bas (bas = + de délai) |
| `tuneCrouch(ulX, llX, hipsX, abdX, ulZ)` | pose accroupie procédurale *(legacy, fallback plein-corps)* |
| `applyMapTextures()` | réapplique les textures de la map |

## À faire / à valider en jeu
- **Wingman/Saber en main** : vérifier l'orientation (le flip Wingman `(-80,22,85)` ; sinon essayer `tuneWeapon('WINGMAN',0,0.001,0, 100,-22,-85, 1)` ou `(...,-80,22,-95,1)`). Le **Saber** peut nécessiter le même flip que le Wingman.
- **Frames figées** crouch (`Death` f7) / saut (`Run` f4) : caler la frame exacte via `tuneLowerFrame`, puis graver.
- **Délai de rotation** haut/bas : valider le ressenti (`tuneTurn`).
- **Online** (après redémarrage serveur) : swing sabre adverse → `Sword_Slash`.
- **Textures** : ajuster `tex_brightness` / `TEXTURE_REPEAT` ; envisager des **maps PBR** (normal/roughness) si besoin de relief.
- **Bot** : arme aléatoire par bot (défaut actuel = R69).
- Config **obsolète** à nettoyer un jour : `MODELS.crouch_pose` / `MODELS.jump_pose` (procéduraux, plus utilisés en mode couches).

🤖 Récap généré avec Claude Code
