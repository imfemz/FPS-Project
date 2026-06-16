HUD PERSONNALISÉ — déposez vos PNG ici (fond transparent conseillé).
Déclarez-les dans shared/config.js → HUD.images :
  { file: '/textures/hud/logo.png', anchor: 'top-right', x: 24, y: 18, w: 110, opacity: 0.9 }
anchor : top-left / top-right / bottom-left / bottom-right / center
x, y   : marges en pixels depuis le coin choisi
w      : largeur en pixels (la hauteur suit le ratio du PNG)
Couleurs du shield / vie / pseudo : HUD.colors dans la config.
Masquer un élément du HUD d'origine : HUD.hide, ex ['ping'].
Rechargez simplement la page après modification.
