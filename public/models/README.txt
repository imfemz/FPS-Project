MODÈLES 3D PERSONNALISÉS — déposez vos fichiers .glb / .gltf / .obj ici.

ARME (vue FPS)      → weapon.glb   (gabarit : weapon_reference.glb)
BRAS (holster)      → arms.glb     (gabarit : arms_reference.glb)
PERSONNAGE 3e pers. → character.glb (gabarit : character_reference.glb)  [NOUVEAU]

PERSONNAGE — pour que le jeu ANIME votre modèle (jambes qui courent, bras,
penché en slide...), gardez ces NOMS DE NŒUDS dans votre GLB :
  character (racine)
    └ torso → head, armR, armL, vest...
        armR → elbowR → forearmR → handR → (gun)
    legR → shinR → bootR
    legL → shinL → bootL
Le perso de référence tient déjà l'arme droite devant lui (image 4).
Ouvrez character_reference.glb dans Blender, remplacez les meshes en gardant
les noms, ré-exportez en .glb → character.glb. Réglez l'échelle si besoin.

Repère commun : +Y = haut, -Z = avant, origine au sol entre les pieds (~1.85 m).
