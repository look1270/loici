/**
 * Catégories de l'accueil : comptages et appartenance, calculés dans le navigateur.
 * Fonctions pures : testées dans tests/categories.test.ts.
 *
 * Deux cartes ne viennent pas du référentiel donnees/referentiels/categories.json :
 *   - « Projets de loi en cours d'examen », déduite du statut (un texte y figure EN PLUS de sa catégorie) ;
 *   - « Autres textes », pour les textes qu'aucune catégorie ne décrit (categorie_id = null).
 */
import type { ResumeTexte } from "../../schemas/api";
import type { Categorie } from "../../schemas/referentiels";
import type { CodeStatut } from "../../schemas/statuts";

export const ID_EN_COURS = "projets-en-cours";
export const ID_AUTRES = "autres-textes";

/**
 * Statuts où le parcours d'une loi est terminé ou en attente de la seule promulgation.
 * Une adoption par UNE chambre ne termine pas le parcours : le texte reste « en cours d'examen »
 * tant qu'aucune source n'atteste l'adoption définitive ou la promulgation.
 */
const STATUTS_HORS_EXAMEN: CodeStatut[] = ["adopte_definitivement", "promulgue", "rejete", "retire", "declare_non_conforme"];

/** Vrai pour une loi dont le parcours parlementaire n'est pas attesté comme terminé. */
export const estEnCoursExamen = (t: Pick<ResumeTexte, "acte" | "statut">) =>
  t.acte === "loi" && t.statut !== null && !STATUTS_HORS_EXAMEN.includes(t.statut);

/** Catégorie affichée : celles du référentiel, plus les deux cartes calculées. */
export interface CategorieAffichee {
  id: string;
  libelle: string;
  explication: string;
  sous_categories: Categorie["sous_categories"];
  /** Carte calculée (en cours d'examen, autres textes) plutôt que rubrique du référentiel. */
  calculee: boolean;
}

const EN_COURS: CategorieAffichee = {
  id: ID_EN_COURS,
  libelle: "Projets de loi en cours d'examen",
  explication: "Textes dont aucune source n'atteste encore l'adoption définitive ou la promulgation.",
  sous_categories: [],
  calculee: true,
};

const AUTRES: CategorieAffichee = {
  id: ID_AUTRES,
  libelle: "Autres textes",
  explication: "Textes qui ne relèvent d'aucune des catégories ci-dessus.",
  sous_categories: [],
  calculee: true,
};

/** Toutes les catégories, dans l'ordre d'affichage : référentiel, puis « en cours », puis « autres ». */
export function categoriesAffichees(referentiel: Categorie[]): CategorieAffichee[] {
  return [...referentiel.map((c) => ({ ...c, calculee: false })), EN_COURS, AUTRES];
}

/** Retrouve une catégorie affichée par son id ; null si elle n'existe pas. */
export function trouverCategorie(referentiel: Categorie[], id: string): CategorieAffichee | null {
  return categoriesAffichees(referentiel).find((c) => c.id === id) ?? null;
}

/** Textes d'une catégorie (référentiel ou carte calculée). */
export function textesDeCategorie(textes: ResumeTexte[], id: string): ResumeTexte[] {
  if (id === ID_EN_COURS) return textes.filter(estEnCoursExamen);
  if (id === ID_AUTRES) return textes.filter((t) => t.categorie_id === null);
  return textes.filter((t) => t.categorie_id === id);
}

/** Cartes de l'accueil avec leur nombre de textes. « Autres textes » n'apparaît que s'il en contient. */
export function cartesAccueil(referentiel: Categorie[], textes: ResumeTexte[]) {
  return categoriesAffichees(referentiel)
    .map((c) => ({ ...c, nombre: textesDeCategorie(textes, c.id).length }))
    .filter((c) => c.id !== ID_AUTRES || c.nombre > 0);
}

/** Valeur du filtre de sous-catégorie pour « textes sans sous-catégorie ». */
export const SANS_SOUS_CATEGORIE = "sans";

/**
 * Sous-catégories d'une catégorie avec leur nombre de textes, dans l'ordre du référentiel.
 * Les sous-catégories vides restent affichées (« 0 ») : elles montrent ce qui manque.
 * Une entrée « Autres » regroupe les textes de la catégorie sans sous-catégorie, s'il y en a.
 */
export function sousCategoriesAvecNombre(categorie: CategorieAffichee, textes: ResumeTexte[]) {
  if (categorie.sous_categories.length === 0) return [];
  const duLot = textesDeCategorie(textes, categorie.id);
  const liste = categorie.sous_categories.map((s) => ({
    id: s.id,
    libelle: s.libelle,
    nombre: duLot.filter((t) => t.sous_categorie_id === s.id).length,
  }));
  const sans = duLot.filter((t) => t.sous_categorie_id === null).length;
  return sans > 0 ? [...liste, { id: SANS_SOUS_CATEGORIE, libelle: "Autres", nombre: sans }] : liste;
}

/** Filtre par sous-catégorie (« tous » = aucune restriction). */
export function filtrerSousCategorie(textes: ResumeTexte[], sous: string): ResumeTexte[] {
  if (sous === "" || sous === "tous") return textes;
  if (sous === SANS_SOUS_CATEGORIE) return textes.filter((t) => t.sous_categorie_id === null);
  return textes.filter((t) => t.sous_categorie_id === sous);
}
