/**
 * Recherche en ligne de commande dans donnees/ : mêmes règles que la recherche du site.
 *
 *   npm run chercher                         liste tous les textes
 *   npm run chercher -- budget               par mot du titre
 *   npm run chercher -- 2019                 par année (début, dépôt, promulgation, dernière étape)
 *   npm run chercher -- Coulibaly            par personnalité (ministre porteur, parlementaire)
 *   npm run chercher -- --personnalites      liste les personnalités et leur nombre de textes portés
 *   npm run chercher -- --json budget        sortie JSON (pour d'autres outils)
 */
import { join } from "node:path";
import { FILTRES_VIDES, anneesDuTexte, filtrerTextes } from "../app/utils/recherche";
import { listerPersonnalites, personnalitesCorrespondantes } from "../app/utils/personnalites";
import { STATUTS_INFOS, TYPES_TEXTE } from "../app/utils/libelles";
import { chargerDonnees } from "./lib/donnees";
import { resumerTextes } from "./lib/resume";

const RACINE = process.env.LOICI_RACINE ?? join(import.meta.dirname, "..");

async function principal() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const modePersonnalites = args.includes("--personnalites");
  const requete = args.filter((a) => !a.startsWith("--")).join(" ");

  const { donnees } = await chargerDonnees(RACINE);
  const textes = resumerTextes(donnees);
  const noms = new Map(donnees.parlementaires.map((p) => [p.id, [p.prenoms, p.nom].filter(Boolean).join(" ")]));
  const personnalites = listerPersonnalites(textes, noms);

  if (modePersonnalites) {
    const liste = requete ? personnalitesCorrespondantes(personnalites, requete) : personnalites;
    if (json) return console.log(JSON.stringify(liste, null, 2));
    console.log(`${liste.length} personnalité(s)\n`);
    for (const p of liste) {
      const qualite = p.genre === "gouvernement" ? `Ministre${p.ministeres.length ? ` — ${p.ministeres.join(" ; ")}` : ""}` : "Parlementaire";
      console.log(`${String(p.nb_portes).padStart(3)} texte(s) porté(s)  ${p.nom}  (${qualite})`);
      for (const t of p.textes) console.log(`        · [${t.role}] ${t.titre} (${t.annee ?? "année non renseignée"})`);
    }
    return;
  }

  const resultats = filtrerTextes(textes, { ...FILTRES_VIDES, q: requete }, noms);
  if (json) return console.log(JSON.stringify(resultats, null, 2));

  console.log(`${resultats.length} texte(s) sur ${textes.length}${requete ? ` pour « ${requete} »` : ""}\n`);
  for (const t of resultats) {
    const statut = STATUTS_INFOS[t.statut]?.libelle ?? t.statut;
    const auteurs = [
      ...t.auteurs_gouvernement.map((a) => a.ministre ?? a.ministere ?? "Gouvernement"),
      ...t.parlementaires.map((p) => `${noms.get(p.id) ?? p.id} (${p.role})`),
    ];
    console.log(`• ${t.titre_officiel}`);
    console.log(`  ${TYPES_TEXTE[t.type]?.libelle ?? t.type} · ${statut} · ${anneesDuTexte(t).join(", ") || "année non renseignée"}`);
    if (auteurs.length) console.log(`  Porté par : ${auteurs.join(", ")}`);
    console.log(`  donnees/textes/${t.id}.json\n`);
  }
  const proches = requete ? personnalitesCorrespondantes(personnalites, requete) : [];
  if (proches.length) console.log(`Personnalités correspondantes : ${proches.map((p) => `${p.nom} (${p.textes.length})`).join(", ")}`);
}

principal().catch((erreur: Error) => {
  console.error(`✖ ${erreur.message}`);
  process.exit(1);
});
