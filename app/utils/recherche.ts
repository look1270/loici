/**
 * Recherche et filtres de la liste des textes, exécutés dans le navigateur (aucun serveur).
 * Fonctions pures : testées dans tests/recherche.test.ts.
 */
import type { ResumeTexte } from "../../schemas/api";

/** Valeur spéciale des listes déroulantes : « aucun filtre ». */
export const TOUS = "tous";

export interface Filtres {
  q: string;
  statut: string;
  type: string;
  annee: string;
  legislature: string;
  commission: string;
  theme: string;
  parti: string;
  parlementaire: string;
}

/** Une valeur proposée dans une liste déroulante de filtre. */
export interface OptionFiltre {
  label: string;
  value: string;
}

export const FILTRES_VIDES: Filtres = {
  q: "",
  statut: TOUS,
  type: TOUS,
  annee: TOUS,
  legislature: TOUS,
  commission: TOUS,
  theme: TOUS,
  parti: TOUS,
  parlementaire: TOUS,
};

/** Minuscules, sans accents ni ponctuation : « Économie » et « economie » se retrouvent. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Texte dans lequel on cherche : titre, numéros, ministre et ministère porteurs,
 * noms des parlementaires liés (fournis par l'appelant).
 */
export function texteRecherchable(t: ResumeTexte, nomsParlementaires: Map<string, string>): string {
  return normaliser(
    [
      t.titre_officiel,
      t.numero_depot ?? "",
      t.numero_loi ?? "",
      ...t.auteurs_gouvernement.flatMap((a) => [a.ministre ?? "", a.ministere ?? ""]),
      ...t.parlementaires.map((p) => nomsParlementaires.get(p.id) ?? ""),
    ].join(" "),
  );
}

/** Tous les mots de la requête doivent être présents (dans n'importe quel ordre). */
export function correspond(recherchable: string, requete: string): boolean {
  const mots = normaliser(requete).split(" ").filter(Boolean);
  return mots.every((mot) => recherchable.includes(mot));
}

/** Applique la recherche et les filtres, puis trie par activité la plus récente. */
export function filtrerTextes(
  textes: ResumeTexte[],
  filtres: Filtres,
  nomsParlementaires: Map<string, string> = new Map(),
): ResumeTexte[] {
  const ok = (valeur: string, attendu: string) => attendu === TOUS || valeur === attendu;
  const contient = (liste: string[], attendu: string) => attendu === TOUS || liste.includes(attendu);

  return textes
    .filter(
      (t) =>
        ok(t.statut, filtres.statut) &&
        ok(t.type, filtres.type) &&
        ok(String(t.annee ?? ""), filtres.annee) &&
        ok(t.legislature_id ?? "", filtres.legislature) &&
        contient(t.commission_ids, filtres.commission) &&
        contient(t.themes, filtres.theme) &&
        contient(t.parti_ids, filtres.parti) &&
        contient(
          t.parlementaires.map((p) => p.id),
          filtres.parlementaire,
        ) &&
        (filtres.q.trim() === "" || correspond(texteRecherchable(t, nomsParlementaires), filtres.q)),
    )
    .sort((a, b) => (b.date_derniere_etape ?? "").localeCompare(a.date_derniere_etape ?? ""));
}

/** Nombre de filtres actifs (hors recherche libre), pour l'indiquer sur le bouton « Filtres ». */
export function nombreFiltresActifs(filtres: Filtres): number {
  return (Object.keys(filtres) as (keyof Filtres)[]).filter((k) => k !== "q" && filtres[k] !== TOUS).length;
}

/** Filtres → paramètres d'URL (seulement les filtres actifs), pour partager une recherche. */
export function filtresVersRequete(filtres: Filtres): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filtres).filter(([cle, valeur]) => (cle === "q" ? valeur.trim() !== "" : valeur !== TOUS)),
  );
}

/** Paramètres d'URL → filtres (les valeurs absentes ou invalides redeviennent « tous »). */
export function requeteVersFiltres(requete: Record<string, unknown>): Filtres {
  const filtres = { ...FILTRES_VIDES };
  for (const cle of Object.keys(filtres) as (keyof Filtres)[]) {
    const valeur = requete[cle];
    if (typeof valeur === "string" && valeur !== "") filtres[cle] = valeur;
  }
  return filtres;
}
