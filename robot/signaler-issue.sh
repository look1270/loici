#!/usr/bin/env bash
# Ouvre une issue (ou commente celle déjà ouverte) pour signaler un problème du robot.
# Usage : robot/signaler-issue.sh "<titre>" <fichier-texte.md>
set -euo pipefail
TITRE="$1"
TEXTE="$2"
gh label create robot --color BFD4F2 --description "Propositions du robot de collecte" --force >/dev/null 2>&1 || true
NUM="$(gh issue list --state open --label robot --search "in:title \"${TITRE}\"" --json number,title \
  --jq "map(select(.title == \"${TITRE}\")) | .[0].number // empty")"
if [ -n "$NUM" ]; then
  gh issue comment "$NUM" --body-file "$TEXTE"
  echo "Issue #${NUM} complétée."
else
  gh issue create --title "$TITRE" --body-file "$TEXTE" --label robot
fi
