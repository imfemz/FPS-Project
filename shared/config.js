/* =====================================================
   CONFIG DE JEU PARTAGÉE — modifiez les valeurs ici.
   ===================================================== */
(function (root) {
  const GAMECFG = {
    // ===== RENDU / GRAPHISMES (pipeline premium façon FPS moderne) =====
    // Le gros saut visuel : tone mapping ACES (enlève le délavé/cramé) + couleur sRGB + reflets
    // d'environnement (sol mouillé, reflets arme) + lumière chaude. EXPOSURE = luminosité maîtresse.
    GRAPHICS: {
      ENABLED: true,           // false = revient au rendu d'origine (pour comparer)
      exposure: 1.0,           // luminosité globale (tone mapping). BAISSE si ça crame, MONTE si trop sombre
      sky_gain: 1.6,           // gain de luminosité du ciel lunaire (skybox) → plus de glow
      // --- Lumière ---
      sun_intensity: 1.25,      // soleil (directionnelle chaude). Donne le contraste et les ombres
      sun_color: '#d6dde8',    // couleur du soleil (lumière froide, ambiance industrielle)
      sky_light: 1.2,           // lumière du ciel (hemisphere) qui remplit les ombres
      ground_bounce: '#5d646e',// couleur du rebond de lumière du sol (béton froid)
      ambient: 0.28,           // ambiante minimale (évite les noirs bouchés). 0 = ombres plus profondes
      // --- Reflets d'environnement ---
      env_intensity: 0.45,      // force des reflets sur murs/caisses/rampes
      floor_roughness: 0.92,   // sol : plus BAS = plus lisse = plus réfléchissant (effet mouillé). 0.95 = mat
      floor_metalness: 0.50,   // léger côté spéculaire humide
      floor_env: 0.35,          // intensité des reflets spécifiquement sur le sol
      gun_env: 0.8,            // reflets d'environnement sur l'arme
      // Tamise les surfaces texturées (1 = pleine luminosité, plus bas = plus sombre). Évite le sol
      // texturé qui part en blanc cramé. Descends vers 0.7 si c'est encore trop clair.
      tex_brightness: 0.9,
      // --- Atmosphère ---
      fog_color: '#878f99', fog_near: 65, fog_far: 200, // brume froide ; far poussé (map 90×90)
      // --- POST-FX (vrai shader) : anti-aliasing + occlusion ambiante + bloom ---
      POSTFX: true,            // false = désactive tout le post-traitement (si souci de perf/rendu)
      AA: true,                // anti-aliasing (MSAA natif + SMAA) — corrige les bords crénelés avec le post-FX
      aa_samples: 2,           // niveau de MSAA (2 / 4 / 8) — ↑ = plus lisse, un peu plus lourd
      AO: false,               // GTAO (occlusion ambiante écran) DÉSACTIVÉE : instable (clignote avec la distance,
                               // ne couvre pas toutes les faces). Remplacée par une AO BAKED stable (voir BAKED_AO).
      ao: { radius: 5.8, scale: 2.8, distanceExponent: 0.7, thickness: 1.4, samples: 18 },
      // AO "cuite" (statique, indépendante de la caméra) : ombre de contact au sol sous chaque caisse/mur
      // + assombrissement progressif du bas des faces verticales. Cohérente sous tous les angles.
      BAKED_AO: { enabled: true, ground_opacity: 0.42, ground_margin: 2.8, face_darken: 0.58 },
      BLOOM: true,             // halo lumineux sur les sources vives (sabre, néon, soleil)
      bloom: { strength: 0.55, radius: 0.8, threshold: 0.72 }, // ↑strength = plus de glow ; threshold = seuil de brillance
    },
    DAMAGE: { BODY: 15, HEAD: 20 },
    // ===== BONUS ROUGE : 3 kills (compteur GLOBAL partagé) → l'arme en main passe "rouge" =====
    // Sabre = overcharge (touche spéciale). Flingues (R-69/Wingman) = +dégâts & spread réduit pendant `duration` s.
    // Les dégâts/spread "rouge" sont dans chaque WEAPON.red. Son dédié = WEAPON.red.sfx (fichier /audio/shot_red.mp3).
    RED_BONUS: { streak: 3, duration: 10, shot_sfx: 'shot_red', shot_file: '/audio/shot_red.mp3' },
    ADS_SPEED: 12,   // vitesse de montée en visée (ADS) plus rapide (réglable en jeu : "Vitesse de visée")
    MOMENTUM_FOV: 12, // élargissement FOV max (°) quand le momentum est au max (0 = off) — sensation de vitesse
    // À la mort, le corps se dissout en PARTICULES qui tombent au sol et fade out (false = ancien fondu).
    DEATH_DISSOLVE: true,
    DEATH_DISSOLVE_CFG: { color: 0xdce8ff, size: 0.05, life: 1.8, per_mesh: 240, max_points: 2000, spread: 3.45, rise: 2.75 },
    RED_DOT_SIZE: 0.0016,
    RUN_SHAKE: 1.5,
    // ===== Sway caméra "vivant" : oscillation DIAGONALE gauche↔droite quand on bouge =====
    // Donne une sensation de vie/respiration en course. Rotationnel (yaw+pitch+roll en phase
    // = balancement diagonal). Fréquence ET amplitude varient selon l'action (vitesse, sprint,
    // crouch, ADS, saut, slide). Lissé à l'entrée/sortie (jamais de à-coup au départ/à l'arrêt).
    CAMERA_SWAY: {
      ENABLED: true,
      min_speed: 1.0,        // vitesse mini (m/s) pour activer le sway
      base_freq: 1.15,       // fréquence à la marche (cycles diagonaux/s)
      sprint_freq: 1.95,     // fréquence en sprint (plus rapide = plus frénétique)
      crouch_freq: 0.8,      // fréquence accroupi (lent, furtif)
      base_amp: 0.011,       // amplitude (rad) à la marche
      sprint_amp: 0.018,     // amplitude en sprint (plus ample)
      crouch_amp: 0.006,     // amplitude accroupi (discret)
      vertical_ratio: 0.55,  // part verticale (horizontal + vertical EN PHASE = diagonale "/")
      roll_ratio: 0.6,       // inclinaison (lean) synchronisée → vie
      fig8: 0.35,            // touche figure-8 (double fréquence) pour casser la régularité
      organic: 0.28,         // variation lente d'amplitude/fréquence (jamais parfaitement robotique)
      ads_reduce: 0.85,      // réduction en visée (0..1) : 1 = quasi nul en ADS
      smooth_in: 6,          // vitesse de montée du sway (anti-snap au départ)
      smooth_out: 4,         // vitesse de descente (à l'arrêt)
    },
    // ===== Vibration au CHANGEMENT D'ARME (petit à-coup naturel quand l'arme arrive en main) =====
    // Secousse au changement d'arme : FORTE et ample au début, puis se stabilise en douceur
    // (enveloppe attack→decay, façon mantle). Pas un à-coup sec.
    SWITCH_SHAKE: {
      ENABLED: true,
      amount: 0.022,         // amplitude au pic (rad) — ample
      freq: 24,              // fréquence (basse = mouvement lourd, pas un buzz)
      attack: 0.05,          // temps de montée vers le pic (s) — fort dès le début
      decay_t: 0.30,         // temps de retombée douce (s)
    },
    // ===== Pulsation bleu clair sur les CÔTÉS quand on va vite (bunny hop / vélocité) =====
    // Apparaît au-delà de min_speed, max à max_speed, pulse (vibration), s'éteint à vitesse normale.
    SPEED_EDGE: {
      enabled: true,
      min_speed: 9,          // m/s : début de l'effet (au-dessus de la course normale ~8)
      max_speed: 15,         // m/s : intensité maxi
      max_opacity: 0.95,     // opacité maxi du halo bleu
      pulse_freq: 9,         // vitesse de la pulsation (vibration)
      pulse_amount: 0.38,    // amplitude de la pulsation
    },
    MAX_SPEED_SERVER: 10,
    MAX_SPEED_GUN: 9,           // vitesse horizontale MAX avec une arme a feu equipee (sol+air). Sabre = non plafonne (serveur borne a MAX_SPEED_SERVER). Repere : walk 6.6 / sprint 9.6 / sabre ~10
    // Son de vitesse : boucle qui monte quand on atteint (presque) la vélocité max, et FONDU SORTANT si on ralentit.
    VELOCITY_SFX: { enabled: true, speed: 13.5, volume: 0.6, fade_in: 0.12, fade_out: 0.55 },
    SPREAD: { HIP: 0.090, ADS: 0.002, SLIDE: 0.014 }, // hip/slide resserres : la balle part bien dans le viseur (fini "pile dessus sans toucher")
    FIRE_RATE: 0.056,
    RECOIL: {
      VERTICAL: 0.0018, HORIZONTAL: 0.0005, PATTERN_DRIFT: 0.20,
      FIRST_SHOT_MULT: 2.78, ADS_MULT: 0.32, RECOVERY_DELAY: 0.13,
      RECOVERY_SPEED: 0.35, RECOVERY_AMOUNT: 1.75, SMOOTH_THRESHOLD: 0.90,
      SMOOTH_MAX: 0.95, KICK_VM: 0.78, VM_BACK: 0.07, VM_MAX: 0.01,
      VM_ROT: 0.024, VM_PUNCH_SPEED: 10, VM_RETURN_SPEED: 20,
      // Ramp-up du spray R99 : plus tu maintiens le tir, plus le recul devient nerveux, avec un plafond.
      SPRAY_RAMP: 0.018, SPRAY_MAX: 5.32,
      // Micro-vibration par balle : casse la ligne zigzag trop propre et donne un spray R99 plus vivant.
      MICRO_JITTER_X: 0.0024, MICRO_JITTER_Y: 0.0006,
      MICRO_JITTER_FREQ: 10.7, MICRO_JITTER_RANDOM: 2.10,
    },
    // ===== Contrôle du shake caméra au tir =====
    // RECOIL_* agit sur le vrai mouvement caméra/viseur causé par le recul.
    // VISUAL_* ajoute une micro-vibration visuelle indépendante, réglable sans toucher au pattern.
    CAMERA_SHAKE: {
      ENABLED: true,

      // Multiplie le recul caméra appliqué à me.pitch / me.yaw pendant le tir.
      // 1 = comportement normal, 0.75 = caméra moins secouée, 0 = aucun recul caméra.
      RECOIL_MULT: 1.0,
      HIP_MULT: 1.0,
      ADS_MULT: 1.0,

      // Multiplie uniquement le micro-jitter caméra du spray.
      JITTER_MULT: 0.5,

      // Micro-shake visuel pur : ne remplace pas le recul, il ajoute une vibration courte.
      VISUAL_ENABLED: true,
      VISUAL_AMOUNT: 0.008,
      VISUAL_FREQ: 0.5,
      VISUAL_DECAY: 2,
      VISUAL_MAX: 1.0,
      VISUAL_HIP_MULT: 1.0,
      VISUAL_ADS_MULT: 0.30,
    },
    // ===== Balancement rotationnel de l'arme au tir (roll gauche/droite) =====
    // Ce roll est appliqué autour du centre ADS / point rouge pour éviter que le canon quitte le centre de l'écran en visée.
    FIRE_ROLL: {
      ENABLED: true,

      // Intensité du roll par balle (radians). 0.012 ≈ subtil, 0.022 ≈ visible.
      AMOUNT: 0.012,
      MAX: 0.045,

      // Vitesse du punch et du retour au centre.
      PUNCH_SPEED: 20,
      RETURN_SPEED: 12,

      // Alterne gauche/droite à chaque balle + variation humaine.
      ALTERNATE: true,
      RANDOM: 0.25,

      // Plus visible au jugé, plus discret en ADS pour garder le viseur propre.
      HIP_MULT: 1.0,
      ADS_MULT: 0.35,

      // Protection du centre ADS : 1 = le point rouge/canon reste verrouillé au centre pendant le roll.
      CENTER_PROTECT: 1.0,
      CENTER_ADS_START: 1.55,
    },
    // Recul ROTATIONNEL fluide : l'arme se penche gauche/droite en ARCS lisses pendant le tir soutenu,
    // pivotée autour de l'aim point (le canon reste sur cible, c'est l'arme qui penche).
    SPRAY_LEAN: {
      ENABLED: true,
      AMOUNT: 0.07,     // amplitude max du lean (radians) a plein spray. 0.04 subtil, 0.10 marque.
      SPEED: 7.0,       // vitesse de l'arc (rad/s) : plus haut = oscille plus vite.
      RISE: 5.0,        // montee de l'amplitude quand on tire (fluide).
      FALL: 3.5,        // retour a 0 quand on arrete de tirer.
      HIP_MULT: 1.0,    // au juge : lean bien visible.
      ADS_MULT: 0.45,   // en ADS : plus discret (viseur propre).
    },
    SUPERGLIDE: {
      ENABLED: true, JUMP_ONLY: true, WINDOW: 0.25, GRACE: 0.14,
      SPEED: 15.0, UP: 6.2, FOV_KICK: 10, FOV_DECAY: 2.6,
      show_dot: false,   // point bleu de timing superglide : masqué (gênait la visée en grimpe). true = réafficher
    },
    MANTLE_SHAKE: 0.15,
    CLIMB_SHAKE_MULT: 0.45,   // grimpe de mur : fraction du shake mantle (plus bas = plus doux)
    FOV: { VIEW: 75, ADS: 60, WEAPON: 45 },
    WEAPON_NAME: 'R-69',
    WEAPON_ICON: '/textures/hud/weapon.png',
    WEAPONS: [
      {
        name: 'R-69',
        model: '/models/R69_hands.glb',
        icon: '/textures/hud/weapon.png',
        mag: 30, fire_rate: 0.078, reload_t: 1.9,
        damage_body: 13, damage_head: 19,
        spread_hip: 0.050, spread_ads: 0.002,
        red: { damage_body: 20, damage_head: 27, spread_hip: 0.018, sfx: 'shot_red' }, // BONUS ROUGE (3 kills) : +degats, spread reduit, 10s
        recoil_mult: 1.0,
        recoil_vertical: 1.0,
        recoil_speed: 1.0,
        kick_back: 1.0,
        fire_vibe: { amount: 0.0005, freq: 13, x_amount: 0.001, x_freq: 18 },
        sfx_shot: 'shot', sfx_reload: 'reload',
        scale: 1.2, position: [0, 0.1, -0.04], rotation_y_deg: 0, sight: null,
        muzzle: [0.02, 0.20, -0.35],
        muzzle_scale: 0.3,
        muzzle_opacity: 0.2,
        muzzle_origin: [0, -0.06, -0.5],
        hip: { pos: [0.05, -0.28, -0.10], rot: [0.05, 0.005, 0] },
        ads: { rot: [0, 0, 0], dist: 0.11, align: [0, -0.01] },
      },
      {
        name: 'WINGMAN',
        model: '/models/wingman_hand.glb',
        icon: '/textures/hud/wingman.png',
        mag: 3, fire_rate: 0.545, reload_t: 1.04,
        damage_body: 70, damage_head: 90,   // tete revert a 90 (normal) — le BONUS ROUGE la remonte a 175
        spread_hip: 0.028, spread_ads: 0.0003,
        red: { damage_body: 70, damage_head: 175, spread_hip: 0.010, sfx: 'shot_red' }, // BONUS ROUGE (3 kills) : +degats, spread reduit, 10s
        recoil_mult: 1.4,
        recoil_vertical: 0.7,
        recoil_speed: 0.9,
        kick_back: 0.1,
        vkick: { gun: -0.40, cam: 0.010, up_speed: 1, down_speed: 8 },
        // recul rotationnel directionnel : l'arme part en haut-droite puis revient fluide au centre
        // pitch = montée (haut), yaw = départ vers la droite, roll = légère inclinaison
        rkick: { pitch: 0.09, yaw: -0.05, roll: -0.1, max: 0.6, rise_speed: 1, return_speed: 8 },
        // Secousse caméra LOURDE par balle (façon shake de changement d'arme, mais grave) :
        // montre que le Wingman tape fort. amount = ampleur, freq basse = "thump", down_bias = poids vers le bas.
        fire_shake: { amount: 0.024, freq: 25, attack: 0.015, decay_t: 0.14, down_bias: 1.0 },
        sfx_shot: 'wingman_shot', sfx_reload: 'wingman_reload',
        scale: 1, position: [0, 0.1, 0], rotation_y_deg: 0, sight: null,
        muzzle: [0, 0.04, -0.6],
        muzzle_scale: 0.7,
        muzzle_opacity: 0.5,
        muzzle_origin: [0, -0.05, -0.45],
        hip: { pos: [0.05, -0.25, -0.25], rot: [0, 0.05, 0] },
        ads: { rot: [-0.001, 0, 0], dist: 0.13, align: [0, -0.011] },
        // Pose crouch PROPRE au Wingman (sinon il utiliserait la CROUCH_POSE globale).
        // Même format que CROUCH_POSE. Valeurs de départ = copie du R69, à régler à ta convenance.
        crouch_pose: {
          pos: [0.23, 0.07, -0.04],     // décalage [x,y,z] (m)
          rot: [0.15, 0.01, 1.25],    // [pitch, yaw, roll] (rad) — ↑ rot[2] = plus incliné
          speed: 5,                    // vitesse de lissage entrée/sortie
          sway_amount: 0.012,          // léger sway humain
          sway_speed: 1.1,
        },
      },
      // ===== ARME 3 : SABRE LASER (mêlée) =====
      // Utilise le modèle public/models/arms.glb (lame + manche). Pas de munitions :
      // clic gauche / R2 = coup de sabre. Réglages de combat dans le bloc MELEE ci-dessous.
      {
        name: 'SABRE LASER',
        model: '/models/arms.glb',
        icon: '/textures/hud/saber2.png',   // logo sabre laser affiché dans le HUD quand il est équipé
        melee: true,                 // arme de mêlée (gérée par le système MELEE, pas de tir/munitions)
        auto_center: true, auto_fit: true,
        fit_size: 0.9,               // longueur cible du sabre à l'écran (m) — ↑ = plus grand
        // meshes parasites du GLB retirés AVANT mesure (sol/déchets + foregrip de l'arme embarquée).
        hide_meshes: ['ground', 'cmdl', 'plane', 'foregrip'],
        // le GLB contient DEUX copies superposées du sabre → on retire les meshes en doublon
        // (suffixe de fin '.001') pour éviter le z-fighting et le double rendu de la lame.
        dedupe_suffix: '.001',
        blade_meshes: ['lightsaber', 'saber'],           // meshes de LAME à faire briller
        blade_exclude: ['cap', 'foregrip', 'hilt', 'handle', 'grip'], // manche : ne brille pas
        scale: 1, position: [-0.02, -0.12, -0.45], sight: null,
        // La lame du modèle pointe le long de l'axe Y local → on l'oriente vers l'avant via
        // rotation_deg [x,y,z] (degrés). AJUSTE CES 3 VALEURS pour bien caler le sabre en main.
        rotation_deg: [-78, 320, 0],
        // pose en main (hanche) : x+ =droite, y+ =haut, z+ =vers soi | rot x+ =pointe bas, y+ =droite, z+ =roll
        // sabre remonté (était -0.24) pour qu'il soit bien visible en main.
        hip: { pos: [0.16, -0.18, -0.28], rot: [0.18, -0.22, 0.12] },
        ads: { rot: [0, 0, 0], dist: 0.22, align: [0, 0] },
      },
    ],
    // ===== SABRE LASER : système de mêlée (coups procéduraux + impact) =====
    // Dégâts AUTORITÉ SERVEUR (server.js lit ces valeurs). Le reste (anim, shake, lame) est client.
    MELEE: {
      damage: 70,            // dégâts par coup
      range: 3.8,            // portée du coup (m)
      // --- Cooldown : nombre de coups avant de devoir attendre la recharge (barre bleue HUD) ---
      max_hits: 3,           // coups disponibles à pleine charge
      recharge_time: 2.4,    // secondes pour remonter de 0 à plein
      cone_deg: 75,          // ouverture du cône d'attaque devant soi (°)
      interval_ms: 240,      // cadence mini entre 2 coups (anti-spam, côté serveur)
      // --- MAGNET (aimant) : sabre sorti + ennemi proche → la visée se colle doucement dessus (hit facile) ---
      magnet: true,
      magnet_range: 5.5,     // distance (m) à laquelle l'aimant s'active
      magnet_cone_deg: 80,   // l'ennemi doit être dans ce cône devant soi
      magnet_strength: 0.3,  // force (0..1) de l'attraction de visée
      magnet_rate: 10,       // vitesse de rattrapage de la visée vers la cible
      // --- Rendu de la lame ---
      blade_color: 0x36e3ff, // couleur de la lame (cyan néon, assorti au thème)
      blade_emissive: 4.8,   // intensité d'émission de la lame (PLUS de glow)
      blade_light: 3.4,      // intensité de la lumière dynamique projetée par la lame (PLUS de glow)
      blade_light_dist: 5,   // portée de cette lumière (m)
      blade_pulse: 0.74,     // amplitude de la pulsation de la lame (vivante)
      // --- Halo de glow (tube additif autour de la lame, sans bloom car rendu viewmodel) ---
      glow_radius: 0.055,    // rayon du halo (m) — un peu plus large que la lame
      glow_opacity: 0.30,    // opacité du halo additif
      // --- Particules électriques permanentes émises par la lame (dégradé bleu -> violet) ---
      particle_count: 120,   // nombre max de particules vivantes
      particle_rate: 210,    // particules émises par seconde
      particle_life: 0.42,   // durée de vie (s)
      particle_size: 0.055,  // taille des particules
      particle_speed: 0.55,  // vitesse "crackle" électrique
      particle_rise: 0.12,   // légère dérive vers le haut
      particle_jitter: 0.015,// dispersion radiale autour de la lame (m)
      particle_color_a: 0x4db8ff, // bleu
      particle_color_b: 0xa35cff, // violet (dégradé entre les deux par particule)
      // ===== OVERCHARGE : attaque spéciale débloquée après 3 kills d'affilée =====
      // Le joueur LANCE le sabre en avant (rotation violente), il touche les ennemis dans un rayon,
      // puis revient en boomerang dans la main. Pas de hit = pas de dégât, le sabre revient quand même.
      overcharge: {
        streak: 3,             // kills d'affilée requis pour débloquer
        window_ms: 15000,      // une fois dispo : si aucun HIT dans ce délai (15 s) → reset (refaire 3 kills)
        doubletap_ms: 300,     // fenêtre du double-tap d'attaque pour la lancer (quand dispo)
        radius: 10,            // rayon de touche (m)
        dmg_front: 140,        // dégâts en frontal (cône avant)
        dmg_side: 100,         // dégâts sur les côtés (dans le rayon, hors cône frontal)
        front_cone_deg: 70,    // ouverture du cône "frontal" (au-delà = côtés)
        throw_out: 0.26,       // durée aller (s)
        throw_back: 0.34,      // durée retour boomerang (s)
        spin: 42,              // vitesse de rotation du sabre lancé (rad/s)
        blade_len: 1.15,       // longueur de la lame lancée (m)
        color: 0x4db8ff,       // couleur de la lame lancée (glow bleu)
      },
      // --- Traînée lumineuse (ruban additif derrière la lame pendant le swing) ---
      trail_len: 0.95,       // longueur de la traînée le long de la lame (m, depuis la garde)
      trail_base: -0.12,     // position de la base de la traînée (m, côté garde)
      // --- Camera shake "nerveux" + hit-stop à l'impact ---
      shake_hit: 2.0,        // amplitude de secousse quand le coup TOUCHE
      shake_whiff: 0.30,     // amplitude quand le coup RATE (juste le souffle)
      shake_amp: 0.05,       // amplitude max de la vibration caméra (rad)
      shake_freq: 42,        // fréquence de la vibration (haut = nerveux/sec)
      shake_decay: 7,        // vitesse de retombée de la secousse
      kick_pitch: 0.05,      // à-coup vertical net de la caméra à l'impact (rad)
      kick_yaw: 0.028,       // à-coup horizontal
      kick_decay: 9,         // retour de l'à-coup au centre
      hitstop_hit: 0.175,    // durée du gel de l'arme quand ça touche (s)
      hitstop_finisher: 0.70,// gel plus long sur le coup final
      // --- Pose "course KATANA" : quand on sprinte avec le sabre, il se lève et s'incline ---
      // vers le bas/avant comme un samouraï qui court. Pose ADDITIVE (rad / m). 0 = désactivé.
      // pos_y bas/négatif = ne monte PAS hors champ ; tip_down+roll = tenu en diagonale (katana de course).
      katana_run: { pos_y: -0.03, pos_x: 0.15, pos_z: 0.05, tip_down: 0.5, roll: 1.42, yaw: -0.16, speed: 8 },
      // --- Combo : 3 coups procéduraux enchaînés ---
      // Pose ADDITIVE appliquée à l'arme : rot [x,y,z] rad (x+ =pointe bas, y+ =droite, z+ =roll
      // horaire), pos [x,y,z] m (x+ =droite, y+ =haut, z+ =vers soi).
      combo_reset_ms: 750,   // au-delà de ce délai sans coup, le combo repart au 1er
      wind_end: 1.28,        // fin de l'armé / début de la frappe (fraction du coup)
      impact_at: 0.46,       // instant exact de l'impact (fraction du coup)
      swings: [
        // 1) tranche diagonale : haut-droite → bas-gauche
        { dur: 0.46, lock: 0.30, shake: 3.0,
          windup: { rot: [1.45, 10.70, -0.90], pos: [-1.08, 0.15, 0.10] },
          strike: { rot: [-1.55, -1.10, 1.00], pos: [-0.22, -0.16, -0.14] } },
        // 2) revers : bas-gauche → haut-droite
        { dur: 0.36, lock: 0.30, shake: 4.0,
          windup: { rot: [0.45, -0.70, 10.90], pos: [-0.18, 0.15, 0.10] },
          strike: { rot: [-0.55, 1.10, -1.00], pos: [0.22, -0.14, -0.14] } },
        // 3) coup vertical en cloche (finisher, plus lourd)
        { dur: 0.26, lock: 0.30, shake: 3.5, finisher: true,
          windup: { rot: [1.10, 1.05, 0.12], pos: [0.0, 0.24, 0.14] },
          strike: { rot: [-1.40, -1.05, -0.10], pos: [0.0, -0.24, -0.22] } },
      ],
    },
    ANIM: {
      ENABLED: true,
      ENABLED: true,
      idle:   { pos: [0, 0, 0],        rot: [0, 0, 0],        amount: 1, speed: 6 },
      sprint: { pos: [0.04, -0.03, 0.06], rot: [-0.15, 0.5, 0.1], amount: 1, speed: 8 },
      ads:    { pos: [0, 0, 0],        rot: [0, 0, 0],        amount: 1, speed: 12 },
      crouch: { pos: [0, 0.01, 0],     rot: [0.90, 0, 0.95],  amount: 1, speed: 7 },
      jump:   { pos: [0, 0.03, -0.02], rot: [-0.12, 0, 0],    amount: 1, speed: 9 },
      slide:  { pos: [0.02, 0.02, 0],  rot: [0.1, 0.15, 0.25],amount: 1, speed: 9 },
      reload: { pos: [0, -0.04, 0.03], rot: [0.4, 0.2, 0],    amount: 1, speed: 8 },
      fire:   { pos: [0, 0.005, 0.02], rot: [-0.04, 0, 0],    amount: 1 },
    },
    // ===== Pose de l'arme en CROUCH (accroupi) — inclinaison marquée façon FPS moderne (Apex) =====
    // S'ajoute à la pose de base : pitch (montre le dessus), roll (incline sur le côté), + léger
    // décalage de position. Lissée entrée/sortie, RÉDUITE en ADS (visée propre), ATTÉNUÉE pendant
    // le reload (prioritaire). Couvre aussi le SLIDE (même orientation qu'en crouch).
    // rot = [pitch, yaw, roll] en radians : rot[0]+ = montre le dessus, rot[2]+ = incline à droite.
    CROUCH_POSE: {
      ENABLED: true,
      pos: [0.13, 0.10, 0.04],    // décalage [x,y,z] de l'arme en crouch (m) — la ramène vers soi
      rot: [-0.15, 0.02, 1.05],   // [pitch, yaw, roll] (rad) — extrait de ton modèle crouch (roll ~61°)
      speed: 5,                  // vitesse de lissage entrée/sortie (↑ = plus réactif)
      sway_amount: 0.022,         // amplitude du léger sway humain en crouch (rad) — petit, jamais de tremblement
      sway_speed: 1.1,            // vitesse du sway (lent = naturel)
    },
    // Animation de reload PAR PHASES (snappy, humaine). Chaque phase a une durée (s) et une pose
    // cible (pos [x,y,z] en mètres, rot [x,y,z] en radians). L'arme interpole vers chaque pose
    // avec easing. Les durées sont normalisées pour tenir dans reload_t de l'arme.
    // pos.x + = droite, pos.y + = haut, pos.z + = vers soi (recul) ; rot.x + = canon vers le bas,
    // rot.y + = vers la droite, rot.z + = inclinaison (roll) horaire.
    // ===== Système de blending d'animation d'arme (couche de base pondérée) =====
    // Chaque état a un poids 0→1 qui évolue en douceur (blendSpeed). Les poses se MÉLANGENT
    // au lieu de se remplacer brutalement (plus de snap entre walk/sprint/ads/reload).
    // pos en mètres, rot en radians. blendSpeed = vitesse de montée/descente du poids.
    WEAPON_ANIM_BLEND: {
      ENABLED: true,
      idle:   { pos: [0, 0, 0],          rot: [0, 0, 0],            blendSpeed: 8 },
      walk:   { pos: [0, 0, 0],          rot: [0, 0, 0],            blendSpeed: 7, bob: 1.0 },
      sprint: { pos: [-0.06, -0.07, 0.07], rot: [0.22, 0.38, 0.03], blendSpeed: 9, bob: 1.0 },
      crouch: { pos: [0, 0, 0],         rot: [0, 0, 0],            blendSpeed: 7 },  // crouch piloté par CROUCH_POSE
      slide:  { pos: [0, 0, 0],         rot: [0, 0, 0],            blendSpeed: 9 },  // slide reprend l'orientation crouch (CROUCH_POSE)
      ads:    { pos: [0, 0, 0],          rot: [0, 0, 0],            blendSpeed: 16, swayMult: 0.25 },
      // ADS : réduction du sway HORIZONTAL (gauche/droite) — plus bas = arme plus stable en visée.
      ads_sway_h: 0.05,         // multiplie le sway horizontal résiduel en ADS (0 = bloqué, 1 = inchangé)
      ads_sway_v: 0.35,         // multiplie le sway VERTICAL résiduel en ADS (saut/atterrissage stables)
      // En ADS, l'airborne (saut), le rebond et la bascule de saut se résorbent VITE → viseur centré.
      ads_air_recenter: 0.95,   // fraction de l'airborne/rebond annulée en ADS plein (0.97 = quasi tout)
      // inertie : retard de l'arme par rapport au regard (visée qui "traîne" un peu)
      inertia: { amount: 0.090, return: 9, max: 0.05 },
      // pose airborne (saut / bunny hop) : arme stable + léger flottement, PAS de cycle de course.
      // Réglée pour : pose plus basse (comme img 3 mais moins haute), flottement léger mais visible,
      // retour lent et doux à l'atterrissage (~0.35s).
      airborne: {
        pos: [0.005, -0.025, 0.0],  // y négatif = arme plus basse (ne part plus vers le centre-haut)
        rot: [0.03, 0.015, 0.02],   // légère inclinaison stable
        bounceAmount: 0.010,    // rebond vertical léger mais visible (était 0.018)
        bounceSpeed: 5.5,       // un peu plus lent = flottement plus doux
        velocityInfluence: 0.018, // inertie verticale réduite (évite que l'arme monte trop)
        swayAmount: 0.006,      // sway latéral subtil
        blendSpeedIn: 11,       // entrée en airborne (assez réactive)
        blendSpeedOut: 3.2,     // SORTIE lente et douce (~0.35s) → plus de snap au retour
        // Bascule au saut autour du pivot de l'arme (poignée).
        // >>> SI LE SENS EST INVERSE : change juste le SIGNE de jump_nose_dip (0.40 <-> -0.40) <<<
        // 0.40 (positif) et -0.40 (négatif) donnent les deux sens opposés. Teste les deux.
        jump_nose_dip: -1,    // amplitude bien visible pour identifier le bon sens
        jump_nose_rise: 2,      // montée douce
        jump_nose_settle: 6.2,  // retour + stabilisation
        jump_nose_lift: 0.47,   // l'arme entière monte en hauteur pendant le saut puis redescend (m)
        // Rebond unique amorti à l'atterrissage (proportionnel à la vitesse de chute).
        land_bounce: 0.06,      // amplitude du rebond (m), × vitesse de chute
        land_bounce_freq: 11,   // fréquence de l'oscillation amortie
        land_bounce_decay: 6,   // amortissement (plus haut = s'estompe plus vite, 1-2 rebonds)
      },
      // oscillation douce "apesanteur" quand on saute accroupi (balancement lent et fluide)
      crouch_air: { amount: 0.030, rot: 0.05, speed: 3.2, ramp: 6 },
      // adoucissement de l'impact d'atterrissage (plus le facteur est bas, plus c'est mou)
      land_smooth: 0.45,
    },
    RELOAD_ANIM: {
      ENABLED: true,
      blend_in: 10,         // vitesse de fondu À l'entrée du reload (prise de contrôle)
      blend_out: 8,         // vitesse de fondu À la sortie (PLUS BAS = retour à l'idle plus doux, anti-coupure)
      // Micro-shake "chamber reset" déclenché à cette fraction du reload (0.34 = au 1/3).
      chamber_shake_at: 0.24,
      chamber_shake: 0.56,  // amplitude du micro-shake chamber reset (rad) — discret
      kick_amount: 3.5,    // kick à l'insertion du chargeur (m)
      kick_sfx: null,       // son JOUÉ sur le kick d'insertion (null = aucun). NE PAS mettre 'reload' :
                            // chaque arme joue déjà SON son de reload via sfx_reload au début du reload.
                            // Mets un nom de son court (ex: un clic) seulement si tu veux un effet en plus.
      shake_amount: 1.05,   // micro-shake au chamber (rad)
      overshoot: 0.25,      // léger dépassement au retour idle (ressort) — réduit pour un retour plus doux
      noise_amount: 0.07,  // micro-noise sur la pose pour casser le côté parfait (rad/m)
      sprint_damp: 0.35,    // pendant le reload, la pose de course est réduite à ce facteur (anti hors-cadre)
      // Animation façon recharge REVOLVER : l'arme s'incline à GAUCHE (roll) ET le CANON (avant)
      // pique vers le BAS / arrière monte (basculement vers le sol).
      // NB Wingman : axes du modèle particuliers → rz = roll (lean, POSITIF = gauche),
      //   ry = PITCH (canon haut/bas = le vrai "pencher en bas"), rx = yaw/côté (laissé à 0 ici).
      // pos: x+ =droite, y+ =haut, z+ =vers soi
      phases: [
        // 1) début : l'arme commence à s'incliner à gauche + le canon commence à piquer vers le bas
        { t: 0.12, pos: [-0.01, -0.04, 0.03], rot: [1, 0.16, 0.28], ease: 'easeOut' },
        // 2) phase principale : inclinée à gauche + canon BIEN piqué vers le bas (arrière monte), chargeur exposé
        { t: 0.25, pos: [-0.005, -0.07, 0.02], rot: [1, 0.02, 0.02], ease: 'easeInOut' },
        // 3) nouveau chargeur qui remonte par le bas (l'arme reste basculée canon vers le bas)
        { t: 0.35, pos: [0, -0.06, 0.01], rot: [1, 0.05, 0.08], ease: 'easeInOut' },
        // 4) insertion + impact (kick) : petit à-coup vers le bas
        { t: 0.12, pos: [0, -0.05, 0.00], rot: [0, 0.30, 0.04], ease: 'easeOut', kick: true },
        // 5) FERMETURE DU BARILLET : coup de poignet SEC vers le HAUT — le canon remonte vite et
        //    DÉPASSE l'horizontale (ry négatif = canon haut), comme le "clap" qui referme le barillet,
        //    avec un petit shake d'impact. Phase courte + easeOut = mouvement vif.
        { t: 0.10, pos: [0, 0.02, -0.01], rot: [0, -0.20, 0.10], ease: 'easeOut', shake: true },
        // 6) retour NET et rapide à la pose idle juste après le clap (l'overshoot/ressort lisse la fin)
        { t: 0.20, pos: [0, 0, 0], rot: [0, 0, 0], ease: 'easeInOut' },
      ],
    },
    CROSSHAIR: { SIZE: 10, GAP: 22, THICKNESS: 1, EXPAND: 10, EXPAND_SPEED: 20, HOLSTER_DOT: 4 },
    BULLET_DROP: 10,
    BULLET_SPEED: 520,
    JUMP_SHAKE: 0.125,
    // Shake caméra à l'ATTERRISSAGE : court, basse fréquence, fluide (amorti). amount=ampleur, freq=Hz (bas=doux), decay=vitesse d'extinction, duration=durée max (s).
    LAND_SHAKE: { ENABLED: true, amount: 0.05, freq: 9, decay: 11, duration: 0.38 },
    // Wobble de l'ARME quand elle remonte au changement d'arme (style Call of Duty). amount=ampleur (rad), freq=vitesse du wobble.
    WEAPON_SWITCH_SHAKE: { ENABLED: true, amount: 0.07, freq: 20 },
    // ===== Effet au WALL BOUNCE =====
    // L'arme se penche vite à GAUCHE au contact du mur, puis revient doucement à sa position.
    WALLBOUNCE_KICK: {
      ENABLED: true,
      roll: 0.52,    // roll de l'arme (rad). NÉGATIF = penche à GAUCHE (~ -0.22 ≈ 13°). Positif = droite.
      pos_x: -0.005,  // léger décalage de position vers la gauche (m). 0 = aucun.
      yaw: -0.05,     // léger yaw de l'arme (rad). 0 = aucun.
      attack: 0.15,   // temps de MONTÉE jusqu'au max (s) — petit = "se penche vite".
      return: 0.55,   // temps de RETOUR à zéro (s) — grand = "revient doucement".
    },
    // Léger shake de la caméra joueur au wall bounce. Amplitude en rad (≈ 0.01 = discret). 0 = off.
    WALLBOUNCE_SHAKE: 0.098,   // amplitude du shake au wall bounce (enveloppe attack/decay, façon switch)
    SWAY_SMOOTH: 2,
    SWAY_AMOUNT: 5,
    IDLE_SWAY: { AMOUNT: 0.10, SPEED: 0.005 },
    // ===== Vie procédurale du viewmodel (respiration + micro-mouvements de main) =====
    // Donne l'impression que l'arme est tenue par des mains humaines, sans trembler.
    VIEWMODEL_LIFE: {
      ENABLED: true,
      // recul global de l'arme dans le cadre (m) : + = arme plus loin de la caméra (moins envahissante)
      depth_offset: .05,
      // respiration : mouvement lent vertical/latéral, presque imperceptible
      breath_pos: 0.004,    // amplitude position (m)
      breath_rot: 0.005,    // amplitude rotation (rad)
      breath_speed: 0.9,    // vitesse de la respiration (lent)
      // micro-noise "main" : plus rapide, très subtil, casse le côté robotique
      hand_pos: 0.0025,     // amplitude position (m)
      hand_rot: 0.004,      // amplitude rotation (rad)
      hand_speed: 0.6,      // vitesse du noise main
      // atténuation en ADS (pour garder le viseur lisible) et en mouvement
      ads_damp: 0.35,       // en ADS, la vie est réduite à ce facteur
      move_damp: 0.6,       // en déplacement, légèrement réduite
      // overshoot au retour (ressort) : léger dépassement quand l'arme revient en place
      overshoot: 0.12,
      // variation aléatoire de la rotation à chaque tir (très léger, différent à chaque balle)
      fire_random_rot: 0.012,
    },
    CROUCH_JUMP_ROT: true,
    SPEED_FX_DURATION: 0.8,
    SWITCH_TIME: 0.42,
    GAMEPAD_DEADZONE: 0,
    // Courbe de réponse du stick. 1.0 = LINÉAIRE PUR (= preset 4-3 Linéaire d'Apex). Garde 1.0
    // pour reproduire Apex. < 1.0 amplifie le centre (déforme), > 1.0 l'écrase. Ne pas s'en servir.
    GAMEPAD_RESPONSE: 1.0,
    // Lissage de la vitesse de visée (LE feel Apex) : constante de temps en secondes. La rotation
    // rejoint sa vitesse cible en douceur → micro-ajustements fluides au centre, et léger glissement
    // quand on relâche le stick (la visée ne s'arrête pas net, comme sur Apex).
    // ↑ = plus de glisse/douceur (mais plus de latence) ; 0 = arrêt instantané (sec, non-Apex).
    GAMEPAD_SMOOTH: 0.00,
    // Anti-deadzone : compense un éventuel "trou" matériel au centre du stick (la manette/le
    // navigateur peut avaler les tout petits mouvements). 0 = off. Monte par petits pas (0.02-0.06)
    // SEULEMENT si tu sens encore une zone morte au centre malgré le lissage.
    GAMEPAD_ANTIDEADZONE: 0.06,
    // ===== Vitesses de visée façon Apex ALC (degrés/seconde au stick à fond) =====
    // Fourchettes recommandées : Yaw 220-310, Pitch 160-200, Extra Yaw/Pitch 0, Ramp-up 0 (linéaire).
    GAMEPAD_YAW_SPEED: 220,        // hipfire horizontal (milieu de 220-310)
    GAMEPAD_PITCH_SPEED: 160,      // hipfire vertical (milieu de 160-200, plus lent = contrôle fin)
    GAMEPAD_ADS_YAW_SPEED: 130,    // ADS horizontal (ratio 0.4, façon 4-3)
    GAMEPAD_ADS_PITCH_SPEED: 80,   // ADS vertical (ratio 0.4)
    // ===== AIM ASSIST (manette) façon Apex =====
    // Deux composantes : SLOWDOWN (la caméra ralentit quand le réticule s'approche de l'ennemi)
    // et ROTATION (tire doucement le réticule vers la cible quand tu bouges le stick droit).
    // Tout est PROGRESSIF : nul au bord de la "bulle", maximum quand le réticule est pile dessus.
    AIM_ASSIST: {
      ENABLED: true,
      // Force globale = le "target compensation" d'Apex (PC 0.4, console 0.6). Toi tu veux 0.3.
      // C'est LE curseur principal. Monte si tu veux plus collant, descends pour plus de raw aim.
      STRENGTH: 1,
      // Profondeur du ralentissement au centre, en fraction de STRENGTH. 1.0 = au plus près la
      // caméra tombe à (1 - STRENGTH) de sa vitesse (ex 0.3 => 70%). 0 = pas de slowdown du tout.
      SLOWDOWN: 0.35,
      // Plafond ABSOLU du ralentissement (0.55 = caméra jamais en dessous de 45% de sa vitesse près
      // d'une cible) → garde la visée RÉACTIVE. Monte vers 0.8 pour plus collant, baisse pour plus brut.
      SLOWDOWN_MAX: 0.42,
      // Force du magnétisme rotationnel, en fraction de STRENGTH. 0 = slowdown pur (zéro rotation).
      // Garde-le bas pour rester "PC" : la rotation est ce qui se sent le plus "auto-aim".
      ROTATION: 0.32,
      // Taille de la bulle autour de l'ennemi, en DEGRÉS. Le réticule doit entrer dedans pour que
      // l'assist s'active. Plus grand = s'accroche de plus loin. (Avant : ~8° en dur.)
      BUBBLE_DEG: 5.2,
      // Renforcement sur les BOTS (mode entraînement) : ils sont locaux, on peut être plus généreux
      // pour que l'assist se sente autant que sur un vrai adversaire. ×bulle et ×force.
      BOT_BUBBLE_MULT: 1,
      BOT_STRENGTH_MULT: 1,
      // Aim assist en HIPFIRE = cette fraction de la force ADS (0.6 = 60%). 1 = identique à l'ADS.
      HIP_MULT: 0.62,
      // En hipfire la bulle est agrandie de ce facteur (0.6 = +60%) pour que l'assist s'accroche même
      // quand on vise grossièrement (sans ADS). 0 = même bulle qu'en ADS.
      HIP_BUBBLE_EXTRA: 0.55,
      // Douceur de l'entrée/sortie de la bulle (constante de temps, s). C'EST le réglage qui enlève
      // le côté "brutal" : plus grand = transition plus molle. 0 = entrée instantanée (à éviter).
      SMOOTH: 0.07,
      // Vitesse de base du tirage rotationnel (avancé). Plus grand = la rotation rattrape plus vite.
      ROTATION_RATE: 7.5,
    },
    // Caméra de mort (style Apex/CoD) : vue 3e personne sur son corps puis kill cam
    DEATHCAM: {
      ENABLED: true,
      tp_duration: 2.6,     // durée de la vue 3e personne sur son corps qui tombe (s)
      tp_dist: 3.2,         // distance de la caméra derrière le corps (m)
      tp_height: 2.0,       // hauteur de la caméra au-dessus du corps (m)
      tp_orbit: 0.35,       // vitesse de rotation orbitale de la caméra (rad/s)
      fade_time: 0.4,       // durée du fondu entre les phases (s)
      // Kill cam : replay des dernières secondes DU POINT DE VUE DU TUEUR (façon CoD)
      killcam: false,       // DÉSACTIVÉE (buggait) : juste la vue 3e personne courte puis respawn
      killcam_duration: 3.0,// durée du replay rejoué (s) — les X dernières secondes avant la mort
      killcam_eye: 1.6,     // hauteur des yeux du tueur pour la caméra (m)
      record_hz: 60,        // fréquence d'échantillonnage du buffer (Hz) — capture chaque frame
      record_seconds: 5,    // taille du buffer en secondes (doit être > killcam_duration)
      post_kill_time: 1.5,  // durée (s) de capture APRÈS le kill, pour que la killcam ne coupe pas net
    },
    MODELS: {
      character: '/models/AnimatedBaseCharacter.glb',
      character_scale: 1,
      // Visee haut-du-corps de l'adversaire : la colonne suit le pitch (regard haut/bas).
      // sign: -1 si ca penche a l'envers ; pitch_gain: amplitude ; bones: vertebres concernees.
      spine_aim: { enabled: true, pitch_gain: 0.65, sign: -1, axis: 'x', bones: ['DEF-spine.001','DEF-spine.002','DEF-spine.003'], max: 1.3 },
      // ===== ANIM EN COUCHES (third-person bots & remotes) =====
      // Visee CORPS (twist procedural Hips/Abdomen/Torso vers la cible) : le perso ne tourne plus
      // le dos en tirant. max_deg = torsion max avant que le corps pivote ; smooth = lissage.
      body_aim: { enabled: true, max_deg: 58, smooth: 12, turn_follow: 7, dist: { 'DEF-spine.001': 0.55, 'DEF-spine.002': 0.45 } },  // twist sur spine.001/002 (DEF-hips porte le bob, role 'Body'). turn_follow = vitesse a laquelle le BAS rattrape le regard.
      // Bas du corps par INPUT : VRAIS clips en boucle (Crouch_*, Jump_Loop) -> plus de pose figee.
      // lower_pose conserve (compat tuneLowerFrame) mais n'est plus lu par le driver en couches.
      lower_pose: { fps: 24, jump_clip: 'Jump_Loop', jump_frame: 0, crouch_clip: 'Crouch_Idle_Loop', crouch_frame: 0 },
      // Seuils locomotion BAS : walk_thresh = idle->mvt (m/s) ; side_deg = angle mvt/visee au-dela
      // duquel c'est lateral/arriere (-> Walk_Loop) ; jog_lo/jog_hi = plage vitesse Sprint(<lo)<->Jog(>hi).
      layer_anim: { walk_thresh: 0.5, side_deg: 50, jog_lo: 6, jog_hi: 8, run_thresh: 0.15 },
      // Saut : pose procedurale (plus de roulade). euler [x,y,z] rad par bone. sign: -1 si jambes a l'envers.
      jump_pose: { enabled: true, blend: 12, sign: 1, upperleg: [0.85, 0, 0.08], lowerleg: [-0.95, 0, 0] },
      // Accroupi : flexion procedurale des jambes (squat), MEME convention que jump_pose.
      // upperleg = cuisse vers l'avant/ecartee, lowerleg = genou plie. blend = vitesse d'entree/sortie.
      // Pose ACCROUPIE (3e pers) plug au BAS du corps en mode couches. Jambes via sign ; lean torse (hips/abdomen)
      // compose par-dessus la visee. Reglable en live : tuneCrouch(upperlegX, lowerlegX, hipsX, abdomenX) en degres.
      crouch_pose: { enabled: true, blend: 10, sign: 1, upperleg: [0.9, 0, 0.12], lowerleg: [-1.3, 0, 0], hips: [-0.35, 0, 0], abdomen: [0.45, 0, 0], torso: [0, 0, 0] },
      character_yaw_deg: 180,   // nouveau rig Rigify : 'avant' inverse vs SWAT -> +180
      hitbox: {
        // Capsule ÉLARGIE pour bien englober le model 3D (torse ~0.34 de demi-largeur, haut ~1.79 m).
        // radius 0.42 = marge confortable autour du buste (avant 0.32 ≈ pile au centre) ; bottom 0 = jambes
        // couvertes jusqu'au sol ; top 1.86 = couvre la tête. Utilisé par le CLIENT et le SERVEUR (multi).
        radius: 0.42, bottom: 0.0, top: 1.86, top_crouch: 1.22, head: 0.33,
      },
      // role -> clip (prefixe 'Rig|'). Sert au FALLBACK plein-corps + Death/Hit. La locomotion en
      // COUCHES utilise LOWER_CLIP_SOURCES/UPPER_CLIP_SOURCES (noms courts) cote index.html.
      character_anims: {
        idle:        'Rig|Idle_Loop',
        walk:        'Rig|Walk_Loop',
        run:         'Rig|Jog_Fwd_Loop',
        sprint:      'Rig|Sprint_Loop',
        death:       'Rig|Death01',
        hit:         'Rig|Hit_Chest',
        hit_head:    'Rig|Hit_Head',
        shoot:       'Rig|Pistol_Shoot',
        gun_idle:    'Rig|Pistol_Idle_Loop',
        saber_idle:  'Rig|Sword_Idle',
        saber_attack:'Rig|Sword_Attack',
        crouch_idle: 'Rig|Crouch_Idle_Loop',
        crouch_move: 'Rig|Crouch_Fwd_Loop',
        jump:        'Rig|Jump_Loop',
      },
      weapon_in_hand: { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 },
      weapon: '/models/weapon.glb',
      weapon_scale: 1,
      weapon_position: [0, 0.1, 0],
      weapon_rotation_y_deg: 0,
      weapon_sight: null,
      weapon_muzzle: null,
      // arms.glb sert désormais de modèle de SABRE LASER (arme 3) — plus de bras "holster".
      // null = bras procéduraux pendant le holster (remets un chemin .glb pour des bras custom).
      arms: null,
      arms_scale: 1,
      arms_position: [0, -0.35, -0.35],
      arms_rotation_y_deg: 0,
    },
    SFX_FILES: {
      shot: '/audio/shot.mp3', hit_body: '/audio/hit_body.mp3',
      hit_shield: '/audio/hit_shield.mp3', hit_flesh: '/audio/hit_flesh.mp3',
      hit_head: '/audio/hit_head.mp3', shield_crack: '/audio/shield_crack.mp3',
      slide: '/audio/slide.mp3', slide_jump: '/audio/slide_jump.mp3',
      wallbounce: '/audio/wallbounce.mp3', mantle: '/audio/mantle.mp3',
      superglide: '/audio/superglide.mp3', dash: '/audio/dash.mp3', reload: '/audio/reload.mp3',
      holster: '/audio/holster.mp3', equip: '/audio/equip.mp3',
      footstep: '/audio/footstep.mp3', death: '/audio/death.mp3',
      orb_pickup: '/audio/orb_pickup.mp3', crouch: '/audio/crouch.mp3',
      wingman_shot: '/audio/wingman_shot.mp3', wingman_reload: '/audio/wingman_reload.mp3',
      // ===== UI / menu =====
      menu_audio: '/audio/menu_audio.mp3',   // musique d'accueil (boucle)
      button1: '/audio/button1.mp3',         // clic : Mêlée Générale / Mode Bots
      button2: '/audio/button2.mp3',         // clic : tous les autres boutons
      spawn: '/audio/spawn.mp3',             // entrée en partie (online / bots)
      perfect_kill: '/audio/perfect_kill.mp3',   // jingle de félicitation au kill (notif PERFECT KILL / NICE SHOTS)
      velocity: '/audio/velocity.mp3',           // boucle "vitesse" jouée à la vélocité max (fondu d'entrée/sortie)
      saber_equip: '/audio/saber_equip.mp3',     // sortie du sabre laser
      saber_holster: '/audio/saber_holster.mp3', // rangement du sabre laser
      saber1: '/audio/saber1.mp3', saber2: '/audio/saber2.mp3', saber3: '/audio/saber3.mp3', // coups de sabre dans le vide (aléatoire)
      saber_hit1: '/audio/saber_hit1.mp3', saber_hit2: '/audio/saber_hit2.mp3', // IMPACT du sabre sur un ennemi (aléatoire)
    },
    SFX_VOLUME: 0.6,
    MENU_MUSIC_VOLUME: 0.5,   // volume de la musique du menu (boucle accueil/lobby)
    // ===== Overlay "spawn dans la simulation" (shader lines) a l'entree en partie =====
    SPAWN_OVERLAY: {
      ENABLED: true,
      duration: 3.0,   // duree totale de l'overlay (s)
      warp: 0.06,      // amplitude de deformation du jeu pilotee par le BLANC du shader (fraction d'ecran)
      intensity: 1.0,  // luminosite des lignes ajoutees
    },
    SHOT_PITCH_VAR: 0.18,
    // ===== Volume PAR SON (multiplicateur individuel) =====
    // Chaque valeur multiplie le volume de CE son uniquement : 1 = inchangé, 0.5 = moitié, 2 = double.
    // Volume final d'un son = SFX_VOLUME × SFX_GAINS[nom]. Sert à remonter/baisser un effet précis
    // sans toucher au volume global. Un son absent de la liste = facteur 1.
    SFX_GAINS: {
      shot: 1.0, wingman_shot: 1.0,
      reload: 1.0, wingman_reload: 1.0,
      hit_body: 1.0, hit_flesh: 1.0, hit_shield: 1.0, hit_head: 1.0,
      shield_crack: 1.0,
      footstep: 1.0,
      slide: 1.0, slide_jump: 1.0, wallbounce: 1.0, mantle: 1.0, superglide: 1.0,
      holster: 1.0, equip: 1.0, crouch: 1.0,
      death: 1.0, orb_pickup: 1.0,
      button1: 1.0, button2: 1.0, spawn: 1.0,
    },
    // ===== Sons d'impact de balle PAR SURFACE =====
    // Par défaut les impacts sont SYNTHÉTISÉS (un caractère par surface : mur, conteneur, rampe, sol).
    // Pour utiliser TES propres sons : passe use_files à true et dépose tes .mp3 aux chemins indiqués
    //   (ex : public/audio/impact/wall.mp3). Si un fichier est absent → fallback synthèse, sans erreur.
    // volume = multiplicateur du son de CETTE surface ; master_volume = volume de TOUS les impacts.
    IMPACT_SFX: {
      use_files: true,        // true = jouer tes fichiers ci-dessous au lieu de la synthèse
      master_volume: 0.2,      // volume global de tous les impacts de surface
      surfaces: {
        wall:  { file: '/audio/impact/wall.mp3',  volume: 1.0 },
        crate: { file: '/audio/impact/crate.mp3', volume: 1.0 },
        ramp:  { file: '/audio/impact/ramp.mp3',  volume: 1.0 },
        floor: { file: '/audio/impact/floor.mp3', volume: 0.4 },
      },
    },
    // ===== Immersion audio =====
    AUDIO_FX: {
      ENABLED: true,
      // Réverb d'espace. Par défaut : IR synthétique AMÉLIORÉ (early reflections + queue lissée),
      // bien plus naturel que du bruit brut. Pour une réverb PRO, fournis un vrai fichier IR (.wav)
      // dans 'ir_file' (ex: '/audio/ir_room.wav') — il sera utilisé en priorité.
      reverb: {
        // Désactivée : on n'utilise plus la réverb synthétique.
        // La vraie IR est configurée dans AUDIO_IR plus bas.
        enabled: false,
        ir_file: null,
        seconds: 0,
        decay: 0,
        predelay: 0,
        damp: 3200,
        wet_shot: 0,
        wet_world: 0,
        wet_default: 0,
      },
      // Punch de basse synthétisé SOUS le tir — DÉSACTIVÉ (sonnait trop "boomy").
      shot_punch: {
        enabled: false,
        freq: 90, freq_end: 42, dur: 0.14, gain: 0.5,
      },
      // Variation par son : casse l'effet "boucle mécanique"
      var_pitch: 0.06,     // ±6% de hauteur aléatoire
      var_gain: 0.12,      // ±12% de volume aléatoire
      // ===== Pas réactifs à la vitesse du joueur =====
      footsteps: {
        spread: 0.5,           // décalage stéréo gauche/droite par foulée (m)
        min_speed: 2.2,        // vitesse en dessous de laquelle on ne fait pas de pas
        // cadence : intervalle entre deux pas (s), interpolé selon la vitesse
        interval_walk: 0.50,   // intervalle à vitesse de marche
        interval_run: 0.28,    // intervalle à pleine course (plus rapide = pas plus rapprochés)
        speed_walk: 3.0,       // vitesse considérée "marche"
        speed_run: 8.0,        // vitesse considérée "course rapide"
        // volume : plus fort quand on court vite
        vol_walk: 0.18,        // volume à la marche
        vol_run: 0.5,          // volume à pleine course
        vol_crouch: 0.10,      // volume accroupi (discret)
        // pitch : plus aigu/vif quand on court, + variation aléatoire par pas
        pitch_walk: 0.9,       // hauteur à la marche (un peu plus grave/lourd)
        pitch_run: 1.12,       // hauteur en course (plus vif)
        pitch_var: 0.08,       // ±8% de variation aléatoire par pas
      },
    },
    // ===== Footsteps multi-samples façon FPS/Apex =====
    // Crée ces fichiers dans ton projet :
    // public/audio/footsteps/concrete/step_01.mp3 ... step_06.mp3
    // public/audio/gear/gear_1.mp3 ... gear_3.mp3
    // Si un fichier est absent, le jeu garde le fallback public/audio/footstep.mp3.
    FOOTSTEPS: {
      ENABLED: true,
      files: [
        '/audio/footsteps/concrete/step_01.mp3',
        '/audio/footsteps/concrete/step_02.mp3',
        '/audio/footsteps/concrete/step_03.mp3',
        '/audio/footsteps/concrete/step_04.mp3',
        '/audio/footsteps/concrete/step_05.mp3',
        '/audio/footsteps/concrete/step_06.mp3',
      ],
      // gauche/droite subtil en première personne. Trop haut = cartoon.
      spread: 0.12,
      min_speed: 0.35,
      // cadence selon vitesse
      interval_walk: 0.52,
      interval_run: 0.28,
      interval_crouch: 0.68,
      speed_walk: 3.8,
      speed_run: 7.6,
      // volumes
      vol_walk: 0.44,
      vol_run: 0.78,
      vol_crouch: 0.30,
      // pitch dynamique + petites variations pour casser la boucle mécanique
      pitch_walk: 0.92,
      pitch_run: 1.08,
      pitch_var: 0.04,
      sample_pitch_var: 0.025,
      sample_gain_var: 0.40,
      ref_distance: 3.5,
      max_distance: 35,
      gear: {
        enabled: true,
        files: [
          '/audio/gear/gear_1.mp3',
          '/audio/gear/gear_2.mp3',
          '/audio/gear/gear_3.mp3',
        ],
        chance: 0.42,
        volume: 0.32,
        pitch_var: 0.05,
        volume_var: 0.12,
        // petit décalage après l'impact du pied pour simuler l'équipement/tissu
        delay: 0.025,
      },
    },
    // ===== Vraie reverb IR par convolution =====
    // Place le fichier ici : public/audio/ir/IR.wav
    // Le jeu reste jouable si le fichier est absent : fallback en son sec, sans erreur bloquante.
    AUDIO_IR: {
      ENABLED: true,
      FILE: '/audio/ir/IR_2.mp3',

      // Dosage Apex-like : le son FPS reste sec et lisible.
      SHOT_WET: 0.14,      // tirs en première personne : très léger
      WORLD_WET: 0.20,     // tirs ennemis/bots + sons du monde : un peu plus d'espace
      FOOTSTEP_WET: 0.03,  // pas : très subtil
      DEFAULT_WET: 0.05,   // reload, holster, equip, UI/audio non positionné
      DRY: 1.0,
    },
    WEAPON_LIGHT: { ambient: 0.5, key: 1.5, fill: 0.3, force_unlit: false }, // ambient=remplissage doux, key=directionnelle (contraste/relief), fill=contre-jour leger
    AMBIENT_FILE: '/audio/ambient.mp3',
    AMBIENT_VOLUME: 0.55,
    // ===== Modeles 3D des structures (remplacent le VISUEL des boites par type ; collision conservee) =====
    // Depose tes .glb dans public/models/ avec ces noms (ou change les chemins). Le modele est ETIRE
    // pour remplir chaque boite. Fichier absent -> la boite d'origine est gardee (aucune erreur).
    STRUCTURE_MODELS: {
      enabled: true,
      hideBox: true,        // cache la boite d'origine (la collision reste active)
      byType: {
        container: '/models/container.glb',
        metal:     '/models/concrete2.glb',
        wall:      '/models/wall.glb',
        crate:     '/models/crate.glb',
      },
    },
    TEXTURES: {
      sky: '/textures/moon_sky.jpg', floor: '/textures/Asphalt_001_COLOR.png',
      wall: '/textures/Asphalt_001_COLOR.png', crate: '/textures/crate.jpg',
      platform: '/textures/platform.jpg', ramp: '/textures/ramp.jpg',
    },
    TEXTURE_REPEAT: { floor: 10, wall: 3, crate: 1, platform: 2, ramp: 2 },
    HUD: {
      images: [
        { file: '/textures/hud/game-logo.png', anchor: 'top-right', x: 18, y: 18, w: 280, opacity: 0.95 }, // logo top-droite, meme taille que la mini-map (280)
      ],
      colors: { shield: '#4db8ff', health: '#ff5a5a', name: '#eef2f6' },
      name_size: 14, hide: [], ammo_scale: 1.7, score_scale: 1.2,
    },
    // ===== Numéros de dégâts (au-dessus de l'ennemi/bot) =====
    // TAILLE CONSTANTE À L'ÉCRAN : le chiffre garde la même taille quelle que soit la distance.
    DAMAGE_NUMBERS: {
      screen_size: 0.072,    // hauteur du chiffre = fraction de la hauteur d'écran (constante) — agrandi pour visibilité
      head_mult: 1.25,       // headshots un peu plus gros
      color_shield: '#7fd4ff', // dégâts au BOUCLIER (bleu, image 1)
      color_health: '#ffe9c0', // dégâts aux PV (crème, image 2)
      color_head:   '#ff5a5a', // headshot
      glow_shield:  '#1f9dff', // halo bleu autour du chiffre quand on touche le bouclier (image 1)
      glow_health:  '#e62121', // halo orangé autour du chiffre quand on touche les PV (image 2)
      glow_head:    '#ff3030', // halo rouge sur headshot
      glow_strength: 0,       // intensité du halo (px de flou). 0 = pas de glow
      stack_window: 0.7,       // s : tant qu'on retape la cible dans cette fenêtre, les dégâts s'empilent
    },
    // ===== Barre d'info SHIELD / PV au-dessus de l'ennemi (image 3) =====
    // Apparaît quand on touche la cible, puis s'efface. Taille constante à l'écran. S'applique aux bots aussi.
    ENEMY_HEALTHBAR: {
      ENABLED: true,
      screen_width: 0.13,      // largeur de la barre = fraction de la largeur d'écran (constante)
      aspect: 7.0,             // largeur/hauteur de la barre (plus haut = barre plus fine)
      y_offset: 2.25,          // hauteur au-dessus des pieds, debout (m)
      y_offset_crouch: 1.55,   // hauteur accroupi (m)
      show_seconds: 2.6,       // reste affichée X s après le dernier dégât
      fade_seconds: 0.4,       // durée du fondu de disparition
      segments: 3,             // segments de bouclier (75 PV de bouclier → 3×25)
      shield_color: '#3d98ec', // bouclier restant (blanc cassé, façon Apex)
      health_color: '#ff5a5a', // PV restants
      empty_color:  'rgba(255,255,255,0.10)', // portion vide
      back_color:   'rgba(8,12,18,0.72)',     // fond de la plaque
      gap: 2,                  // espace entre segments de bouclier (px texture)
    },
    // ===== Fondu du CORPS à la mort (ennemi & bots) =====
    // Quand une cible meurt, son corps s'efface en opacité (après un court délai laissant voir
    // l'anim/ragdoll de mort). La barre de vie au-dessus s'efface aussi en même temps.
    CORPSE_FADE: {
      ENABLED: true,
      delay: 0.7,      // s avant le début du fondu (laisse voir la mort)
      duration: 1.1,   // s de fondu d'opacité jusqu'à disparition complète
    },
    // ===== Viewmodel d'ANIMATION DE RELOAD (modèle animé joué uniquement pendant le reload) =====
    // Le modèle (mains + flingue) ayant été animé À PARTIR de R69_hands, il se cale AUTOMATIQUEMENT
    // sur ton arme : même recentrage, même échelle, même position/rotation, même groupe → aucun
    // réglage manuel. Place juste le fichier dans public/models/ (ici : public/models/r69_reload.glb).
    RELOAD_VIEWMODEL: {
      ENABLED: true,
      weapon_index: 0,                 // 0 = R69 (l'anim ne joue que pour cette arme)
      model: '/models/r69_reload.glb',
      clip: 'Scene',                   // nom du clip dans le GLB
      hide_arms: true,                 // masque les bras procéduraux pendant le reload
      // Amplifie le DÉPLACEMENT global de l'arme baké dans l'anim (pour mieux "sentir" le reload).
      // 1 = fidèle à ton anim Blender ; 1.5–2.5 = plus prononcé. N'affecte pas l'alignement.
      motion_gain: 1.0,
      // micro-réglage FACULTATIF (normalement inutile, laisse tout à 0 / 1) :
      offset: [0, 0, 0],               // décalage fin [x,y,z] si l'auto-calage est légèrement off
      rot_offset_deg: [0, 0, 0],       // rotation fine [x,y,z] en degrés
      scale_mul: 1.0,                  // multiplicateur d'échelle fin
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = GAMECFG;
  else root.GAMECFG = GAMECFG;
})(typeof window !== 'undefined' ? window : globalThis);
