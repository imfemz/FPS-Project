#!/usr/bin/env bash
# =====================================================
#  NEON COMPOUND — Partager le jeu en 1 commande
#  Lance le serveur (si besoin) + un tunnel public
#  cloudflared, puis affiche l'URL à envoyer aux testeurs.
#  Aucun compte requis. Le lien marche tant que ce
#  terminal reste ouvert et que le Mac est allumé.
# =====================================================
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-3000}"
LOG="/tmp/neon_tunnel.log"

echo "==> NEON COMPOUND — préparation du lien public"

# 1) Dépendances
if [ ! -d node_modules/ws ]; then
  echo "==> Installation des dépendances (npm install)..."
  npm install
fi

# 2) Serveur de jeu sur le port $PORT (le démarre s'il ne tourne pas déjà)
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "==> Serveur déjà actif sur :$PORT (réutilisé)"
else
  echo "==> Démarrage du serveur (node server.js) sur :$PORT..."
  PORT="$PORT" nohup node server.js >/tmp/neon_server.log 2>&1 &
  sleep 2
fi

# 3) Tunnel public cloudflared (URL aléatoire, sans compte)
if ! command -v cloudflared >/dev/null 2>&1; then
  echo "!! cloudflared introuvable. Installe-le avec : brew install cloudflared" >&2
  exit 1
fi

echo "==> Ouverture du tunnel public..."
: > "$LOG"
cloudflared tunnel --url "http://localhost:$PORT" >"$LOG" 2>&1 &
TUN_PID=$!

# 4) Récupère et affiche l'URL publique
URL=""
for _ in $(seq 1 30); do
  URL="$(grep -Eo 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done

echo
if [ -n "$URL" ]; then
  echo "============================================================"
  echo "  ✅ LIEN À PARTAGER AVEC LES TESTEURS :"
  echo "     $URL"
  echo "------------------------------------------------------------"
  echo "  • 1v1 en ligne : les 2 premiers cliquent JOUER."
  echo "  • Solo : bouton MODE ENTRAÎNEMENT (BOTS)."
  echo "  • Après une mise à jour du jeu : les testeurs RECHARGENT,"
  echo "    pas besoin de relancer ce script (sauf si server.js change)."
  echo "  • Ferme ce terminal (ou Ctrl+C) pour couper le lien."
  echo "============================================================"
else
  echo "!! Tunnel pas encore prêt. Voir le log : $LOG" >&2
fi

# Garde le tunnel au premier plan pour que Ctrl+C l'arrête proprement
wait "$TUN_PID"
