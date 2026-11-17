/**
 * Migration du 17 novembre 2026 : ajout des champs « acte », « catégorie », « vigueur », « Journal officiel »…
 *
 * Exécutée une seule fois (`npx tsx scripts/migrations/2026-11-17-categories.ts`), conservée pour la traçabilité.
 *   - Tous les textes existants sont des lois (projets ou ratifications votés au Parlement) : acte = « loi ».
 *   - Tout fait nouveau reste à null (« Non renseigné ») : vigueur, référence JO, titre de loi, explication.
 *     Rien n'est déduit d'un titre ni d'une source déjà citée.
 *   - Le classement par catégorie est éditorial (comme les thèmes) : fait texte par texte, à la main, ci-dessous.
 *     Un texte absent de la table reste « Autres textes » (categorie_id = null).
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DOSSIER = join(import.meta.dirname, "..", "..", "donnees", "textes");

/** id du texte → [catégorie, sous-catégorie]. */
const CLASSEMENT: Record<string, [string, string | null]> = {
  // Droit pénal
  "pl-2024-modifiant-la-loi-n2019-574-du-26-juin-2019-portant-code-pena": ["droit-penal", "code-penal"],
  "pl-2022-modifiant-la-loi-n2018-975-du-27-decembre-2018-portant-code": ["droit-penal", "code-procedure-penale"],
  "pl-2023-modifiant-la-loi-n2018-975-du-27-decembre-2018-portant-code": ["droit-penal", "code-procedure-penale"],
  "pl-2024-modifiant-la-loi-n2018-975-du-27-decembre-2018-portant-code": ["droit-penal", "code-procedure-penale"],
  "pl-2022-creation-competence-organisation-et-fonctionnement-du-pole-p": ["droit-penal", "code-procedure-penale"],
  "pl-2023-ratification-ordonnance-2023-23": ["droit-penal", "code-procedure-penale"],
  "pl-2022-lutte-contre-le-trafic-et-l-usage-illicites-des-stupefiants": ["droit-penal", "lois-penales-speciales"],
  "pl-2024-modifiant-la-loi-n2015-493-du-07-juillet-2015-portant-repres": ["droit-penal", "lois-penales-speciales"],
  "pl-2024-ratification-ordonnance-2023-875": ["droit-penal", "lois-penales-speciales"],
  "pl-2024-entraide-judiciaire-en-matiere-penale": ["droit-penal", "cooperation-penale"],
  "pl-2024-extradition": ["droit-penal", "cooperation-penale"],
  "pl-2022-ratification-protocole-sur-la-lutte-contre-la-corruption-de": ["droit-penal", "cooperation-penale"],
  "pl-2022-ratification-convention-du-conseil-de-l-europe-sur-la-contre": ["droit-penal", "cooperation-penale"],
  "pl-2023-ratification-convention-internationale-pour-la-protection-de": ["droit-penal", "cooperation-penale"],

  // Personnes et famille
  "pl-2020-nom": ["personnes-famille", "nom"],
  "pl-2020-domicile": ["personnes-famille", "domicile"],
  "pl-2020-liberalites": ["personnes-famille", "liberalites"],
  "pl-2022-absence-et-a-la-disparition": ["personnes-famille", "absence-disparition"],
  "pl-2022-divorce-et-a-la-separation-de-corps": ["personnes-famille", "divorce"],
  "pl-2024-modifiant-la-loi-n61-415-du-14-decembre-1961-portant-code-de": ["personnes-famille", "nationalite"],

  // Droit civil et procédure civile
  "pl-2020-ratification-ordonnance-2020-355": ["droit-civil", null],
  "pl-2020-ratification-ordonnance-2020-381": ["droit-civil", null],

  // Droit des affaires et OHADA
  "pl-2020-ratification-ordonnance-2019-1088": ["affaires-ohada", null],
  "pl-2020-ratification-ordonnance-2020-383": ["affaires-ohada", null],
  "pl-2020-ratification-ordonnance-2020-384": ["affaires-ohada", null],
  "pl-2020-ratification-ordonnance-2020-385": ["affaires-ohada", null],
  "pl-2020-societes-d-etat": ["affaires-ohada", null],
  "pl-2020-societes-participation-financiere-publique": ["affaires-ohada", null],
  "pl-2022-code-de-l-aviation-civile": ["affaires-ohada", null],
  "pl-2022-ratification-convention-internationale-de-1989-sur-l-assista": ["affaires-ohada", null],
  "pl-2024-creation-du-registre-des-beneficiaires-effectifs-des-personn": ["affaires-ohada", null],
  "pl-2024-professions-d-ingenieurs-et-d-ingenieurs-conseils-du-secteur": ["affaires-ohada", null],
  "pl-2024-ratification-accord-portant-creation-de-la-banque-europeenne": ["affaires-ohada", null],
  "pl-2024-ratification-ordonnance-2023-718": ["affaires-ohada", null],

  // Droit foncier et immobilier
  "pl-2020-code-urbanisme-domaine-foncier-urbain": ["foncier-immobilier", null],
  "pl-2024-modifiant-la-loi-n2020-624-du-14-aout-2020-instituant-code-d": ["foncier-immobilier", null],
  "pl-2020-ratification-ordonnance-2020-386": ["foncier-immobilier", null],

  // Finances publiques, fiscalité et douane
  "plf-2022-finances-portant-budget-de-l-etat-pour-l-annee-2023": ["finances-fiscal-douanier", null],
  "plf-2022-finances-rectificative-portant-budget-de-l-etat-pour-l-annee": ["finances-fiscal-douanier", null],
  "plf-2023-finances-portant-budget-de-l-etat-pour-l-annee-2024": ["finances-fiscal-douanier", null],
  "plf-2023-finances-rectificative-de-l-annee-2023": ["finances-fiscal-douanier", null],
  "plf-2024-finances-portant-budget-de-l-etat-pour-l-annee-2025": ["finances-fiscal-douanier", null],
  "plf-2027-budget-etat": ["finances-fiscal-douanier", null],
  "pl-2022-reglement-du-budget-de-l-etat-pour-l-annee-2021": ["finances-fiscal-douanier", null],
  "pl-2023-reglement-du-budget-de-l-etat-pour-l-annee-2022": ["finances-fiscal-douanier", null],
  "pl-2024-reglement-du-budget-de-l-etat-pour-l-annee-2023": ["finances-fiscal-douanier", null],
  "pl-2022-code-des-douanes": ["finances-fiscal-douanier", null],
  "pl-2023-livre-de-procedures-des-recettes-non-fiscales": ["finances-fiscal-douanier", null],
  "pl-2024-politique-nationale-d-endettement-et-de-gestion-de-la-dette": ["finances-fiscal-douanier", null],
  "pl-2022-ratification-convention-multilaterale-pour-la-mise-en-uvre-d": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2019-80": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2019-754": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2019-1047": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2019-1087": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2020-09": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2020-273": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2020-307": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2020-357": ["finances-fiscal-douanier", null],
  "pl-2020-ratification-ordonnance-2020-358": ["finances-fiscal-douanier", null],
  "pl-2022-ratification-ordonnance-2021-433": ["finances-fiscal-douanier", null],
  "pl-2022-ratification-ordonnance-2021-672": ["finances-fiscal-douanier", null],
  "pl-2022-ratification-ordonnance-2021-858": ["finances-fiscal-douanier", null],
  "pl-2022-ratification-ordonnance-2022-300": ["finances-fiscal-douanier", null],
  "pl-2023-ratification-ordonnance-2022-908": ["finances-fiscal-douanier", null],
  "pl-2024-ratification-ordonnance-2023-719": ["finances-fiscal-douanier", null],

  // Droit administratif et collectivités
  "pl-2020-etablissements-publics-nationaux": ["administratif-collectivites", null],
  "pl-2020-regime-financier-collectivites-territoriales-districts": ["administratif-collectivites", null],
  "pl-2020-systeme-statistique-national": ["administratif-collectivites", null],
  "pl-2020-ratification-ordonnance-2019-679": ["administratif-collectivites", null],
  "pl-2020-ratification-ordonnance-2020-440": ["administratif-collectivites", null],
  "pl-2022-evaluation-des-politiques-publiques": ["administratif-collectivites", null],
  "pl-2022-ratification-convention-de-l-union-africaine-sur-la-cooperat": ["administratif-collectivites", null],
  "pl-2022-ratification-ordonnance-2022-584": ["administratif-collectivites", null],
  "pl-2023-statut-du-corps-diplomatique": ["administratif-collectivites", null],
  "pl-2023-statut-general-de-la-fonction-publique": ["administratif-collectivites", null],
  "pl-2026-plan-national-developpement-2026-2030": ["administratif-collectivites", null],

  // Droit constitutionnel et électoral
  "loi-2019-870-representation-femme-assemblees-elues": ["constitutionnel-electoral", null],
  "pl-2020-ratification-ordonnance-recomposition-cei": ["constitutionnel-electoral", null],
  "pl-2020-ratification-ordonnance-revision-code-electoral": ["constitutionnel-electoral", null],
  "pl-2022-modification-de-la-loi-n2001-634-du-9-octobre-2001-portant-c": ["constitutionnel-electoral", null],
  "pl-2024-ratification-ordonnance-2023-672": ["constitutionnel-electoral", null],
  "pl-2022-ratification-ordonnance-2021-755": ["constitutionnel-electoral", null],
  "plo-2020-chambre-nationale-rois-chefs-traditionnels": ["constitutionnel-electoral", null],
  "plo-2020-statut-des-parlementaires": ["constitutionnel-electoral", null],
  "plo-2022-determinant-l-organisation-et-le-fonctionnement-du-conseil-c": ["constitutionnel-electoral", null],
  "plo-2022-fixant-les-attributions-l-organisation-et-le-fonctionnement": ["constitutionnel-electoral", null],

  // Justice et organisation judiciaire
  "plo-2020-conseil-d-etat": ["justice-organisation-judiciaire", null],
  "plo-2020-cour-de-cassation": ["justice-organisation-judiciaire", null],
  "plo-2020-parquet-general-cour-de-cassation-conseil-d-etat": ["justice-organisation-judiciaire", null],
  "plo-2020-tribunal-des-conflits": ["justice-organisation-judiciaire", null],
  "plo-2022-determinant-la-composition-l-organisation-et-le-fonctionneme": ["justice-organisation-judiciaire", null],
  "pl-2022-statut-de-la-magistrature": ["justice-organisation-judiciaire", null],

  // Numérique, médias et données personnelles
  "pl-2022-modifiant-la-loi-n-2017-867-du-27-decembre-2017-portant-regi": ["numerique-donnees", null],
  "pl-2022-modifiant-la-loi-n-2017-868-du-27-decembre-2017-portant-regi": ["numerique-donnees", null],
  "pl-2023-promotion-des-startups-numeriques": ["numerique-donnees", null],
  "pl-2024-communications-electroniques": ["numerique-donnees", null],
  "pl-2022-ratification-ordonnance-2021-432": ["numerique-donnees", null],

  // Environnement, mines, énergie et agriculture
  "pl-2020-code-sante-publique-veterinaire": ["environnement-mines-agriculture", null],
  "pl-2020-ratification-ordonnance-2018-144": ["environnement-mines-agriculture", null],
  "pl-2020-ratification-ordonnance-2018-437": ["environnement-mines-agriculture", null],
  "pl-2020-ratification-ordonnance-2018-756": ["environnement-mines-agriculture", null],
  "pl-2022-ratification-ordonnance-2020-602": ["environnement-mines-agriculture", null],
  "pl-2022-contenu-local-dans-les-activites-petrolieres-et-gazieres": ["environnement-mines-agriculture", null],
  "pl-2022-ratification-protocole-a-p4-1-03-de-la-communaute-economique": ["environnement-mines-agriculture", null],
  "pl-2023-code-de-l-eau": ["environnement-mines-agriculture", null],
  "pl-2023-code-de-l-environnement": ["environnement-mines-agriculture", null],
  "pl-2024-commerce-international-des-especes-de-faune-et-de-flore-sauv": ["environnement-mines-agriculture", null],
  "pl-2024-gestion-de-la-faune": ["environnement-mines-agriculture", null],
  "pl-2024-protection-de-l-elephant-en-cote-d-ivoire": ["environnement-mines-agriculture", null],
  "pl-2026-amelioration-genetique-animale": ["environnement-mines-agriculture", null],

  // Santé, éducation et jeunesse
  "pl-2020-ratification-ordonnance-2020-382": ["sante-education", null],
  "pl-2020-ratification-ordonnance-2018-593": ["sante-education", null],
  "pl-2022-creation-attributions-organisation-et-fonctionnement-de-l-or": ["sante-education", null],
  "pl-2022-orientation-de-l-enseignement-et-la-formation-techniques-et": ["sante-education", null],
  "pl-2022-ratification-ordonnance-2021-189": ["sante-education", null],
  "pl-2023-code-de-l-hygiene-et-de-la-salubrite": ["sante-education", null],
  "pl-2023-orientation-relatif-a-la-jeunesse": ["sante-education", null],
  "pl-2024-code-de-deontologie-et-exercice-de-la-profession-de-sage-fem": ["sante-education", null],
  "pl-2024-code-de-deontologie-et-exercice-de-la-profession-infirmiere": ["sante-education", null],
  "pl-2024-exercice-de-la-medecine": ["sante-education", null],
  "pl-2024-organisation-et-fonctionnement-de-l-ordre-national-des-chiru": ["sante-education", null],
};

/** Ordre des clés dans chaque fichier : celui du schéma (schemas/texte.ts), pour des diffs lisibles. */
const ORDRE = [
  "id", "acte", "titre_officiel", "numero_depot", "type", "nature", "statut", "legislature_id",
  "resume", "explication", "themes", "categorie_id", "sous_categorie_id", "numero_loi", "titre_loi",
  "numero_acte", "date_signature", "reference_jo", "vigueur", "textes_lies",
  "document_principal_source_id", "acteurs", "etapes", "revisions", "source_ids", "mis_a_jour_le",
];

const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".json"));
const utilises = new Set<string>();
for (const f of fichiers) {
  const chemin = join(DOSSIER, f);
  const t = JSON.parse(readFileSync(chemin, "utf8"));
  if ("acte" in t) continue; // déjà migré
  const [categorie, sous] = CLASSEMENT[t.id] ?? [null, null];
  if (CLASSEMENT[t.id]) utilises.add(t.id);
  const complet: Record<string, unknown> = {
    ...t,
    acte: "loi",
    explication: null,
    categorie_id: categorie,
    sous_categorie_id: sous,
    titre_loi: null,
    numero_acte: null,
    date_signature: null,
    reference_jo: null,
    vigueur: null,
    textes_lies: [],
  };
  const inconnues = Object.keys(complet).filter((k) => !ORDRE.includes(k));
  if (inconnues.length) throw new Error(`${f} : champs non prévus ${inconnues.join(", ")}`);
  const ordonne = Object.fromEntries(ORDRE.map((k) => [k, complet[k]]));
  writeFileSync(chemin, `${JSON.stringify(ordonne, null, 2)}\n`);
}

const absents = Object.keys(CLASSEMENT).filter((id) => !fichiers.includes(`${id}.json`));
if (absents.length) throw new Error(`Classement de textes inexistants : ${absents.join(", ")}`);
console.log(`${fichiers.length} fichier(s) examiné(s), ${utilises.size} classé(s).`);
