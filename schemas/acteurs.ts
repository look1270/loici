/**
 * Partis et parlementaires.
 * Fichiers : donnees/partis/<id>.json et donnees/parlementaires/<id>.json
 *
 * Neutralité (règle n° 6) : aucun logo, aucune couleur de parti n'est stockée ni affichée.
 */
import { z } from "zod";
import { MESSAGE_PERIODE, chambre, dateIso, identifiant, libelle, periodeCoherente, sourceIds } from "./communs";

export const parti = z.strictObject({
  id: identifiant,
  nom: libelle(2, 200),
  sigle: libelle(1, 30).nullable(),
  source_ids: sourceIds,
});

/**
 * Un mandat = une législature dans une chambre.
 * Le parti et la circonscription sont portés par le mandat, car ils peuvent changer d'un mandat à l'autre.
 */
export const mandat = z
  .strictObject({
    legislature_id: identifiant,
    /** Doit égaler la chambre de la législature citée (contrôle croisé CI). */
    chambre,
    /** « elu » ou « nomme » (une partie des sénateurs est désignée). null si la source ne le dit pas. */
    mode_designation: z.enum(["elu", "nomme"]).nullable(),
    /** Circonscription telle qu'écrite par la source ; null pour un sénateur nommé ou si inconnue. */
    circonscription: libelle(2, 200).nullable(),
    /** Parti d'investiture ; null = sans étiquette connue (« Non renseigné »). */
    parti_id: identifiant.nullable(),
    /** Groupe parlementaire, s'il diffère du parti ; libellé recopié de la source. */
    groupe_parlementaire: libelle(2, 200).nullable(),
    date_debut: dateIso.nullable(),
    date_fin: dateIso.nullable(),
    source_ids: sourceIds,
  })
  .refine(periodeCoherente, { message: MESSAGE_PERIODE, path: ["date_fin"] })
  // Un parlementaire nommé ne représente pas de circonscription.
  .refine((m) => m.mode_designation !== "nomme" || m.circonscription === null, {
    message: "Un parlementaire nommé n'a pas de circonscription",
    path: ["circonscription"],
  });

export const parlementaire = z
  .strictObject({
    id: identifiant,
    nom: libelle(1, 100),
    prenoms: libelle(1, 150).nullable(),
    mandats: z.array(mandat).min(1, "Un parlementaire a au moins un mandat"),
    source_ids: sourceIds,
  })
  // Une même législature ne peut figurer qu'une fois.
  .refine((p) => new Set(p.mandats.map((m) => m.legislature_id)).size === p.mandats.length, {
    message: "Même législature citée dans deux mandats",
    path: ["mandats"],
  });

export type Parti = z.infer<typeof parti>;
export type Mandat = z.infer<typeof mandat>;
export type Parlementaire = z.infer<typeof parlementaire>;
