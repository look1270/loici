/**
 * Source : la pièce justificative de toute information du site.
 * Fichier : donnees/sources/<id>.json (un fichier par source, réutilisable par plusieurs textes).
 */
import { z } from "zod";
import { dateIso, empreinteSha256, identifiant, libelle, urlArchive, urlWeb } from "./communs";

/** Hiérarchie (règle n° 7) : « officielle » d'abord, « presse » ensuite. */
export const typeSource = z.enum(["officielle", "presse"]);

/** Nature du document pointé, utile pour l'affichage (icône PDF, etc.). */
export const formatSource = z.enum(["page_web", "pdf"]);

/**
 * Normalise une URL pour comparer l'original et l'URL archivée :
 * la Wayback Machine peut changer http/https, « www. » ou la barre finale.
 */
const normaliserUrl = (url: string) =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .toLowerCase();

/** Extrait l'URL d'origine d'un lien https://web.archive.org/web/AAAAMMJJhhmmss/<origine>. */
const urlOrigineArchive = (urlArchive: string) => urlArchive.replace(/^https:\/\/web\.archive\.org\/web\/\d{14}\//, "");

export const source = z
  .strictObject({
  id: identifiant,
  /** Adresse originale. C'est elle qu'ouvre « Lire plus ». */
  url: urlWeb,
  /** Titre du document ou de la page, recopié tel quel. */
  titre: libelle(3, 400),
  /** Nom de l'émetteur. Ex. « Assemblée nationale », « Agence ivoirienne de presse (AIP) ». */
  nom: libelle(2, 150),
  type: typeSource,
  format: formatSource,
  /** Date de publication par l'émetteur ; null si elle n'apparaît pas sur la source. */
  date_publication: dateIso.nullable(),
  /** Date à laquelle un humain ou le robot a consulté la source. */
  date_consultation: dateIso,
  /** Copie Wayback Machine : « Lire plus » bascule dessus si l'URL originale est morte. */
  url_archive: urlArchive,
  /** Empreinte du PDF au moment de la consultation (null pour une page web). */
  empreinte_sha256: empreinteSha256.nullable(),
  })
  // L'archive doit être celle de CETTE URL, pas d'une autre page.
  .refine((s) => normaliserUrl(urlOrigineArchive(s.url_archive)) === normaliserUrl(s.url), {
    message: "Le lien d'archive ne correspond pas à l'URL de la source",
    path: ["url_archive"],
  })
  // On ne peut pas consulter un document avant sa publication.
  .refine((s) => s.date_publication === null || s.date_publication <= s.date_consultation, {
    message: "Date de publication postérieure à la date de consultation",
    path: ["date_publication"],
  })
  // L'empreinte ne concerne que les PDF (le contenu d'une page web change trop souvent pour être haché).
  .refine((s) => s.format === "pdf" || s.empreinte_sha256 === null, {
    message: "Empreinte réservée aux sources au format PDF",
    path: ["empreinte_sha256"],
  });

export type Source = z.infer<typeof source>;
