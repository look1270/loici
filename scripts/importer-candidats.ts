/**
 * Transforme une extraction automatique externe en FILE DE RELECTURE (rien n'est publié).
 *
 *   npm run importer -- <fichier.json> [--sortie import/<nom>]
 *
 * Écrit dans le dossier de sortie (hors de donnees/, donc ignoré par le site et la validation) :
 *   candidats.json   tous les candidats, regroupés, avec leurs observations brutes et leurs alertes
 *   RELECTURE.md     liste à cocher, du plus fiable au moins fiable
 *
 * Chaque candidat doit ensuite être vérifié dans sa source, puis saisi dans donnees/ selon le guide
 * « Ajouter un texte » (résumé, étapes datées, source archivée). La CI fait le reste.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { type Candidat, fichierExtraction, regrouper } from "./lib/candidats";
import { chargerDonnees } from "./lib/donnees";
import { STATUTS_INFOS, TYPES_TEXTE } from "../app/utils/libelles";

const RACINE = join(import.meta.dirname, "..");

const libelleStatut = (s: string) => STATUTS_INFOS[s as keyof typeof STATUTS_INFOS]?.libelle ?? s;

function ligneCandidat(c: Candidat): string {
  const l: string[] = [];
  l.push(`- [ ] **${c.titre}**`);
  const statut = c.statuts_observes.length ? c.statuts_observes.map(libelleStatut).join(" → ") : "non renseigné";
  l.push(`  - ${TYPES_TEXTE[c.type_propose]?.libelle ?? c.type_propose}${c.nature_proposee ? ` · ${c.nature_proposee}` : ""} · statut observé : ${statut}` +
    (c.numero_loi ? ` · ${c.numero_loi}` : "") + (c.date_promulgation ? ` · promulguée le ${c.date_promulgation}` : ""));
  if (c.statuts_observes.length > 1) l.push(`  - ⚠ statuts contradictoires dans l'extraction : vérifier le dernier état réel`);
  for (const n of c.notes) l.push(`  - ⚠ ${n}`);
  for (const r of c.raisons) l.push(`  - ⚠ ${r}`);
  const dates = [...new Set(c.observations.map((o) => o.date).filter(Boolean))].sort();
  if (dates.length) l.push(`  - dates relevées (sens inconnu : étape, date citée…) : ${dates.join(", ")}`);
  for (const a of [...new Set(c.observations.flatMap((o) => o.alertes))]) l.push(`  - ⚠ ${a}`);
  for (const s of c.sources) l.push(`  - source${s.generique ? " (générique : chercher la page précise)" : ""} : <${s.url}>`);
  if (c.observations.length > 1) l.push(`  - ${c.observations.length} lignes de l'extraction regroupées`);
  return l.join("\n");
}

function rapport(candidats: Candidat[], fichier: string, meta: Record<string, unknown> | undefined, nbLignes: number): string {
  const nouveaux = candidats.filter((c) => !c.deja_recense);
  const par = (classe: Candidat["classe"]) => nouveaux.filter((c) => c.classe === classe);
  const precis = par("candidat").filter((c) => c.sources.some((s) => !s.generique));
  const generiques = par("candidat").filter((c) => c.sources.every((s) => s.generique));
  const recenses = candidats.filter((c) => c.deja_recense);

  const sections: string[] = [
    `# File de relecture — ${fichier}`,
    "",
    `Extraction automatique${meta?.genere_le ? ` du ${meta.genere_le}` : ""} : **${nbLignes} lignes**, regroupées en **${candidats.length} textes distincts**.`,
    "",
    "> **Rien de cette liste n'est publié.** Chaque texte doit être vérifié dans sa source, puis saisi dans `donnees/`",
    "> selon le guide [Ajouter un texte](https://github.com/look1270/loici/wiki/Ajouter-un-texte) : titre officiel exact,",
    "> résumé neutre, étapes datées et sourcées, source archivée sur la Wayback Machine.",
    "> Les statuts et dates ci-dessous sont ceux de l'extraction : ils peuvent être faux.",
    "",
    "| Catégorie | Nombre |",
    "|---|---|",
    `| Candidats avec une source précise | ${precis.length} |`,
    `| Candidats avec seulement une source générique | ${generiques.length} |`,
    `| Titres à corriger avant saisie | ${par("titre_a_corriger").length} |`,
    `| Déjà recensés dans LoiCI | ${recenses.length} |`,
    `| Écartés (pas des textes) | ${par("ecarte").length} |`,
    "",
    "Une fois un texte saisi (ou écarté après vérification), cochez sa case.",
    "",
    `## 1. Candidats avec une source précise (${precis.length})`,
    "",
    ...precis.map(ligneCandidat),
    "",
    `## 2. Candidats avec seulement une source générique (${generiques.length})`,
    "",
    "La source est une page d'accueil, un rapport d'activité ou un document de synthèse : trouvez la page ou le PDF du texte lui-même.",
    "",
    ...generiques.map(ligneCandidat),
    "",
    `## 3. Titres à corriger avant saisie (${par("titre_a_corriger").length})`,
    "",
    "Le titre extrait est coupé ou mélangé avec un texte voisin : recopiez l'intitulé exact depuis la source.",
    "",
    ...par("titre_a_corriger").map(ligneCandidat),
    "",
    `## 4. Déjà recensés dans LoiCI (${recenses.length})`,
    "",
    "Vérifier si l'extraction apporte une étape ou une source nouvelle à la fiche existante.",
    "",
    ...recenses.map((c) => `${ligneCandidat(c)}\n  - fiche existante : \`donnees/textes/${c.deja_recense}.json\``),
    "",
    `## 5. Écartés (${par("ecarte").length})`,
    "",
    "Phrases du règlement ou du guide de la procédure prises pour des textes. À ne pas saisir.",
    "",
    ...par("ecarte").map((c) => `- ${c.titre} — ${c.raisons.join(" ; ")}`),
    "",
  ];
  const erreurs = Array.isArray(meta?.erreurs) ? (meta.erreurs as { url?: string; erreur?: string }[]) : [];
  if (erreurs.length) {
    sections.push("## Sources que l'extraction n'a pas pu lire", "");
    for (const e of erreurs) sections.push(`- <${e.url}> — ${(e.erreur ?? "").slice(0, 120)}`);
    sections.push("");
  }
  return sections.join("\n");
}

async function principal() {
  const args = process.argv.slice(2);
  const iSortie = args.indexOf("--sortie");
  const sortieArg = iSortie >= 0 ? args[iSortie + 1] : undefined;
  const fichier = args.filter((a, i) => !a.startsWith("--") && (iSortie < 0 || i !== iSortie + 1))[0];
  if (!fichier) throw new Error("Usage : npm run importer -- <fichier.json> [--sortie import/<nom>]");

  // Le fichier vient de l'extérieur : il est seulement lu comme du JSON, puis validé.
  const brut = JSON.parse(await readFile(fichier, "utf8"));
  const lu = fichierExtraction.safeParse(brut);
  if (!lu.success) throw new Error(`format non reconnu : ${lu.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);

  const { donnees } = await chargerDonnees(RACINE);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const candidats = regrouper(lu.data.lois, donnees.textes, aujourdhui);

  const nom = basename(fichier).replace(/\.json$/i, "");
  const sortie = sortieArg ?? join(RACINE, "import", nom);
  await mkdir(sortie, { recursive: true });
  await writeFile(join(sortie, "candidats.json"), `${JSON.stringify({ fichier: basename(fichier), importe_le: aujourdhui, candidats }, null, 2)}\n`);
  await writeFile(join(sortie, "RELECTURE.md"), rapport(candidats, basename(fichier), lu.data.meta, lu.data.lois.length));

  const compte = (cl: string) => candidats.filter((c) => c.classe === cl && !c.deja_recense).length;
  console.log(`${lu.data.lois.length} lignes → ${candidats.length} textes distincts`);
  console.log(`  candidats : ${compte("candidat")} · titres à corriger : ${compte("titre_a_corriger")} · déjà recensés : ${candidats.filter((c) => c.deja_recense).length} · écartés : ${compte("ecarte")}`);
  console.log(`File de relecture : ${join(sortie, "RELECTURE.md")}`);
}

principal().catch((e: Error) => {
  console.error(`✖ ${e.message}`);
  process.exit(1);
});
