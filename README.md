# NEON COMPOUND — IR Reverb Update

## Fichiers à remplacer / ajouter

- `public/index.html` → remplace ton `fps/public/index.html`
- `shared/config.js` → remplace ton `fps/shared/config.js`
- `public/audio/ir/IR.wav` → ajoute ce fichier dans `fps/public/audio/ir/IR.wav`

`server.js` est inclus dans le zip pour garder la structure, mais il n'a pas eu besoin d'être modifié pour la reverb IR.

## Ce qui a été ajouté

- Chargement d'une vraie IR via Web Audio API (`fetch`, `decodeAudioData`, `ConvolverNode`).
- Deux chemins audio : dry direct + wet vers la convolution IR.
- Fallback propre si le fichier IR est absent : `console.warn`, son sec, aucune erreur bloquante.
- Désactivation de la réverb synthétique : le jeu n'utilise plus l'IR générée par code.

## Chemin du fichier IR

Le fichier IR doit être ici :

```txt
public/audio/ir/IR.wav
```

Le `IR.mp3` fourni a été converti en `IR.wav`.

## Réglages dans `shared/config.js`

```js
AUDIO_IR: {
  ENABLED: true,
  FILE: '/audio/ir/IR.wav',
  SHOT_WET: 0.04,
  WORLD_WET: 0.10,
  FOOTSTEP_WET: 0.03,
  DEFAULT_WET: 0.05,
  DRY: 1.0,
}
```

Pour plus de reverb : augmente `SHOT_WET`, `WORLD_WET`, `FOOTSTEP_WET`.
Pour un feeling plus sec/Apex : baisse surtout `SHOT_WET`.
