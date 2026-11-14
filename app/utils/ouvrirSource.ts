/**
 * « Lire plus » : ouvre la source originelle dans un nouvel onglet et bascule sur l'archive
 * Wayback Machine si le site d'origine ne répond pas (règle n° 4).
 *
 * Fonctionnement :
 *   1. l'onglet est ouvert IMMÉDIATEMENT au clic (sinon le navigateur le bloque comme fenêtre surgissante) ;
 *   2. on teste le site d'origine (requête sans lecture de contenu, délai limité) ;
 *   3. l'onglet est dirigé vers l'original s'il répond, sinon vers l'archive.
 *
 * Limite connue : depuis un navigateur, on détecte un site injoignable (domaine mort, serveur éteint,
 * délai dépassé) mais pas une page « 404 » servie par un site vivant. Le robot de collecte (étape 5)
 * vérifiera ces liens chaque jour.
 *
 * Sans JavaScript, le lien reste un lien normal vers l'original : rien n'est cassé.
 */

/** Délai d'attente : généreux, car beaucoup de visiteurs ont une connexion lente. */
const DELAI_MS = 8000;

/** Vrai si le site d'origine répond dans le délai. */
export async function siteJoignable(url: string, delaiMs = DELAI_MS): Promise<boolean> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), delaiMs);
  try {
    // « no-cors » : on n'a pas le droit de lire la réponse, mais une erreur réseau reste détectable.
    await fetch(url, {
      mode: "no-cors",
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controleur.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(minuterie);
    controleur.abort(); // inutile de télécharger tout le document : on voulait seulement savoir s'il répond
  }
}

/** Gestionnaire de clic du bouton « Lire plus ». */
export async function ouvrirAvecRepli(evenement: MouseEvent, url: string, urlArchive: string): Promise<void> {
  // Ctrl/Cmd/Maj-clic ou clic du milieu : on laisse le navigateur faire.
  if (evenement.defaultPrevented || evenement.button !== 0 || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey) {
    return;
  }
  // Une page https ne peut pas tester une adresse http : on ouvre directement l'original.
  if (window.location.protocol === "https:" && url.startsWith("http:")) return;

  evenement.preventDefault();
  const onglet = window.open("", "_blank");
  if (!onglet) {
    // Fenêtre bloquée malgré tout : on ouvre l'original dans l'onglet courant.
    window.location.href = url;
    return;
  }
  onglet.opener = null; // la page ouverte ne peut pas agir sur LoiCI
  onglet.document.title = "Ouverture de la source…";
  onglet.document.body.style.font = "16px system-ui, sans-serif";
  onglet.document.body.style.padding = "24px";
  onglet.document.body.textContent = "Ouverture de la source officielle… Si elle ne répond pas, sa copie archivée s'ouvrira.";

  const joignable = await siteJoignable(url);
  onglet.location.replace(joignable ? url : urlArchive);
}
