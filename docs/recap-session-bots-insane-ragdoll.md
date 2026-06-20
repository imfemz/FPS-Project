# RÉCAP DÉV — FRACTURE
### Session : IA bots · types d'ennemis · mode Kill contre la montre · ragdoll physique · textures
*Projet de Femz — FPS multijoueur navigateur · Three.js r184 · serveur Node WebSocket. Daté du 20 juin 2026.*

> Convention d'édition : chemin hôte avec espace → édition via **bash + Python** sur le mount, **node --check** après chaque édit, **.bak** systématique.
> Sauf mention « redémarre le serveur », tout est **client** → un simple **rechargement de page** suffit.

---

## 1. IA des bots (comportement)

- **Rush agressif** : si un bot a le joueur en vue **2 s sans être touché**, il fonce en zigzag (strafe G/D) et **tire en continu** (plus de pause de rafale). Le toucher remet le compteur à zéro. `LBOT.ai.aggro_time`.
- **Fuite bas PV** : sous **50 % PV**, un bot normal fuit le joueur (zigzag). `flee_below`. (Le Sentinel ne fuit jamais.)
- **Bonus premier coup** : tant que le joueur ne l'a pas touché, un bot inflige **×1.6** dégâts. `first_hit_mult`.
- **Précision vs vélocité du joueur** (sauf Sentinel) : 0 malus sous **6 m/s**, montée linéaire, **−30 % à 11 m/s** et plus. `botMoveAcc()`.
- **Vitesse des bots normaux** : base **4 m/s**, monte en douceur vers **~4.7–5.7** (aléatoire, re-tiré toutes les 2–4 s) quand ils engagent ; redescend à 4 quand ils te perdent.
- **Champ de vision** : cône **120°** + détection **360° sous 3 m** (`view_fov_deg`, `sense_radius`).
- **Distance de spawn entre bots (Entraînement, par difficulté)** : Easy **20 m**, Medium **15 m**, Hard **10 m**. `LBOT.spawn_sep_by_diff`.

## 2. Types d'ennemis

Système `b.type` (`normal` | `sentinel` | `drone`), `setBotType()`. Apparition **par paliers en Insane**, et **Drones & Sentinels ne coexistent jamais** dans une vague (alternance : vagues impaires = Sentinels, paires = Drones).

### Bot 2 — Sentinel
- Modèle rig actuel **teinté noir**, **×1.5** taille/hitbox, plus résistant (`hp_mult`).
- Arme **Wingman** (70 dmg corps), **course ×1.5**, **vision 90 m anti-mur** (te poursuit derrière les murs, solide → glisse), **ne tire qu'avec vraie ligne de vue**.
- **Son `sentinel.mp3`** à la 1ʳᵉ vue, puis se **fige ~4 s** (télégraphe) avant de **charger** s'il te voit encore. Sauts G/D sous 20 % PV. Spawn **le plus loin possible (~60 m)**. Son de mort dédié **`bot2_death.mp3`**.

### Bot 3 — Drone sonde
- **Orbe rouge procédural** (noyau émissif + œil + anneaux + halo), **flotte ~4 m au-dessus**, t'orbite dans ~6 m, **vélocité 7**, FOV 40°.
- **Bourdonnement `drone_sound.mp3`** en boucle spatiale (spawn → mort). **Léger bob vertical**, **se décale de 3 m** (aléatoire) toutes les 4 s s'il n'est pas touché.
- **Tir continu** depuis son **centre** (ligne de tir rouge vive), dégâts **R69**, **ne tire pas à travers les murs** (LOS requise). **Cercle FOV uni au sol** sous lui.
- À la mort : **explosion de particules + `drone_explode.mp3`**, et **drop d'une orbe** (qui tombe au sol). Spawn **min 25 m**.

## 3. Mode « Kill contre la montre » (ex-Insane chronométré)

- Mode **dédié** dans le menu (au-dessus d'Entraînement), Insane retiré du tiroir difficulté. Popup **« BATTEZ LE RECORD »** + son à la sélection.
- **Intro** : décompte **5 s** sur **écran noir** avec « TUEZ-LES TOUS » + son `countdown.mp3` → **fondu** dans le jeu → on **tombe de 30 m**, face au centre → **gros camera shake + `landing.mp3`** à l'atterrissage.
- **HUD** : **timer 2:00** en haut au centre (remplace le compass, rouge clignotant < 20 s) ; **compteur de kills** en haut à droite.
- **+1 KILL** animé qui pop (1 s) + total en fade-in à chaque kill (remplace le killfeed dans ce mode).
- **0:00** → écran **score final + freeze**.
- **Mort** : caméra 3ᵉ personne + **« VOTRE ESPRIT A QUITTÉ VOTRE AVATAR »**, jeu figé, **boutons** : *Se rebrancher à la matrice* (relance), *Revenir au salon*, *Options* (tous **cliquables à la manette**).
- **Item de buff au sol** (dès vague 4) : boule rouge flottante, 1 chance/4 toutes les 30 s à 40 m ; ramassée → **buff 20 s** sur toutes les armes (ces kills ne re-stackent pas un buff).

## 4. Buff d'arme : rouge → **violet**

- Re-skin **violet** : nom/icône d'arme dans le HUD, **texture énergie** de l'arme (y compris **pendant l'animation de recharge**), embers.
- **Halo violet pulsant** plein écran pendant tout le buff. Son **`buff_activate.mp3`** au déblocage (toast « SURCHARGE »).
- **R69 rouge** : son de tir **`r69_buff`**, **cadence accrue** (`fire_rate` 0.078 → **0.062**), **recharge ×2** (anim + son).
- **Wingman rouge** : son de tir **`wingman_buff.mp3`**, recharge ×2.
- **Sabre lancé (overcharge)** : portée **10 → 20 m**.

## 5. Ragdoll physique (Rapier)

Réfs : *dev.to (mattvb91, Rapier.js)* + *codepen BagIdea*. Choix : **Rapier** (WASM), **cap 4** ragdolls simultanés.

- Import dynamique **jsDelivr** `@dimforge/rapier3d-compat` (**fail-safe** : si KO → repli sur le *topple* corps-entier, zéro régression).
- À la mort : un **corps capsule par os** (DEF-hips, spine, head, bras/avant-bras, cuisses/tibias) + **joints sphériques**, **impulsion vers l'arrière**, synchro hiérarchique des os chaque frame.
- **Colliders de la map** (sol + blocs + plateforme) → les corps tombent/s'empilent sur le décor.
- S'applique aux **bots** **et à mon propre corps** (death-cam). **Gros sang** (`spawnDeathBlood`) à la mort d'un bot (1 & 2).
- Test console : **`rdTest()`**. Log attendu : `[ragdoll] Rapier prêt`.
- *v1 à régler en jeu* : joints sphériques sans butées d'angle (membres peuvent sur-plier), force de projection, masses.

## 6. VFX & feedback santé

- **Particules bleues (âme)** : se déclenchent **à la frame de mort du joueur**, tous modes.
- **Orbes de soin** : **glow −80 %**, particules réduites, **gravité** (chute + petit rebond + repos + bob). **Flash bleu** + **`shield_full.mp3`** au ramassage.
- **Sang à l'impact** (gravité) quand on touche un bot 1 & 2 (pas le drone).
- **Pas full PV > 5 s** → message bleu clignotant « RÉGÉNÉREZ VOTRE VIE… ». **Plus de bouclier** → **overlay rouge**. **< 20 PV** → écran qui **tremble** toutes les 3 s.

## 7. Audio — sons ajoutés (`shared/config.js` → SFX_FILES)

`sentinel`, `bot2_death`, `drone_explode`, `drone_sound`, `buff_activate`, `insane_dead`, `r69_buff`, `wingman_buff`, `countdown`, `landing`, `bot_hit1/2/3`, `shield_full`, `dash`, `ambiance`.
> `bot_hit1/2/3` : un son **aléatoire, non chevauchant** quand un bot est touché.

## 8. Menu & Scoreboard

- Menu : mode **« Kill contre la montre »** ajouté, popup record, Insane sorti du tiroir.
- **Scoreboard persistant** (multijoueur asynchrone) : `server.js` routes **`POST /score`** + **`GET /leaderboard`**, stocké dans **`leaderboard.json`** (meilleur score par pseudo, top 200). Classement visible **dans le menu** (sur sélection du mode) et **sur l'écran de fin** (ta ligne surlignée violet). → **redémarrage serveur requis**.
- Tous les nouveaux boutons HUD/menu rendus **cliquables à la manette**.

## 9. Textures PBR de la map

- Set **Concrete_Wall_016** (basecolor / normal / roughness / ambientOcclusion) appliqué aux **murs béton** et au **sol**, **piloté par la config** (`GAMECFG.TEXTURES` + `TEXTURE_REPEAT`).
- `applyCustomTextures()` charge **automatiquement les maps PBR sœurs** dès qu'un chemin se nomme `*_basecolor.png` (+ `uv2` pour l'AO).
- Config : `floor`/`wall` → `Concrete_Wall_016_basecolor.png`, `TEXTURE_REPEAT.floor` = 20.
- Live : **`window.applyMapTextures()`**.

## 10. Pipeline — éditer la map dans Blender

- Map = **géométrie AABB** (boîtes) dans `shared/map.js`. Pipeline de réimport : `shared/map_custom.js` (généré) dont les blocs **remplacent** les blocs par défaut (vide = map d'origine).
- Outils livrés : **`tools/blender_map_export.py`** (modélise des cubes → exporte au format blocs) + **`tools/README_map_blender.md`**.
- Workflow : modéliser des cubes (1 u = 1 m, type = nom du matériau) → Run le script → recharge (et redémarre le serveur s'il valide les tirs).

## 11. Réglages « live » (console navigateur)

- `LBOT.ai.aggro_time`, `flee_below`, `first_hit_mult`, `view_fov_deg`, `sense_radius`.
- `LBOT.types.sentinel.*` (from_wave, speed_mult, fire_range, alert_time, view_range…), `LBOT.types.drone.*` (from_wave, speed, hover, follow_radius, fire_range…).
- `LBOT.spawn_sep_by_diff` (20/15/10).
- `GAMECFG.TEXTURES` + `TEXTURE_REPEAT` puis `window.applyMapTextures()`.
- `rdTest()` (ragdoll de test).

## 12. À déposer / à vérifier

- **Fichiers son** : tous présents et validés. (Si un son manque, le jeu fait un repli sans planter.)
- **Rapier** : vérifier `[ragdoll] Rapier prêt` dans la console ; sinon ajuster la version CDN (repli topple en attendant).
- **À valider en jeu (captures)** : rendu ragdoll (force/chute/joints), tiling/teinte des textures béton, lisibilité du cercle FOV drone, équilibrage (Sentinel très létal, drone, item buff).
- **server.js a changé** (scoreboard) → **redémarrer le serveur**.

---
*Document généré comme mémoire de session. Voir aussi `CLAUDE.md` (mémoire projet) et `RECAP_DEV.md`.*
