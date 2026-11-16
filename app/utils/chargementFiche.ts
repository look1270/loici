/**
 * Chargement d'une fiche (texte ou parlementaire) : « introuvable » seulement si c'est vrai.
 *
 *   fiche lue                                  → prete
 *   404, identifiant absent de la liste publiée → introuvable
 *   404, identifiant présent dans la liste      → en_cours_de_publication : un cache n'est pas encore
 *                                                 à jour ; nouvel essai sans cache (3 fois, délai croissant)
 *   toute autre erreur (réseau, 500, liste illisible) → erreur_reseau
 *
 * Aucune dépendance à Vue ni à Nuxt : l'accès à l'API est passé en paramètre (`LecteurApi`).
 * Le site branche le vrai réseau (app/composables/useDonnees.ts, `useFiche`) ;
 * les tests (tests/chargement-fiche.test.ts) branchent une API en mémoire.
 */

export type GenreFiche = "textes" | "parlementaires";

export type EtatFiche = "chargement" | "prete" | "en_cours_de_publication" | "introuvable" | "erreur_reseau";

/** Réponse d'une lecture : les données, ou le code HTTP de l'échec (null si le réseau n'a pas répondu). */
export type Reponse = { ok: true; donnees: unknown } | { ok: false; statut: number | null };

/** Accès aux fichiers de l'API publiée, chemins relatifs à /api/<version>/. */
export interface LecteurApi {
  /** Lecture normale (le cache du navigateur peut servir). */
  lire(chemin: string): Promise<Reponse>;
  /** Lecture qui contourne tous les caches. */
  lireSansCache(chemin: string): Promise<Reponse>;
}

export interface DependancesChargement {
  lecteur: LecteurApi;
  /** Pause entre deux essais ; les tests passent une pause immédiate. */
  attendre: (ms: number) => Promise<void>;
  /** Prévenu des états intermédiaires (ex. en_cours_de_publication pendant les nouveaux essais). */
  surEtat?: (etat: EtatFiche) => void;
}

export interface ResultatChargement {
  etat: Exclude<EtatFiche, "chargement">;
  fiche: unknown;
}

export const ESSAIS = 3;
export const DELAI_ESSAI_MS = 2500;

/** Fichier de la fiche et fichier de la liste où son identifiant doit figurer. */
export function cheminsFiche(genre: GenreFiche, id: string) {
  return { fiche: `${genre}/${encodeURIComponent(id)}.json`, liste: `${genre}.json` };
}

/**
 * Charge une fiche et dit dans quel état l'afficher.
 * @param options.sansCache vrai pour « Réessayer » : la première lecture contourne aussi les caches.
 */
export async function chargerFiche(
  genre: GenreFiche,
  id: string,
  { lecteur, attendre, surEtat = () => {} }: DependancesChargement,
  options: { sansCache?: boolean } = {},
): Promise<ResultatChargement> {
  const chemins = cheminsFiche(genre, id);
  const premiere = await (options.sansCache ? lecteur.lireSansCache(chemins.fiche) : lecteur.lire(chemins.fiche));
  if (premiere.ok) return { etat: "prete", fiche: premiere.donnees };
  if (premiere.statut !== 404) return { etat: "erreur_reseau", fiche: null };

  // 404 : la liste publiée, relue sans cache, dit si la fiche existe.
  const liste = await lecteur.lireSansCache(chemins.liste);
  // Liste illisible : on ne sait rien, on n'affirme donc ni « introuvable » ni « en cours de publication ».
  if (!liste.ok || !Array.isArray(liste.donnees)) return { etat: "erreur_reseau", fiche: null };
  const recense = liste.donnees.some((x) => (x as { id?: unknown } | null)?.id === id);
  if (!recense) return { etat: "introuvable", fiche: null };

  surEtat("en_cours_de_publication");
  for (let essai = 1; essai <= ESSAIS; essai++) {
    await attendre(DELAI_ESSAI_MS * essai);
    const r = await lecteur.lireSansCache(chemins.fiche);
    if (r.ok) return { etat: "prete", fiche: r.donnees };
  }
  return { etat: "en_cours_de_publication", fiche: null };
}
