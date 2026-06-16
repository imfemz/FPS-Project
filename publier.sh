#!/usr/bin/env bash
# =====================================================
#  NEON COMPOUND — Publier la version actuelle
#  Commit + push sur GitHub. Si Render est connecté au
#  repo, il redéploie automatiquement (~2-3 min).
#  Usage :  ./publier.sh "ce que j'ai changé"
# =====================================================
set -euo pipefail
cd "$(dirname "$0")"

MSG="${1:-Mise à jour NEON COMPOUND}"

echo "==> Ajout des fichiers modifiés…"
git add -A

if git diff --cached --quiet; then
  echo "==> Rien de nouveau à publier."
else
  git -c user.name="Femz" -c user.email="fraps81@gmail.com" commit -q -m "$MSG"
  echo "==> Commit créé : $MSG"
fi

echo "==> Envoi vers GitHub (imfemz/FPS-Project)…"
git push origin main

echo
echo "✅ Poussé sur GitHub."
echo "   Si Render est connecté : il redéploie tout seul (~2-3 min)."
echo "   Sinon, les testeurs sur le tunnel n'ont qu'à RECHARGER la page."
