/**
 * Liens vers le dépôt GitHub : formulaires d'issue (pré-remplis quand c'est possible), wiki, guide de contribution.
 * Les formulaires d'issue GitHub acceptent la valeur d'un champ dans l'adresse (?<id du champ>=…).
 */
export function lienIssue(depot: string, gabarit: string, champs: Record<string, string> = {}): string {
  const params = new URLSearchParams({ template: gabarit, ...champs });
  return `${depot}/issues/new?${params.toString()}`;
}

export const liensDepot = (depot: string) => ({
  proposerTexte: lienIssue(depot, "proposer-texte.yml"),
  signalerErreur: lienIssue(depot, "signaler-erreur.yml"),
  signalerBug: lienIssue(depot, "signaler-bug.yml"),
  guide: `${depot}/blob/main/CONTRIBUTING.md`,
  wiki: `${depot}/wiki`,
  ajouterTexte: `${depot}/wiki/Ajouter-un-texte`,
  propositionsRobot: `${depot}/pulls?q=is%3Apr+is%3Aopen+label%3Arobot`,
  issuesOuvertes: `${depot}/issues`,
  depot,
});
