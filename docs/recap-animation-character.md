# Récap — Animations du personnage (FRACTURE, proto web)

Système d'animation tierce-personne des **bots & joueurs réseau**. État actuel (juin 2026).

## 1. Le modèle

- **Fichier** : `public/models/AnimatedBaseCharacter.glb` (~2.3 Mo)
- **Rig** : Rigify (bones préfixés `DEF-…`) — **53 bones**, **1 mesh skinné**, **45 clips**
- **Échelle** : `character_scale: 1` · **Orientation** : `character_yaw_deg: 180` (l'« avant » Rigify est inversé → +180°)
- **Hitbox capsule** (client + serveur) : `radius 0.42`, `bottom 0`, `top 1.86`, `top_crouch 1.22`, `head 0.33`
- Clone du rig en jeu : `SkeletonUtils.clone` (gère le multi-mesh + rebind du squelette)
- Tout est piloté par `shared/config.js > MODELS`.

## 2. Principe : animation EN COUCHES (double anim)

Un seul `AnimationMixer`, mais chaque clip source est **filtré par groupe de bones** (`makeLayerClip`) pour produire 2 versions jouées **en même temps** :

| Couche | Bones | Rôle |
| --- | --- | --- |
| **BAS** (LOWER) | `DEF-thigh.L/R`, `DEF-shin.L/R`, `DEF-foot.L/R`, `DEF-toe.L/R` | Locomotion (jambes) |
| **HAUT** (UPPER) | `DEF-spine.003`, `DEF-neck`, `DEF-head`, `DEF-shoulder.*`, `DEF-upper_arm.*`, bras/mains | Combat (arme, tir, sabre, réactions) |
| **VISÉE** (procédural, jamais piloté par un clip) | `DEF-spine.001`, `DEF-spine.002` | Twist du torse vers la cible |

→ Le perso peut **courir des jambes** (BAS) **en tirant du haut du corps** (HAUT) **tout en visant** (procédural), simultanément.

## 3. Couche BAS — locomotion

**Clips utilisés** : `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Crouch_Idle_Loop`, `Crouch_Fwd_Loop`, `Jump_Loop`, `Death01`.

**Sélection** d'après la **vitesse locale** (vx/vz dans le repère du corps) :

- En l'air → `Jump_Loop`
- Vitesse < `walk_thresh` (0.5 m/s) → `Idle_Loop`
- Déplacement **latéral / arrière** (angle mvt↔visée > `side_deg` 50°) → `Walk_Loop`
- Déplacement **avant** rapide → `Jog_Fwd_Loop` ↔ `Sprint_Loop` (mix par vitesse, plage `jog_lo` 6 → `jog_hi` 8 m/s)
- Accroupi → `Crouch_*` (+ pose procédurale, voir §5)

Transitions par `crossfadeLayer` (fondu ~0.12 s).

## 4. Couche HAUT — combat / bras

**Clips utilisés** : `Pistol_Idle_Loop`, `Pistol_Shoot`, `Sword_Idle`, `Sword_Attack`, `Hit_Chest`, `Hit_Head`, `Idle_Loop`.

**Sélection** d'après l'arme + l'état :

- **Flingue** : `Pistol_Idle_Loop` au repos · `Pistol_Shoot` au tir (one-shot / freeze de pose de combat)
- **Sabre** : `Sword_Idle` au repos · `Sword_Attack` au swing (one-shot)
- **Dégâts subis** : `Hit_Chest` / `Hit_Head` (one-shot, par-dessus)

Helpers : `playUpperOnce` (clip one-shot), freeze frame 1 = pose de combat tenue.

## 5. Surcouches PROCÉDURALES (après `mixer.update`)

Calculées chaque frame, par-dessus les clips :

- **`spine_aim`** — pitch (regard haut/bas) réparti sur `DEF-spine.001/002/003`. `pitch_gain 0.65`, `sign -1`, `max 1.3`.
- **`body_aim`** — twist horizontal du torse vers la cible : `DEF-spine.001` (0.55) + `DEF-spine.002` (0.45). `max_deg 58` (torsion max avant que le corps pivote), `smooth 12`, `turn_follow 7` (vitesse à laquelle le bas rattrape le regard). → le perso **ne tourne plus le dos en tirant**.
- **`jump_pose`** — pose de jambes en l'air : `upperleg [0.85,0,0.08]`, `lowerleg [-0.95,0,0]`, `blend 12`.
- **`crouch_pose`** — squat procédural : `upperleg [0.9,0,0.12]`, `lowerleg [-1.3,0,0]`, `hips/abdomen/torso` (lean), `blend 10`.

## 6. Arme attachée

- `weapon: '/models/weapon.glb'` accrochée à la main (socket sur `DEF-hand.R`), `weapon_position [0,0.1,0]`.
- Sabre = clips `Sword_*` (le modèle de lame est géré à part).

## 7. Fallback plein-corps

Si les clips de couche manquent → bascule sur les clips **plein-corps** via `character_anims` (préfixe `Rig|…` : `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Death01`, `Hit_*`, `Pistol_*`, `Sword_*`, `Crouch_*`, `Jump_Loop`). Death & Hit passent toujours par là.

## 8. Où c'est dans le code

- **Config** : `shared/config.js > MODELS` (~l.596-657) — clips, bones, seuils, poses.
- **Client** `public/index.html` :
  - `LOWER_BONES` / `AIM_BONES` / `_UPPER_PREFIX` — découpage des couches
  - `LOWER_CLIP_SOURCES` / `UPPER_CLIP_SOURCES` — quels clips deviennent des couches
  - `makeLayerClip` / `buildLayerClips` — fabrication des clips filtrés (cache sur le template)
  - `createSoldierRigged` — instancie le rig, le mixer, les couches, le socket d'arme
  - `animateSoldierRigged` — choisit BAS + HAUT chaque frame ; `crossfadeLayer`, `playUpperOnce`
  - `applyBodyAim` / `applySpineAim` / `applyJumpPose` / `applyCrouchPose` — surcouches procédurales
  - `enrichNetAnim` — déduit vitesse/visée/arme pour les bots & joueurs réseau

## 9. Clips disponibles mais NON utilisés (réserve)

Le pack en contient 45 ; non câblés pour l'instant : `Pistol_Aim_Up/Down/Neutral`, `Pistol_Reload`, `Jump_Start`, `Jump_Land`, `Roll` (+ `_RM`), `Punch_Jab/Cross/Enter`, `Push_Loop`, `Swim_*`, `Sitting_*`, `Spell_*`, `Dance_Loop`, `Driving_Loop`, `Interact`, `PickUp_Table`, `Walk_Formal_Loop`, `Idle_Talking/Torch_Loop`, `Fixing_Kneeling`…
→ Pistes faciles : `Jump_Start`/`Jump_Land` (décollage/atterrissage), `Pistol_Reload` (recharge visible), `Pistol_Aim_Up/Down` (au lieu du spine_aim procédural).
