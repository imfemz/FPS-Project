#!/usr/bin/env bash
# =====================================================
#  NEON COMPOUND — Auto-publish (daemon)
#  Pousse AUTOMATIQUEMENT sur GitHub des que tu modifies
#  des fichiers du projet (config ou autres).
#
#   - Perimetre : TOUS les changements (git add -A)
#   - Cadence   : pousse apres 60s SANS nouvelle modif (regroupe)
#   - Tourne en tache de fond via launchd (voir le .plist)
#
#  NE PAS lancer en boucle a la main : c'est launchd qui le gere.
#  Test ponctuel d'une publication : RUN_ONCE=1 ./auto-publier.sh
# =====================================================
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

REPO="/Users/femz/Game Dev/FemzFPS /prototype-web/fps-r184"
QUIET=60          # secondes de calme requises avant de pousser
POLL=10           # frequence de verification (s)
LOG="$HOME/Library/Logs/femz-fps-autopush.log"

mkdir -p "$(dirname "$LOG")" 2>/dev/null
log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }

cd "$REPO" 2>/dev/null || { log "ERREUR: depot introuvable: $REPO"; exit 1; }

# Signature de l'etat de travail : change des qu'un fichier suivi OU non suivi bouge.
worktree_sig() {
  {
    git status --porcelain
    git diff
    git diff --cached
    # mtime des fichiers concernes (capte aussi l'edition de fichiers non suivis)
    git status --porcelain | sed 's/^...//' | while IFS= read -r f; do
      [ -e "$f" ] && stat -f '%m %N' "$f" 2>/dev/null
    done
  } | shasum | cut -d' ' -f1
}

publish() {
  git add -A
  if git diff --cached --quiet; then
    return 0
  fi
  local n files br
  n=$(git diff --cached --name-only | wc -l | tr -d ' ')
  files=$(git diff --cached --name-only | sed 's/^/   - /')
  br=$(git rev-parse --abbrev-ref HEAD)
  if git -c user.name="Femz" -c user.email="fraps81@gmail.com" \
        commit -q -m "Auto-publish $(date '+%Y-%m-%d %H:%M') — $n fichier(s)" -m "$files"; then
    log "Commit cree ($n fichier(s))."
  else
    log "Rien a committer (ou commit refuse)."
    return 0
  fi
  if git push origin "$br" >>"$LOG" 2>&1; then
    log "OK  Pousse sur GitHub ($br). Render redeploie si connecte."
  else
    log "ECHEC push (commit garde en local). Nouvel essai au prochain changement. Verifie reseau/identifiants, ou lance ./publier.sh."
  fi
}

run_loop() {
  log "Demarrage surveillance — perimetre: TOUT (git add -A), calme requis: ${QUIET}s, sondage: ${POLL}s."
  local last_sig="" last_change=0 now sig
  while true; do
    if [ -n "$(git status --porcelain)" ]; then
      sig="$(worktree_sig)"
      now=$(date +%s)
      if [ "$sig" != "$last_sig" ]; then
        last_sig="$sig"; last_change=$now           # ca bouge encore -> on attend le calme
      elif [ $(( now - last_change )) -ge "$QUIET" ]; then
        publish; last_sig=""; last_change=0          # calme atteint -> on pousse
      fi
    else
      last_sig=""; last_change=0
    fi
    sleep "$POLL"
  done
}

if [ "${RUN_ONCE:-0}" = "1" ]; then
  publish
else
  run_loop
fi
