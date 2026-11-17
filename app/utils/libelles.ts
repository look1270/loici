/**
 * Libellés affichés à l'écran. Le JSON garde des codes stables ; le site affiche ces textes.
 * Les icônes sont écrites en toutes lettres pour être intégrées au paquet du site.
 *
 * Neutralité : les couleurs indiquent l'état d'avancement du texte, jamais une appréciation.
 */
import type { CodeStatut, RoleActeur } from "../../schemas/statuts";
import { STATUTS_PARCOURS } from "../../schemas/statuts";

type CouleurUi = "primary" | "info" | "success" | "warning" | "error" | "neutral";

export interface InfosStatut {
  libelle: string;
  /** Une phrase, compréhensible en 5 secondes. */
  explication: string;
  couleur: CouleurUi;
  icone: string;
}

export const STATUTS_INFOS: Record<CodeStatut, InfosStatut> = {
  depose: {
    libelle: "Déposé",
    explication: "Le texte a été déposé au Parlement. Son examen n'a pas encore commencé.",
    couleur: "info",
    icone: "i-lucide-inbox",
  },
  en_commission: {
    libelle: "En commission",
    explication: "Une commission parlementaire examine le texte.",
    couleur: "info",
    icone: "i-lucide-users",
  },
  adopte_en_commission: {
    libelle: "Adopté en commission",
    explication: "La commission a adopté le texte. Il doit encore être voté en séance plénière.",
    couleur: "info",
    icone: "i-lucide-check",
  },
  adopte_en_pleniere: {
    libelle: "Adopté en plénière",
    explication: "Les députés ont adopté le texte en séance plénière.",
    couleur: "info",
    icone: "i-lucide-check-check",
  },
  au_senat: {
    libelle: "Au Sénat",
    explication: "Le texte est examiné par le Sénat.",
    couleur: "info",
    icone: "i-lucide-landmark",
  },
  adopte_definitivement: {
    libelle: "Adoptée",
    explication: "Le Parlement a adopté le texte. Il attend sa promulgation.",
    couleur: "success",
    icone: "i-lucide-badge-check",
  },
  promulgue: {
    libelle: "Promulguée",
    explication: "Le Président de la République a promulgué la loi.",
    couleur: "success",
    icone: "i-lucide-scroll-text",
  },
  rejete: {
    libelle: "Rejeté",
    explication: "Le texte a été rejeté.",
    couleur: "error",
    icone: "i-lucide-circle-x",
  },
  retire: {
    libelle: "Retiré",
    explication: "Le texte a été retiré par son auteur.",
    couleur: "neutral",
    icone: "i-lucide-undo-2",
  },
  declare_non_conforme: {
    libelle: "Déclaré non conforme",
    explication: "Le Conseil constitutionnel a déclaré le texte non conforme à la Constitution.",
    couleur: "warning",
    icone: "i-lucide-scale",
  },
};

/** Position dans le parcours normal (1 à 7), ou null pour une sortie (rejeté, retiré…). */
export function positionParcours(statut: CodeStatut): number | null {
  const index = (STATUTS_PARCOURS as readonly string[]).indexOf(statut);
  return index === -1 ? null : index + 1;
}

export const TYPES_TEXTE: Record<string, { libelle: string; explication: string }> = {
  projet_de_loi: { libelle: "Projet de loi", explication: "Texte proposé par le Gouvernement." },
  proposition_de_loi: { libelle: "Proposition de loi", explication: "Texte proposé par un ou plusieurs parlementaires." },
  projet_de_loi_ratification_ordonnance: {
    libelle: "Ratification d'ordonnance",
    explication: "Projet de loi qui donne une valeur législative à une ordonnance.",
  },
};

/** Forme de l'acte (filtre « Type » des catégories). */
export const ACTES: Record<string, { libelle: string; pluriel: string }> = {
  loi: { libelle: "Loi", pluriel: "Lois" },
  ordonnance: { libelle: "Ordonnance", pluriel: "Ordonnances" },
  decret: { libelle: "Décret", pluriel: "Décrets" },
  acte_uniforme: { libelle: "Acte uniforme OHADA", pluriel: "Actes uniformes OHADA" },
};

/** Accord au masculin (« Abrogé ») pour un décret ou un acte uniforme, au féminin sinon. */
export function estMasculin(acte: string): boolean {
  return acte === "decret" || acte === "acte_uniforme";
}

/** Libellé court de la forme d'un texte : l'initiative pour une loi (« Projet de loi »…), sinon l'acte (« Décret »). */
export function libelleForme(t: { acte: string; type: string | null }): string {
  if (t.type !== null) return TYPES_TEXTE[t.type]?.libelle ?? t.type;
  return ACTES[t.acte]?.libelle ?? t.acte;
}

/**
 * Ce qu'est le texte aujourd'hui, en tête de carte et de fiche : « Loi » une fois adoptée définitivement
 * ou promulguée (« Loi organique », « Loi de finances » si la nature est connue), sinon l'initiative ou l'acte.
 */
export function natureAffichee(t: { acte: string; type: string | null; nature: string | null; statut: string | null }): string {
  if (t.acte === "loi" && (t.statut === "promulgue" || t.statut === "adopte_definitivement")) {
    return t.nature && t.nature !== "ordinaire" ? (NATURES_TEXTE[t.nature] ?? "Loi") : "Loi";
  }
  return libelleForme(t);
}

/** États de vigueur (affichés seulement si une source les atteste). */
export const VIGUEUR: Record<string, string> = {
  en_vigueur: "En vigueur",
  modifie: "Modifié",
  abroge: "Abrogé",
};

/** Relation d'un texte avec un autre (« Ce texte … »). */
export const RELATIONS_TEXTE: Record<string, string> = {
  modifie: "Modifie",
  abroge: "Abroge",
  complete: "Complète",
  ratifie: "Ratifie",
  applique: "Est pris pour l'application de",
};

export const NATURES_TEXTE: Record<string, string> = {
  ordinaire: "Loi ordinaire",
  organique: "Loi organique",
  constitutionnelle: "Loi constitutionnelle",
  finances: "Loi de finances",
};

export const CHAMBRES: Record<string, string> = {
  assemblee_nationale: "Assemblée nationale",
  senat: "Sénat",
};

export const ORGANES: Record<string, { libelle: string; icone: string }> = {
  gouvernement: { libelle: "Gouvernement", icone: "i-lucide-building-2" },
  bureau: { libelle: "Bureau", icone: "i-lucide-inbox" },
  commission: { libelle: "Commission", icone: "i-lucide-users" },
  pleniere: { libelle: "Séance plénière", icone: "i-lucide-landmark" },
  conseil_constitutionnel: { libelle: "Conseil constitutionnel", icone: "i-lucide-scale" },
  presidence: { libelle: "Présidence de la République", icone: "i-lucide-scroll-text" },
};

export const ROLES: Record<RoleActeur, string> = {
  auteur: "Auteur",
  rapporteur: "Rapporteur",
  cosignataire: "Cosignataire",
};

export const SORTS_AMENDEMENT: Record<string, string> = {
  adopte: "Adopté",
  rejete: "Rejeté",
  retire: "Retiré",
};

/** Texte unique pour toute information inconnue (règle « ne jamais inventer »). */
export const NON_RENSEIGNE = "Non renseigné";
