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

/**
 * Relit un fichier de l'API sans aucun cache (ni navigateur ni intermédiaire).
 * Sert à confirmer une absence avant d'afficher « introuvable » : juste après une mise en ligne,
 * un serveur de cache peut encore répondre « absent » pour un fichier qui vient d'être publié.
 */
export async function relireApiSansCache<T>(chemin: string): Promise<T> {
  return $fetch<T>(`${BASE}/${chemin}`, {
    baseURL: useRuntimeConfig().app.baseURL,
    query: { frais: Date.now() },
    cache: "no-store",
  });
}

/** Liste légère de tous les textes (recherche et filtres). */
export const useTextes = () => lireApi<ResumeTexte[]>("textes.json");

/** Fiche complète d'un texte, avec ses sources. */
export const useFicheTexte = (id: string) => lireApi<FicheTexte>(`textes/${encodeURIComponent(id)}.json`);

export const useParlementaires = () => lireApi<Parlementaire[]>("parlementaires.json");
/** Fiche complète d'un parlementaire, avec ses sources. */
export const useFicheParlementaire = (id: string) =>
  lireApi<FicheParlementaire>(`parlementaires/${encodeURIComponent(id)}.json`);

export const usePartis = () => lireApi<Parti[]>("partis.json");
export const useReferentiels = () => lireApi<Referentiels>("referentiels.json");

/** Date de génération et effectifs : permet d'afficher « Données à jour au … ». */
export const useMetaApi = () => lireApi<MetaApi>("meta.json");
