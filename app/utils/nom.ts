/**
 * Nom affiché d'un texte : le bon nom selon où il en est (correction « loi ou projet de loi »).
 *
 *   - loi promulguée          → son titre de loi (« Loi n° 2024-358 du 11 juin 2024 modifiant… ») ;
 *                               à défaut de titre recopié, il est formé du numéro, de la date de promulgation et de l'objet ;
 *   - loi adoptée, non encore promulguée → « Loi » + objet (« Loi relative au divorce… ») ;
 *   - en examen, rejetée, retirée → l'intitulé du projet ou de la proposition, tel quel ;
 *   - ordonnance, décret      → leur intitulé officiel.
 *
 * L'intitulé du projet n'est jamais perdu : la fiche le montre dans l'historique du texte.
 * Fonctions pures : testées dans tests/nom.test.ts.
 */
import type { CodeStatut } from "../../schemas/statuts";
import { formaterDate } from "./format";

export interface TexteNommable {
  acte: string;
  titre_officiel: string;
  titre_loi: string | null;
  numero_loi: string | null;
  statut: CodeStatut | null;
}

/** « Projet de loi organique portant… » → « organique portant… » ; null si l'intitulé n'est pas celui d'un projet ou d'une proposition. */
export function objetDuProjet(titre: string): string | null {
  const m = titre.match(/^\s*(?:projet|proposition)\s+de\s+loi\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

/**
 * Objet accordé avec « loi » : « relatif au nom » → « relative au nom ».
 * Seul le premier mot est accordé ; le reste de l'intitulé est recopié tel quel.
 */
export function objetDeLoi(titre: string): string | null {
  const objet = objetDuProjet(titre);
  return objet ? objet.replace(/^relatifs?\b/i, (m) => (m.toLowerCase().endsWith("s") ? "relatives" : "relative")) : null;
}

/** « Loi relative au nom » à partir de « Projet de loi relatif au nom » ; null si impossible. */
function nomDeLoi(titre: string): string | null {
  const objet = objetDeLoi(titre);
  return objet ? `Loi ${objet}` : null;
}

/**
 * @param datePromulgation date AAAA-MM-JJ de l'étape « promulgue », pour former « Loi n° … du … » si le titre de loi manque.
 */
export function nomAffiche(t: TexteNommable, datePromulgation: string | null = null): string {
  if (t.acte !== "loi") return t.titre_officiel;
  if (t.statut === "promulgue") {
    if (t.titre_loi) return t.titre_loi;
    const objet = objetDeLoi(t.titre_officiel);
    if (t.numero_loi && objet) {
      const date = datePromulgation ? ` du ${formaterDate(datePromulgation)}` : "";
      return `${t.numero_loi}${date} ${objet}`;
    }
    return nomDeLoi(t.titre_officiel) ?? t.titre_officiel;
  }
  if (t.statut === "adopte_definitivement") return nomDeLoi(t.titre_officiel) ?? t.titre_officiel;
  return t.titre_officiel;
}

/** Vrai si le nom affiché diffère de l'intitulé d'origine : la fiche montre alors l'ancien intitulé dans l'historique. */
export const intituleDOrigineDifferent = (t: TexteNommable, datePromulgation: string | null = null) =>
  nomAffiche(t, datePromulgation) !== t.titre_officiel;
