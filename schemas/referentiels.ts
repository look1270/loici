/**
 * Référentiels : listes partagées servant aux filtres.
 * Fichiers : donnees/referentiels/{legislatures,commissions,themes,domaines-officiels}.json
 */
import { z } from "zod";
import { MESSAGE_PERIODE, chambre, dateIso, identifiant, libelle, periodeCoherente, sourceIds } from "./communs";

/** Vérifie qu'une liste d'objets n'a pas deux fois le même id. */
const idsUniques = <T extends { id: string }>(liste: T[]) => new Set(liste.map((e) => e.id)).size === liste.length;

/** Législature d'une chambre. Le libellé est recopié de la source officielle, pas reconstruit. */
export const legislature = z
  .strictObject({
    id: identifiant,
    chambre,
    libelle: libelle(3, 120),
    date_debut: dateIso.nullable(),
    date_fin: dateIso.nullable(),
    source_ids: sourceIds,
  })
  .refine(periodeCoherente, { message: MESSAGE_PERIODE, path: ["date_fin"] });

/** Commission permanente (ou spéciale) d'une chambre. */
export const commission = z.strictObject({
  id: identifiant,
  chambre,
  nom: libelle(3, 250),
  sigle: libelle(2, 20).nullable(),
  source_ids: sourceIds,
});

/**
 * Thème : classement éditorial du projet (santé, foncier…), pas un fait.
 * C'est la seule entité sans source ; la liste est fermée et modifiée par pull request.
 */
export const theme = z.strictObject({
  id: identifiant,
  libelle: libelle(2, 80),
});

/**
 * Domaines reconnus comme « officiels ». La CI refusera une source typée « officielle »
 * dont l'URL n'appartient pas à l'un de ces domaines (ou à leurs sous-domaines).
 */
export const domaineOfficiel = z.strictObject({
  domaine: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Nom de domaine attendu, ex. assnat.ci"),
  institution: libelle(2, 150),
});

export const legislatures = z.array(legislature).refine(idsUniques, "Identifiant de législature en double");
export const commissions = z.array(commission).refine(idsUniques, "Identifiant de commission en double");
export const themes = z.array(theme).refine(idsUniques, "Identifiant de thème en double");
export const domainesOfficiels = z
  .array(domaineOfficiel)
  .refine((l) => new Set(l.map((d) => d.domaine)).size === l.length, "Domaine en double");

export type Legislature = z.infer<typeof legislature>;
export type Commission = z.infer<typeof commission>;
export type Theme = z.infer<typeof theme>;
