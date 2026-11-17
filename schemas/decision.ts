/**
 * Décision de justice de référence, rattachée aux textes qu'elle applique ou contrôle.
 *
 * Règles (brief « décisions de référence en pénal ») :
 *   - seulement des décisions publiées par la juridiction elle-même (Conseil constitutionnel, Cour de cassation) :
 *     jamais la presse, jamais une affaire pendante ;
 *   - parties anonymisées : le résumé ne cite aucun nom de partie (rôle seulement : « le requérant », « le prévenu ») ;
 *   - résumé neutre de 2 à 3 lignes, écrit à partir de la décision ; le lien mène à la décision publiée.
 * Le site ne stocke pas la décision : métadonnées + lien « Lire plus ».
 */
import { z } from "zod";
import { dateIso, identifiant, libelle, sourceIds } from "./communs";

export const juridiction = z.enum(["conseil_constitutionnel", "cour_de_cassation"]);

/** Sens de la décision, tel qu'il ressort du dispositif. */
export const sensDecision = z.enum(["conformite", "rejet", "irrecevabilite", "cassation", "sans_objet"]);

export const texteConcerne = z.strictObject({
  texte_id: identifiant,
  /** Articles en cause, recopiés de la décision. Ex. « article 604 ». */
  articles: z.array(libelle(3, 60)).min(1),
});

export const decision = z.strictObject({
  id: identifiant,
  juridiction,
  /** Formation qui a statué (ex. « Chambre pénale », « Assemblée plénière ») ; null si la décision ne la précise pas. */
  formation: libelle(3, 80).nullable(),
  /** Numéro tel qu'imprimé sur la décision. Ex. « CI-2025-001/DCC/11-02/CC/SG », « 028.Pe/24 ». */
  numero: libelle(2, 80),
  date: dateIso,
  sens: z.array(sensDecision).min(1),
  textes_concernes: z.array(texteConcerne).min(1),
  /** 2 à 3 lignes neutres, sans nom de partie. */
  resume: libelle(80, 480),
  /** Page du PDF où se lit la solution (lien « Lire plus » vers #page=N) ; null si inconnue. */
  page: z.number().int().min(1).nullable(),
  source_ids: sourceIds,
  mis_a_jour_le: dateIso,
});

export type Decision = z.infer<typeof decision>;
