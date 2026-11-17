/**
 * Construit l'API JSON statique lue par le site à l'exécution.
 *
 *   donnees/  (fichiers relus et validés par pull request)
 *      │  1. validation Zod de chaque fichier (scripts/lib/donnees.ts)
 *      │  2. contrôles croisés entre fichiers (scripts/lib/controles.ts) — mêmes règles que la CI
 *      ▼
 *   public/api/v1/  (publié tel quel par GitHub Pages ou Cloudflare Pages, licence ODbL)
 *      meta.json             date de génération, effectifs, licence
 *      textes.json           liste légère pour la recherche et les filtres
 *      textes/<id>.json      fiche complète, décisions de référence et sources incluses
 *      parlementaires.json   parlementaires/<id>.json (avec sources)
 *      partis.json   referentiels.json
 *
 * Le site ne contient aucune donnée dans son code : il télécharge ces fichiers dans le navigateur.
 * Lancé automatiquement avant `nuxt dev` et `nuxt generate` (voir package.json).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MetaApi } from "../schemas";
import { controlesCroises } from "./lib/controles";
import { chargerDonnees, sourcesCitees, sourcesParlementaire } from "./lib/donnees";
import { resumerTextes } from "./lib/resume";

const RACINE = join(import.meta.dirname, "..");
/** Modifiables par variable d'environnement (utile pour tester sur des données factices). */
const RACINE_DONNEES = process.env.LOICI_RACINE ?? RACINE;
const SORTIE = process.env.LOICI_SORTIE ?? join(RACINE, "public", "api", "v1");

async function ecrire(chemin: string, contenu: unknown) {
  await writeFile(join(SORTIE, chemin), JSON.stringify(contenu));
}

async function principal() {
  // 1 et 2. Lecture, validation et contrôles croisés : exactement les mêmes règles que la CI.
  const { donnees, problemes: problemesFichiers } = await chargerDonnees(RACINE_DONNEES);
  const erreurs = [...problemesFichiers, ...controlesCroises(donnees, new Date().toISOString().slice(0, 10))].filter(
    (p) => p.niveau === "erreur",
  );
  if (erreurs.length) {
    const detail = erreurs.map((p) => `  - ${p.fichier}${p.champ ? ` › ${p.champ}` : ""} : ${p.message}`).join("\n");
    throw new Error(`${erreurs.length} erreur(s) dans donnees/ — lancez « npm run valider » pour le détail :\n${detail}`);
  }
  const { sources, textes, parlementaires, partis, referentiels, decisions } = donnees;
  const sourcesParId = new Map(sources.map((s) => [s.id, s]));

  // 3. Écriture (on repart d'un dossier vide pour ne jamais publier un fichier obsolète).
  await rm(SORTIE, { recursive: true, force: true });
  await mkdir(join(SORTIE, "textes"), { recursive: true });
  await mkdir(join(SORTIE, "parlementaires"), { recursive: true });

  const listeTextes = resumerTextes(donnees);

  await ecrire("textes.json", listeTextes);
  for (const t of textes) {
    const decisionsDuTexte = decisions
      .filter((dec) => dec.textes_concernes.some((c) => c.texte_id === t.id))
      .sort((a, b) => b.date.localeCompare(a.date));
    const ids = [...new Set([...sourcesCitees(t), ...decisionsDuTexte.flatMap((dec) => dec.source_ids)])];
    const sourcesDuTexte = Object.fromEntries(ids.map((id) => [id, sourcesParId.get(id)!]));
    await ecrire(`textes/${t.id}.json`, { ...t, decisions: decisionsDuTexte, sources: sourcesDuTexte });
  }
  await ecrire("parlementaires.json", parlementaires);
  for (const p of parlementaires) {
    const ids = sourcesParlementaire(p);
    await ecrire(`parlementaires/${p.id}.json`, { ...p, sources: Object.fromEntries(ids.map((id) => [id, sourcesParId.get(id)!])) });
  }
  await ecrire("partis.json", partis);
  await ecrire("referentiels.json", referentiels);
  const meta: MetaApi = {
    genere_le: new Date().toISOString(),
    licence: "ODbL-1.0",
    effectifs: { textes: textes.length, parlementaires: parlementaires.length, partis: partis.length, sources: sources.length },
  };
  await ecrire("meta.json", meta);

  console.log(`API générée : ${textes.length} texte(s), ${parlementaires.length} parlementaire(s), ${sources.length} source(s).`);
}

principal().catch((erreur: Error) => {
  console.error(`\n✖ ${erreur.message}\n`);
  process.exit(1);
});
