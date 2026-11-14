/**
 * Briques communes à tous les schémas LoiCI.
 *
 * Convention « Ne jamais inventer » :
 *   - tous les champs sont OBLIGATOIRES dans le JSON (aucun champ ne peut être omis) ;
 *   - un fait inconnu s'écrit explicitement `null`, affiché « Non renseigné » sur le site.
 *   Ainsi on distingue « on ne sait pas » (null) de « on a oublié » (champ absent → refus CI).
 */
import { z } from "zod";

// Messages d'erreur de validation en français (contributeurs francophones).
z.config(z.locales.fr());

/** Identifiant lisible et stable : minuscules, chiffres, tirets. Ex. « pl-2024-code-electoral ». */
export const identifiant = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Identifiant invalide : minuscules, chiffres et tirets uniquement");

/** Date complète AAAA-MM-JJ. Une date imprécise ou inconnue s'écrit null. */
export const dateIso = z.iso.date();

/** Adresse web publique (http ou https). */
export const urlWeb = z.url({ protocol: /^https?$/, message: "URL http(s) attendue" });

/** Lien d'archive Wayback Machine : https://web.archive.org/web/AAAAMMJJhhmmss/… */
export const urlArchive = z
  .string()
  .regex(
    /^https:\/\/web\.archive\.org\/web\/\d{14}\/https?:\/\/.+/,
    "Lien d'archive Wayback Machine attendu (https://web.archive.org/web/AAAAMMJJhhmmss/…)",
  );

/** Empreinte SHA-256 d'un document (sert à détecter une nouvelle version sans stocker le fichier). */
export const empreinteSha256 = z.string().regex(/^[a-f0-9]{64}$/, "Empreinte SHA-256 en hexadécimal minuscule attendue");

/** Liste de sources : au moins une, sans doublon. Règle n° 2 : zéro donnée sans source. */
export const sourceIds = z
  .array(identifiant)
  .min(1, "Toute donnée factuelle doit citer au moins une source")
  .refine((ids) => new Set(ids).size === ids.length, "Source citée deux fois");

/** Texte libre court, sans espaces superflus en début/fin. */
export const libelle = (min = 2, max = 300) => z.string().trim().min(min).max(max);

/** Les deux chambres du Parlement. */
export const chambre = z.enum(["assemblee_nationale", "senat"]);

/** Liste d'identifiants sans doublon (thèmes, etc.). */
export const identifiantsUniques = z
  .array(identifiant)
  .refine((ids) => new Set(ids).size === ids.length, "Identifiant en double");

/**
 * Vrai si la période est cohérente : début ≤ fin lorsque les deux dates sont connues.
 * Les dates ISO AAAA-MM-JJ se comparent directement comme des chaînes.
 */
export const periodeCoherente = (p: { date_debut: string | null; date_fin: string | null }) =>
  p.date_debut === null || p.date_fin === null || p.date_debut <= p.date_fin;

export const MESSAGE_PERIODE = "La date de fin précède la date de début";
