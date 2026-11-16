/**
 * Accès aux données publiées, téléchargées DANS LE NAVIGATEUR à l'exécution.
 *
 * `server: false` : rien n'est figé dans le HTML généré. Chaque visite lit les fichiers
 * /api/v1/*.json du déploiement en cours, eux-mêmes construits depuis donnees/ après relecture humaine.
 * Le navigateur met ces fichiers en cache : une seconde visite ne retélécharge que ce qui a changé.
 */
import type { FicheParlementaire, FicheTexte, MetaApi, Referentiels, ResumeTexte } from "~~/schemas/api";
import { VERSION_API } from "~~/schemas/api";
import type { Parlementaire, Parti } from "~~/schemas";
import type { EtatFiche, GenreFiche, LecteurApi, Reponse } from "~/utils/chargementFiche";
import { chargerFiche } from "~/utils/chargementFiche";

const BASE = `api/${VERSION_API}`;

/** Lecture d'un fichier de l'API ; `cle` évite de télécharger deux fois le même fichier. */
function lireApi<T>(chemin: string) {
  const config = useRuntimeConfig();
  return useFetch<T>(`${BASE}/${chemin}`, {
    // Préfixe de déploiement (ex. « /loici/ » sur GitHub Pages, « / » sur Cloudflare Pages).
    baseURL: config.app.baseURL,
    // Version des données : un fichier par version, jamais de mélange entre deux mises en ligne.
    query: config.public.versionDonnees ? { v: config.public.versionDonnees } : undefined,
    key: `api:${chemin}`,
    server: false,
    lazy: true,
  });
}

/** Liste légère de tous les textes (recherche et filtres). */
export const useTextes = () => lireApi<ResumeTexte[]>("textes.json");
export const useParlementaires = () => lireApi<Parlementaire[]>("parlementaires.json");
export const usePartis = () => lireApi<Parti[]>("partis.json");
export const useReferentiels = () => lireApi<Referentiels>("referentiels.json");

/** Date de génération et effectifs : permet d'afficher « Données à jour au … ». */
export const useMetaApi = () => lireApi<MetaApi>("meta.json");

/* ------------------------------------------------------------------ Fiches */

/** Adaptateur réseau du chargement des fiches (l'adaptateur des tests est en mémoire). */
function lecteurReseau(): LecteurApi {
  const config = useRuntimeConfig();
  const lire = (chemin: string, sansCache: boolean): Promise<Reponse> =>
    $fetch(`${BASE}/${chemin}`, {
      baseURL: config.app.baseURL,
      ...(sansCache
        ? // Juste après une mise en ligne, un cache peut encore répondre « absent » : on passe outre.
          { query: { frais: Date.now() }, cache: "no-store" as const }
        : { query: config.public.versionDonnees ? { v: config.public.versionDonnees } : undefined }),
    }).then(
      (donnees): Reponse => ({ ok: true, donnees }),
      (e: { response?: { status?: number }; statusCode?: number }): Reponse => ({
        ok: false,
        statut: e?.response?.status ?? e?.statusCode ?? null,
      }),
    );
  return { lire: (c) => lire(c, false), lireSansCache: (c) => lire(c, true) };
}

interface FicheSelonGenre {
  textes: FicheTexte;
  parlementaires: FicheParlementaire;
}

/**
 * Fiche complète d'un texte ou d'un parlementaire, avec ses sources, et l'état à afficher.
 * « Introuvable » n'est affiché qu'après vérification (voir app/utils/chargementFiche.ts).
 * `reessayer` relit toujours sans cache.
 */
export function useFiche<G extends GenreFiche>(genre: G, id: string) {
  const fiche = shallowRef<FicheSelonGenre[G] | null>(null);
  const etat = ref<EtatFiche>("chargement");
  const lecteur = lecteurReseau();

  async function charger(sansCache: boolean) {
    etat.value = "chargement";
    const resultat = await chargerFiche(
      genre,
      id,
      { lecteur, attendre: (ms) => new Promise((r) => setTimeout(r, ms)), surEtat: (e) => (etat.value = e) },
      { sansCache },
    );
    fiche.value = resultat.fiche as FicheSelonGenre[G] | null;
    etat.value = resultat.etat;
  }

  // Comme les listes : rien n'est lu pendant la génération du site, seulement dans le navigateur.
  onMounted(() => charger(false));

  return { fiche, etat, reessayer: () => charger(true) };
}
