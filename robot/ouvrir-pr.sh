#!/usr/bin/env bash
# Publie les propositions du robot dans une pull request — JAMAIS directement sur la branche principale.
# Une seule pull request à la fois, sur la branche « robot/collecte », mise à jour à chaque exécution.
#
# Usage : robot/ouvrir-pr.sh <rapport.md>   (dans GitHub Actions, avec GH_TOKEN et BRANCHE_PRINCIPALE)
set -euo pipefail

RAPPORT="${1:-rapport-robot.md}"
PRINCIPALE="${BRANCHE_PRINCIPALE:-main}"
BRANCHE="robot/collecte"
AUTEUR_ROBOT="LoiCI robot"
EMAIL_ROBOT="41898282+github-actions[bot]@users.noreply.github.com"
TITRE="Robot de collecte : propositions à relire ($(date -u +%F))"

if [ -z "$(git status --porcelain -- donnees)" ]; then
  echo "Aucune proposition : pas de pull request."
  exit 0
fi

numero_pr() { gh pr list --head "$BRANCHE" --state open --json number --jq '.[0].number // empty'; }

# Ne jamais écraser le travail d'un relecteur : si la branche contient des commits humains, on commente seulement.
if git ls-remote --exit-code --heads origin "$BRANCHE" >/dev/null 2>&1; then
  git fetch --quiet origin "$BRANCHE"
  AUTEURS="$(git log --format='%an' "origin/${PRINCIPALE}..origin/${BRANCHE}" | sort -u)"
  if [ -n "$AUTEURS" ] && [ "$AUTEURS" != "$AUTEUR_ROBOT" ]; then
    echo "::warning::La branche ${BRANCHE} contient des commits humains : elle n'est pas écrasée."
    NUM="$(numero_pr)"
    if [ -n "$NUM" ]; then gh pr comment "$NUM" --body-file "$RAPPORT"; fi
    exit 0
  fi
fi

git switch --quiet -C "$BRANCHE"
git add donnees
git -c user.name="$AUTEUR_ROBOT" -c user.email="$EMAIL_ROBOT" commit --quiet -m "Robot : propositions du $(date -u +%F)"
git push --quiet --force origin "$BRANCHE"

gh label create robot --color BFD4F2 --description "Propositions du robot de collecte" --force >/dev/null 2>&1 || true
NUM="$(numero_pr)"
if [ -n "$NUM" ]; then
  gh pr edit "$NUM" --title "$TITRE" --body-file "$RAPPORT"
  echo "Pull request #${NUM} mise à jour."
else
  gh pr create --base "$PRINCIPALE" --head "$BRANCHE" --title "$TITRE" --body-file "$RAPPORT" --label robot
fi
