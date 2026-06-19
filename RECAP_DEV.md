# FRACTURE — Récap de développement

> Compilation de tout le travail réalisé sur le prototype FPS **FRACTURE**
> (navigateur · Three.js **r184** · serveur Node.js WebSocket). Projet de **Femz**.
> Voir aussi `CLAUDE.md` (mémoire projet : conventions + où vit chaque système).

## Vue d'ensemble
FPS multijoueur navigateur à **mouvement rapide** (slide, slide jump, wall bounce, grimpe, superglide).
Mode **Mêlée** en ligne (FFA, jusqu'à 6 joueurs, premier à 10 éliminations) + mode **Entraînement**
hors-ligne contre des bots (difficulté easy→insane ; **Insane = survie par vagues**). DA néon / street-art « FRACTURE ».

---

## 1. Visuels & assets (hors-jeu)
- **Logo skull** découpé → 2 PNG transparents : version coupe nette + version halo conservé (testés sur damier / fonds colorés).
- **Maquette HUD** FPS interactive (`hud_mockup.html`) dans la DA néon (vie/bouclier, momentum, viseur…).
- **Map** : 5 vues cohérentes d'une map FPS futuriste minimaliste N&B (« movement playground »).
- **Logo FRACTURE** recadré (`menu_logo.png`).
- **Prompts** : style graffiti/street-art N&B moderne ; vidéo Seedance (fond menu animé) ; skull street-art.

## 2. Gameplay & feel
- **Vitesse ADS** plafonnée à **17** (option).
- **Viseur** : point central blanc **seulement avec le sabre** (croix normale aux armes à feu).
- **Tracer** jaune **attaché au canon** (`muzzleWorldPoint` / `spawnTracerFromMuzzle` / `updateAttachedTracer`) — fix du dépassement en strafe rapide.
- **Speed max** inférieur arme à feu vs sabre (`MAX_SPEED_GUN`).
- **Hit-reg** : fix — des déco (rails/strips/contact-shadows) étaient à tort dans `mapMeshes` (collision balles) → retirées ; les tirs suivent le cylindre de debug.
- **Saut procédural** (`applyJumpPose`, bones jambes) en remplacement de la roulade ; **auto-jump** fonctionnel dans **tous** les états (slide, crouch), plus seulement à l'idle.
- **Dash sabre** : son `dash.mp3` + **camera shake léger** (amplitude `wbShake` rendue proportionnelle).

## 3. IA bots & mode entraînement
- **IA combat** complète : perception (LOS, view_range 24 m), tir en rafale dès **15 m** (plus proche = rafale plus longue), accuracy par tier, **dégâts réels** au joueur, malus de précision quand le joueur va vite (`move_pen`), esquive saut **30 %** du temps (pas à chaque tir), spawn **≥ 15 m** entre bots, **max 2 orbs** (fade la plus ancienne).
- **Score BOT MODE** + reset des kills à la mort.
- **Mode Insane par vagues** : vague 1 = **3 bots** (cap dur), effectif **exponentiel** `min(8, round(3·1.25^(v-1)))`, **anti sur-spawn** (despawn du surplus → fix des « bots fantômes » restant vivants à la mort), **létalité exponentielle** douce→plafond (`applyInsaneWave`, `stat(v)=base+(cap−base)(1−0.78^(v-1))`).

## 4. Menu & UI (refonte FRACTURE)
- **Options** : refonte 2 colonnes, toggle segmenté clavier/manette + icônes, course auto (sprint PC), mode accroupi (maintenir/toggle), **saut manuel/auto**.
- **Vidéo de fond** bouclée sur l'accueil (`menu_bg.mp4`) : flou léger + blancs assombris (lisibilité), opacité réglée ; **menu in-game net** (pas de flou sur le jeu).
- **Menu FRACTURE** : logo en haut, **aperçu 3D temps réel** de la map (`initFractureMenu` / `pvStart`, caméra par mode), pseudo éditable, sélection de mode + bouton **Lancer**, tiroir difficulté, animations UI (slides), écran **OPTIONS restylé**.
- Repositionnements (difficulté à droite, info mêlée sous Lancer, OPTIONS détaché en bas), fond bleu animé retiré.

## 5. Sabre & attaque spéciale (Overcharge)
- **Arcs électriques** (`LineSegments`, additif) **émis de la surface réelle de la lame** (échantillonnage du mesh) — remplacent les anciennes « bulles » rondes ; dégradé cyan→violet, crépitement par re-randomisation.
- **Cylindre fantôme** (glow tube) retiré.
- **Overcharge** : rayon de touche **5 → 10 m** ; **popup rouge** « ATTAQUE SPÉCIALE » à l'unlock (3 kills d'affilée).
- **Bouton dédié** (action `special`) : défaut **KeyQ** (= touche A sur AZERTY) / manette **LT/L2** ; **libellé de touche affiché en live** (vrai layout via `navigator.keyboard.getLayoutMap`, device courant clavier/manette via `inputDevice`).

## 6. Animation third-person (bots & ennemis réseau)
- **Système en couches** : clips filtrés par bone (`makeLayerClip` / `buildLayerClips`, tracks quaternion) → **LOWER** (jambes) + **UPPER** (chest/bras/tête/doigts), joués simultanément sur le même mixer.
- **Locomotion bas du corps directionnelle** : Run_Right / Run_Left / Run_Shoot / Walk / Idle_Neutral selon la **vélocité locale** ; pas de jambes qui courent en l'air.
- **Haut du corps indépendant** : `Gun_Shoot` frame 1 figée (pose combat) ou jouée au tir ; `Idle_Sword` au sabre ; hook `Sword_Slash`.
- **Hips-aim + rotation corps** (`applyBodyAim`) après `mixer.update` : torse qui vise (clamp 58°, lissé), corps qui tourne si l'écart dépasse.
- **Armes attachées à `Index1.R`** : `WEAPON_ATTACH_CONFIG`, socket `WeaponSocket_R`, load-once + clone, R69 / Wingman, **sabre extrait de `arms.glb`**, show/hide selon l'arme.
- **Debug** `ANIM_DEBUG` (touche **J**) : overlay lower/upper anim, arme, firing, grounded, vélocité locale, yaw aim/corps/twist, bone trouvé, armes attachées.
- **Câblage** bots + ennemis réseau (`enrichNetAnim`) + champ arme `w` ajouté au snapshot **serveur**.
- **Correctifs** (suite au test console) : noms de bones **insensibles aux points** (à l'export GLB `UpperLeg.L`→`UpperLegL`, `Index1.R`→`Index1R`) → LOWER se construit + arme trouvée ; **anti-snap** du facing via `rotateTowards` (`faceSoldierYaw`, `turn_rate` 12 rad/s) en **live + replay killcam**.

## 7. Audio
- **`dash.mp3`** : déclaré dans `SFX_FILES`, joué au dash sabre.
- **`ambiance.mp3`** : couche d'ambiance in-game (`AMBIANCE_FILE` / `AMBIANCE_VOLUME`, boucle, fondu silencieux si absente).

## 8. Méthode & outils
- Édition du code via **bash + Python** (le chemin hôte contient une espace qui casse Read/Write/Edit), sur le mount ; `node --check` après chaque édit ; `.bak` avant chaque édit.
- **Blender MCP** pour les vrais noms de bones du rig SWAT (62 bones).
- Génération d'images (logo, map) ; lecture d'un repo Three.js externe (character-controls) pour le pattern `rotateTowards` (anti-snap).

## En attente / à régler
- **Tuning des offsets** d'armes attachées (`WEAPON_ATTACH_CONFIG`, placeholders 0 / scale 1) — à régler visuellement en jeu (capture).
- **Arme aléatoire par bot** (défaut actuel = R69).
- **Tap-strafe** plus snappy (`TAPSTRAFE_TURN_RATE`).
- Vérifier en jeu la rotation corps/hips (à-coups éventuels) ; tuning `turn_rate`.
- Crâne street-art alpha (jamais finalisé).

## Fichiers clés
- Code : `public/index.html` (client, ~8100 lignes), `shared/config.js` (`GAMECFG`/`CONFIG`), `shared/map.js`, `server.js`.
- Assets : `public/audio/` (dash.mp3, ambiance.mp3…), `public/models/` (SWAT.glb, weapon/wingman/arms.glb), `public/menu_bg.mp4`, `public/menu_logo.png`.
- Docs : `CLAUDE.md` (mémoire projet), `RECAP_DEV.md` (ce fichier).
