/**
 * Validation complète de donnees/ : schémas Zod + contrôles croisés.
 * Lancé par la CI sur chaque pull request, et en local par `npm run valider`.
 *
 * Code de sortie : 1 s'il existe au moins une erreur (la pull request est refusée), 0 sinon.
 * Sur GitHub Actions, chaque problème devient une annotation sur le fichier concerné,
 * et un récapitulatif est ajouté au résumé de l'exécution.
 */
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { controlesCroises } from "./lib/controles";
import { type Probleme, chargerDonnees } from "./lib/donnees";

const RACINE = process.env.LOICI_RACINE ?? join(import.meta.dirname, "..");
const SUR_GITHUB = process.env.GITHUB_ACTIONS === "true";

/** Échappement imposé par le format des annotations GitHub. */
const echapper = (texte: string, propriete = false) => {
  let t = texte.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  if (propriete) t = t.replace(/:/g, "%3A").replace(/,/g, "%2C");
  return t;
};

function annotation(p: Probleme): string {
  const commande = p.niveau === "erreur" ? "error" : "warning";
  const titre = p.niveau === "erreur" ? "Donnée refusée" : "À vérifier";
  const message = p.champ ? `${p.champ} : ${p.message}` : p.message;
  return `::${commande} file=${echapper(p.fichier, true)},title=${echapper(titre, true)}::${echapper(message)}`;
}

function rapportTexte(problemes: Probleme[]): string {
  const parFichier = new Map<string, Probleme[]>();
  for (const p of problemes) parFichier.set(p.fichier, [...(parFichier.get(p.fichier) ?? []), p]);
  const lignes: string[] = [];
  for (const [fichier, liste] of [...parFichier].sort(([a], [b]) => a.localeCompare(b))) {
    lignes.push(`\n${fichier}`);
    for (const p of liste) lignes.push(`  ${p.niveau === "erreur" ? "✖" : "⚠"} ${p.champ ? `${p.champ} : ` : ""}${p.message}`);
  }
  return lignes.join("\n");
}

function resumeMarkdown(problemes: Probleme[], effectifs: string): string {
  const erreurs = problemes.filter((p) => p.niveau === "erreur");
  const avertissements = problemes.filter((p) => p.niveau === "avertissement");
  const ligne = (p: Probleme) => `| ${p.niveau === "erreur" ? "❌" : "⚠️"} | \`${p.fichier}\` | \`${p.champ || "—"}\` | ${p.message.replace(/\|/g, "\\|")} |`;
  const tete = erreurs.length
    ? `## ❌ Données refusées : ${erreurs.length} erreur(s)\n\nCorrigez les points ci-dessous. Chaque donnée doit citer une source existante et valide.`
    : "## ✅ Données valides";
  const tableau = problemes.length
    ? `\n\n| | Fichier | Champ | Problème |\n|---|---|---|---|\n${[...erreurs, ...avertissements].map(ligne).join("\n")}`
    : "";
  return `${tete}\n\n${effectifs}${tableau}\n\nGuide : voir CONTRIBUTING.md, section « Ajouter une loi sourcée ».\n`;
}

async function principal() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { donnees, problemes: problemesFichiers } = await chargerDonnees(RACINE);
  const problemes = [...problemesFichiers, ...controlesCroises(donnees, aujourdhui)];
  const erreurs = problemes.filter((p) => p.niveau === "erreur").length;
  const avertissements = problemes.length - erreurs;
  const effectifs =
    `${donnees.textes.length} texte(s), ${donnees.sources.length} source(s), ` +
    `${donnees.parlementaires.length} parlementaire(s), ${donnees.partis.length} parti(s) valides.`;

  if (problemes.length) console.log(rapportTexte(problemes));
  console.log(`\n${effectifs}\n${erreurs} erreur(s), ${avertissements} avertissement(s).`);

  if (SUR_GITHUB) {
    for (const p of problemes) console.log(annotation(p));
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, resumeMarkdown(problemes, effectifs));
  }

  if (erreurs > 0) {
    console.error("\n✖ Données refusées. Chaque erreur ci-dessus doit être corrigée.\n");
    process.exit(1);
  }
  console.log("\n✔ Données valides.\n");
}

principal().catch((e: Error) => {
  console.error(`✖ Erreur inattendue : ${e.stack ?? e.message}`);
  process.exit(1);
});
