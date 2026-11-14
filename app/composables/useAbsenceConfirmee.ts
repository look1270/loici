/**
 * « Introuvable » seulement si c'est vrai.
 *
 * Quand une fiche répond 404, on relit la liste publiée sans cache :
 *   - l'identifiant n'y est pas → la fiche n'existe pas : « introuvable » ;
 *   - il y est → la fiche vient d'être publiée et un cache n'est pas encore à jour : on réessaie
 *     automatiquement (3 fois, à quelques secondes d'intervalle), puis on propose « Réessayer ».
 */
import type { Ref } from "vue";

type Etat = "attente" | "introuvable" | "en_cours_de_publication";

export function useAbsenceConfirmee<T>(options: {
  id: string;
  /** Fichier de la fiche, ex. `textes/<id>.json`. */
  cheminFiche: string;
  /** Fichier de la liste, ex. `textes.json`. */
  cheminListe: string;
  donnees: Ref<T | null | undefined>;
  erreur: Ref<{ statusCode?: number } | null | undefined>;
}) {
  const etat = ref<Etat>("attente");
  const essai = ref(0);
  const ESSAIS = 3;

  async function verifier() {
    try {
      const liste = await relireApiSansCache<{ id: string }[]>(options.cheminListe);
      if (!liste.some((x) => x.id === options.id)) {
        etat.value = "introuvable";
        return;
      }
    } catch {
      // La liste elle-même ne répond pas : on ne peut pas affirmer que la fiche n'existe pas.
    }
    etat.value = "en_cours_de_publication";
    while (essai.value < ESSAIS) {
      essai.value += 1;
      await new Promise((r) => setTimeout(r, 2500 * essai.value));
      try {
        options.donnees.value = await relireApiSansCache<T>(options.cheminFiche);
        options.erreur.value = null;
        return;
      } catch {
        // nouvel essai
      }
    }
  }

  async function reessayer() {
    essai.value = 0;
    await verifier();
  }

  watch(
    () => options.erreur.value?.statusCode,
    (code) => {
      if (code === 404 && import.meta.client) verifier();
    },
    { immediate: true },
  );

  return { etat, reessayer };
}
