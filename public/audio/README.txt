DOSSIER AUDIO — NEON COMPOUND
=============================
Déposez ici vos effets sonores. Noms attendus (voir shared/config.js,
section SFX_FILES, pour les renommer ou en ajouter) :

  shot.mp3          tir de l'arme
  hit_body.mp3      hitmarker corps
  hit_head.mp3      hitmarker tête
  shield_crack.mp3  bouclier ennemi brisé
  slide.mp3         début de slide
  slide_jump.mp3    slide jump
  wallbounce.mp3    rebond sur mur
  mantle.mp3        grimpe d'obstacle
  superglide.mp3    superglide
  reload.mp3        début de rechargement
  holster.mp3       arme rangée
  equip.mp3         arme ressortie

Formats acceptés : .mp3, .ogg, .wav (changez l'extension dans config.js).
Si un fichier est absent, le jeu joue un son procédural de secours :
rien ne casse, vous pouvez ajouter vos sons un par un.

Ajoutés en v7.6 :
  hit_shield.mp3   balle qui touche le BOUCLIER (fallback : ting métallique)
  hit_flesh.mp3    balle qui touche la VIE (fallback : impact sourd)

Ajoutés en v8 :
  footstep.mp3     bruit de pas (joué en 3D : vous entendez d'où vient l'ennemi)
  death.mp3        cri/chute à la mort d'un joueur
  orb_pickup.mp3   ramassage d'une orbe de soin
  ambient.mp3      BOUCLE d'ambiance de fond (volume : AMBIENT_VOLUME dans la config)
