# Récap session — HUD rétro-futuriste & Bonus Rouge

**Projet :** Femz FPS — prototype web Three.js (`prototype-web/fps-r184`)
**Date :** 2026-06-18
**Portée :** refonte DA du HUD + nouvelle mécanique « Bonus Rouge » (attaque spéciale étendue aux 3 armes), plus divers correctifs gameplay/UI. Tout est poussé sur GitHub (`imfemz/FPS-Project`, branche `main`) ; Render redéploie automatiquement.

---

## 1. HUD — vitals / shield

- **Bug shield « gris » corrigé (cause racine)** : la classe générique `.seg` (toggle des options) fuyait dans `#shieldsegs .seg` (`display:flex` + `padding:4px`) et écrasait la **hauteur du fill bleu à 0** → seul le track gris s'affichait. Neutralisé via `display:block; padding:0; position:static`. Le shield s'affiche enfin en **bleu** (`#4db8ff`) + léger glow, et se vide bien.
- **Shield collé à la barre de vie** : écart vertical réduit (~2-3 px) pour un effet « même bloc ».

## 2. HUD — carte arme / sabre / dash

- **Carte sabre refaite** (style maquette) : 2 colonnes **SABRE LASER** (icône `saber2.png` centrée + barre de charge bleue) | **DASH** (chevrons `‹‹` + barre).
- **Barre de dash** : bleue pendant la charge → **verte** quand elle est pleine (prête).
- Suppression de l'ancienne barre de dash flottante (tout intégré dans une carte propre).

## 3. HUD — refonte DA rétro-futuriste

- **Cartes (vitals / arme / leaderboard)** : coins **chanfreinés** « carré futuriste », **bordure fine bleue en dégradé**, accent d'angle hachuré. Transparence (flou) + relief (ombre portée) conservés.
- **Mini-map → carrée** : cadre chanfreiné + contenu refait en **grille radar carrée** (croix + sous-grille 3×3 + anneau de portée), traits bleus fins.
- **Logo top-droite** remplacé par `game-logo.png` (même taille que la mini-map, 280 px).
- **Bloc score (leaderboard)** déplacé du centre vers la droite, à gauche du logo et aligné.
- **Flou en réglages** : retiré (le voile in-game est net, juste assombri).

## 4. Gameplay — mode bot & audio

- **Freeze en mode bot dans les menus** : pause/options figent la partie (bots ne bougent/tirent/blessent plus) → impossible de se faire tuer dans les réglages. Sous-titre de pause adapté.
- **Réglage Volume musique** : slider (live + persistant) avec icône audio, en bas des réglages.

## 5. Sabre — glow & particules

- **Plus de glow** : émissif lame `3.2 → 4.8`, lumière `2.4 → 3.4` + **halo additif** autour de la lame (le viewmodel n'a pas de bloom, donc le halo crée le vrai glow).
- **Particules électriques permanentes** : dégradé **bleu → violet**, émises en continu le long de la lame, additif, fade.

## 6. Attaque spéciale « Overcharge » (sabre)

- Débloquée à **3 kills** ; déclenchement via touche **`special`** (KeyQ / LT) — ajout d'un bind dédié.
- **Lancer du sabre** en avant (rotation violente), hit multi dans **5 m** : **140 frontal / 100 côtés**, retour **boomerang**. Pas de hit = pas de dégât.
- HUD : barre de charge sabre **rouge pulsé** quand dispo.
- **Reste chargée jusqu'à un HIT** (un lancer raté reste armé) ; **cooldown 15 s** sans toucher → reset (refaire 3 kills). Correctif du re-arm instantané après expiration.

## 7. « Bonus Rouge » — étendu à la R-69 & au Wingman

**Décisions :** compteur de kills **global partagé** (3 kills → arme l'arme **en main**) · flingues **auto, actif 10 s** · **mode bot d'abord** · **son rouge = fichier fourni par l'utilisateur**.

- **R-69** : normal body 13 / tête 19 → **rouge body 20 / tête 27**, spread hip réduit (`0.050 → 0.018`).
- **Wingman** : **tête normale revert à 90** (était 175) ; **rouge body 70 / tête 175**, spread hip réduit (`0.028 → 0.010`).
- **Cooldown 10 s** puis retour aux dégâts normaux.
- **Son de tir différent en rouge** : joue `/audio/shot_red.mp3` quand le fichier est présent (lazy-load hors préchargement), sinon **fallback procédural** (couche grave). → *fichier à fournir : `public/audio/shot_red.mp3` + `.m4a`*.

### HUD du bonus rouge
- **Seuls l'icône de l'arme + le nom** passent en **rouge pulsé** (cadre & chiffre de munitions restent neutres).
- **Effet « ember »** : braises chaudes (ambre→orange) qui montent et **s'évaporent** du HUD pendant qu'un état rouge est actif.

### Peau énergie sur l'arme (3D)
- Pendant **toute la durée** du bonus, une **texture électrique rouge animée** défile en émissif sur l'arme tenue (R-69 / Wingman / sabre **hors lame** cyan) → effet vibrant/électrique + glow, puis **fade out** à la fin (technique : `emissiveMap` rouge + scroll d'`offset`, façon alpha-texture animée). Matériaux d'origine stockés/restaurés.

---

## Fichiers principaux touchés
- `public/index.html` — tout le client (HUD, rendu, gameplay, audio).
- `shared/config.js` — armes (dégâts/spread/`red`), `RED_BONUS`, MELEE/overcharge, HUD.
- `shared/map.js` — carte (inchangée cette session).
- `public/textures/hud/` — `saber2.png`, `game-logo.png`.

## À faire / en attente
- **Fournir `shot_red.mp3`** (+ régénérer le `.m4a`) pour le son des tirs rouges.
- **Valider en jeu** : peau énergie rouge, embers, overcharge (non vérifiables en preview headless).
- **Online** : le bonus rouge est pour l'instant **côté client (mode bot)** ; la version autorité serveur (`server.js`) reste à faire.
- **Killcam** : mise de côté (symptômes : saccadée/décalée, ne se lançait pas toujours ; `killcam:false`).
- **Textures PBR triplanaires** (material_1) : toujours en attente (taille de tuile à confirmer).

🤖 Récap généré avec Claude Code
