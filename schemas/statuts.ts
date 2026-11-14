/**
 * Statuts du cahier des charges, sans dépendance à Zod :
 * ce fichier peut être importé par le site sans alourdir les pages.
 */

/** Parcours normal, dans l'ordre. */
export const STATUTS_PARCOURS = [
  "depose",
  "en_commission",
  "adopte_en_commission",
  "adopte_en_pleniere",
  "au_senat",
  "adopte_definitivement",
  "promulgue",
] as const;

/** Sorties possibles du parcours. */
export const STATUTS_SORTIE = ["rejete", "retire", "declare_non_conforme"] as const;

export const STATUTS = [...STATUTS_PARCOURS, ...STATUTS_SORTIE] as const;
export type CodeStatut = (typeof STATUTS)[number];

/** Rôles d'un acteur vis-à-vis d'un texte. */
export const ROLES_ACTEUR = ["auteur", "rapporteur", "cosignataire"] as const;
export type RoleActeur = (typeof ROLES_ACTEUR)[number];
