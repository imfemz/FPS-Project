# CLAUDE.md — FRACTURE (prototype FPS multijoueur browser)

> Mémoire de projet pour Claude (Cowork). **À lire en premier** dans chaque nouvelle conversation.
> Projet de **Femz**. FPS multijoueur navigateur · **Three.js r184** · serveur Node.js WebSocket.

## ⚠️ CONVENTIONS TECHNIQUES — lire AVANT d'éditer
- **Édition du code = bash + Python uniquement.** Le chemin hôte contient une espace
  (`/Users/femz/Game Dev/FemzFPS /prototype-web/fps-r184`) qui **casse Read/Write/Edit**.
  Toujours éditer sur le mount : `/sessions/<session>/mnt/fps-r184/`.
- **Pattern d'édition sûr** : `cp f f.bak_<feature>_$(date +%H%M%S)` → Python avec
  `assert s.count(old)==1` (unicité) puis `s.replace(old,new)`. Heredoc `'EOF'` quoté pour les gros blocs.
- **Valider après CHAQUE édit** (extraire le plus gros `<script>` + node --check) :
  `python3 -c "import re;s=open('public/index.html',encoding='utf-8').read();b=max(re.findall(r'<script(?![^>]*src=)[^>]*>([\s\S]*?)</script>',s),key=len);open('/tmp/g.js','w').write(b)" && node --check /tmp/g.js`
  Et `node --check shared/config.js` / `server.js` si touchés.
- **Three.js r184** (modules ES + importmap), PAS r128.
- **Noms de bones du perso** : utiliser le **Blender MCP** (scène SWAT ouverte), ne pas supposer.
- Toujours un **.bak** avant d'éditer.

## Structure
- `public/index.html` (~8100 lignes) — tout le client : un gros `<script type="module">`. HUD/menus (HTML+CSS) en haut, JS dessous.
- `shared/config.js` — `GAMECFG`/`CONFIG` : armes, MELEE/overcharge, MODELS (anim/bones), audio, graphics.
- `shared/map.js` — géométrie map (blocks AABB, miroir N/S).
- `server.js` — serveur WebSocket FFA (snapshot joueurs, validation tirs/sabre).
- `public/audio` (SFX + musiques), `public/models` (SWAT.glb + armes .glb), `public/textures`.
- Lancement : `npm start` → `localhost:3000`. Mode **Entraînement** (bots) / **Mêlée** (online).

## Systèmes clés (où chercher)
- **Moteur** : `buildScene()` (~758), `buildMap()` (~1146), `buildViewmodel()` (~2565), boucle `animate()` (~7379). `scene/camera/renderer` globaux ; viewmodel FP séparé (`gun`/`gunScene`/`gunCam`).
- **Menu FRACTURE** : HTML `#menu` (~436, classes `.fr-*`), IIFE `initFractureMenu` (aperçu 3D `pvStart` qui rend la `scene` globale avec caméra par mode, pseudo éditable, sélection mode, tiroir difficulté), `buildOptions()`.
- **Bots / vagues** : `LBOT` (~4753 : tiers easy/medium/hard/insane, `MAX_BOTS=8`), `botsForWave`/`spawnBotWave`/`checkWaveClear`, `applyInsaneWave` (courbe expo), `updateLocalBots`, `startLocalBotMode`. Insane = survie par vagues.
- **Sabre / overcharge** : `GAMECFG.MELEE` (`overcharge.radius=10`), `ensureSaberFX`/`updateSaberFX` (arcs électriques `LineSegments` émis de la lame), `overReady`/`launchOvercharge`/`applyOverchargeDamage`, `trySpecial` (bouton dédié), `showOverchargeReady` (popup rouge).
- **Anim 3e personne (bots/remotes)** : `createSoldierRigged` (~2461), `animateSoldierRigged` (driver EN COUCHES), `makeLayerClip`/`buildLayerClips` (filtrage tracks), `applySpineAim` (pitch) + `applyBodyAim` (twist hips + rotation corps), `WEAPON_ATTACH_CONFIG`/`attachWeaponsToSoldier`/`setSoldierWeapon` (armes sur `Index1.R`), `enrichNetAnim`, `ANIM_DEBUG` (toggle **touche J**). Le joueur LOCAL FP n'utilise PAS ce système.
- **Inputs/binds** : `DEFAULTS.kb`/`.gp` + `cfg`, `actionDown`, `ACTIONS` (table Options), `kbName` (libellé via `navigator.keyboard.getLayoutMap` → AZERTY), `inputDevice` (clavier/manette détecté en live).
- **Audio** : `SFX_FILES` (config), `playSfx`/`playSfxAt`, `startAmbient` (ambient + couche `ambiance.mp3`), `AMBIANCE_FILE`/`AMBIANCE_VOLUME`.

## Bones SWAT (rig réel, 62 bones)
- Hiérarchie : `Root→Body→{Hips→Abdomen→Torso→Chest→Neck→Head + bras}` et `{UpperLeg.L/R→LowerLeg.L/R}` ; `Foot.L/R`+`PT.L/R` sous Root (IK).
- Noms réels : `LowerArm` (pas ForeArm), `Wrist` (pas Hand), spine = `Abdomen/Torso/Chest`. `Index1.R` existe (socket arme).
- Clips : préfixe `CharacterArmature|` + Idle_Neutral, Run_Right/Left/Shoot, Walk, Gun_Shoot, Idle_Sword, Sword_Slash, Death, HitRecieve…
- Couches : LOWER = jambes ; UPPER = Chest+bras+tête+doigts ; AIM (procédural) = Hips+Abdomen+Torso.

## Tunables fréquents
- Overcharge : `MELEE.overcharge.radius` (10), `dmg_front`/`dmg_side`.
- Insane : `LBOT.ai.insaneCurve` (base→cap, r=0.78) ; `botsForWave` = `min(8, round(3·1.25^(v-1)))`.
- Ambiance : `AMBIANCE_VOLUME` (0.5) ; ambient d'origine : `AMBIENT_FILE`/`AMBIENT_VOLUME`.
- Armes 3e pers. : `WEAPON_ATTACH_CONFIG` (offsets pos/rot/scale par arme — **À RÉGLER visuellement**).
- Anim : `MODELS.layer_anim` (seuils course/marche), `MODELS.body_aim` (max_deg 58, smooth).

## Fait
- **Visuels** : découpe logo skull (2 PNG alpha), maquette HUD, 5 vues map N&B, logo FRACTURE recadré.
- **Feel** : ADS max 17 ; point central seulement au sabre ; tracer attaché au canon ; speed armes < sabre ; fix hit-reg ; saut procédural (remplace roulade) ; auto-jump tous états ; dash = son + shake.
- **Bots** : IA complète (perception, rafale dès 15 m, accuracy par tier, dégâts réels, esquive 30 %, spawn ≥15 m, max 2 orbs) ; score BOT MODE ; Insane par vagues (cap 3, expo ≤8, anti sur-spawn, létalité expo).
- **Menu** : refonte Options ; vidéo de fond accueil ; menu FRACTURE (logo, aperçu 3D live, pseudo, tiroir, OPTIONS restylé).
- **Sabre** : arcs électriques de la lame ; cylindre fantôme retiré ; overcharge rayon 10 + popup + bouton dédié (KeyQ/AZERTY A, manette LT/L2) + libellé touche en live.
- **Anim 3e pers.** : système en couches LOWER/UPPER, locomotion directionnelle, haut du corps indépendant, hips-aim + rotation corps, armes sur Index1.R (sabre extrait de arms.glb), debug J.
- **Audio** : `dash.mp3` (SFX), `ambiance.mp3` (couche in-game).

## En attente / à faire
- **Arme aléatoire par bot** (défaut actuel = R69).
- **Tuning des offsets** d'armes attachées (Index1.R) — placeholders 0/scale 1, à régler en jeu (capture).
- **Tap-strafe** plus snappy (`TAPSTRAFE_TURN_RATE`).
- Vérifier en jeu la rotation corps/hips (pas d'à-coups vs facing réseau).
- Crâne street-art restylé (alpha, upscale) — jamais finalisé.

## Préférences de Femz
- Français, clavier **AZERTY**. Solides connaissances audiovisuel / 3D / motion design.
- **Concis et direct**, peu de blabla. **Poser des questions** quand c'est ambigu (surtout les choix qui changent l'implémentation).
- Itère vite ; pour tout ce qui est rendu visuel, faire valider par capture d'écran.
- Si `server.js` change → lui rappeler de **redémarrer le serveur**.
