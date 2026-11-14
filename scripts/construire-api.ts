/**
 * Construit l'API JSON statique lue par le site à l'exécution.
 *
 *   donnees/  (fichiers relus et validés par pull request)
 *      │  1. validation Zod de chaque fichier (scripts/lib/donnees.ts)
 *      │  2. contrôles croisés entre fichiers (scripts/lib/controles.ts) — mêmes règles que la CI
 *      ▼
 *   public/api/v1/  (publié tel quel par Cloudflare Pages, licence ODbL)
 *      meta.json             date de génération, effectifs, licence
 *      textes.json           liste légère pour la recherche et les filtres
 *      textes/<id>.json      fiche complète, sources incluses
 *      parlementaires.json   parlementaires/<id>.json (avec sources)
 *      partis.json   referentiels.json
 *
 * Le site ne contient aucune donnée dans son code : il télécharge ces fichiers dans le navigateur.
 * Lancé automatiquement avant `nuxt dev` et `nuxt generate` (voir package.json).
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type MetaApi,
  type ResumeTexte,
  chambreDepot,
  commissionsSaisies,
  dateDepot,
  datePromulgation,
} from "../schemas";
import { controlesCroises } from "./lib/controles";
import { chargerDonnees, sourcesCitees, sourcesParlementaire } from "./lib/donnees";

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
  const { sources, textes, parlementaires, partis, referentiels } = donnees;
  const sourcesParId = new Map(sources.map((s) => [s.id, s]));

  // 3. Écriture (on repart d'un dossier vide pour ne jamais publier un fichier obsolète).
  await rm(SORTIE, { recursive: true, force: true });
  await mkdir(join(SORTIE, "textes"), { recursive: true });
  await mkdir(join(SORTIE, "parlementaires"), { recursive: true });

  const parlementairesParId = new Map(parlementaires.map((p) => [p.id, p]));

  const listeTextes = textes.map((t): ResumeTexte => {
    const citees = sourcesCitees(t).map((id) => sourcesParId.get(id)!);
    const datesConnues = t.etapes.map((e) => e.date).filter((d): d is string => d !== null);
    const liesParlementaires = t.acteurs.flatMap((a) =>
      a.acteur.genre === "parlementaire" ? [{ id: a.acteur.parlementaire_id, role: a.role }] : [],
    );
    // Parti = celui du mandat correspondant à la législature du texte, et seulement celui-là.
    const partisDuTexte = liesParlementaires.flatMap(({ id }) => {
      const mandat = parlementairesParId.get(id)?.mandats.find((m) => m.legislature_id === t.legislature_id);
      return t.legislature_id !== null && mandat?.parti_id ? [mandat.parti_id] : [];
    });
    return {
      id: t.id,
      titre_officiel: t.titre_officiel,
      numero_depot: t.numero_depot,
      numero_loi: t.numero_loi,
      type: t.type,
      nature: t.nature,
      statut: t.statut,
      legislature_id: t.legislature_id,
      annee: datesConnues.length > 0 ? Number(datesConnues[0]!.slice(0, 4)) : null,
      date_depot: dateDepot(t),
      chambre_depot: chambreDepot(t),
      date_promulgation: datePromulgation(t),
      date_derniere_etape: datesConnues.at(-1) ?? null,
      themes: t.themes,
      commission_ids: commissionsSaisies(t),
      auteurs_gouvernement: t.acteurs.flatMap((a) =>
        a.role === "auteur" && a.acteur.genre === "gouvernement"
          ? [{ ministre: a.acteur.ministre, ministere: a.acteur.ministere }]
          : [],
      ),
      parlementaires: liesParlementaires,
      parti_ids: [...new Set(partisDuTexte)],
      /** Badge « Source non officielle » : aucune source officielle parmi toutes celles citées. */
      source_officielle: citees.some((s) => s.type === "officielle"),
      mis_a_jour_le: t.mis_a_jour_le,
    };
  });

  await ecrire("textes.json", listeTextes);
  for (const t of textes) {
    const sourcesDuTexte = Object.fromEntries(sourcesCitees(t).map((id) => [id, sourcesParId.get(id)!]));
    await ecrire(`textes/${t.id}.json`, { ...t, sources: sourcesDuTexte });
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
