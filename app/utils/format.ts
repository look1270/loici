/**
 * Mise en forme des valeurs pour l'affichage.
 */

/**
 * « 2026-04-07 » → « 7 avril 2026 ». Calcul en UTC pour qu'aucun fuseau ne décale le jour.
 * Retourne null si la date est inconnue : l'appelant affiche alors « Non renseigné ».
 */
export function formaterDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** « 12345 » → « 12 345 » (espace fine insécable, à la française). */
export function formaterNombre(n: number): string {
  return n.toLocaleString("fr-FR");
}

/** Nom de domaine lisible d'une URL : « https://www.gouv.ci/x » → « gouv.ci ». */
export function domaine(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
