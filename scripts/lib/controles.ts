/**
 * Contrôles croisés entre fichiers : ce que Zod ne peut pas vérifier fichier par fichier.
 * Fonction pure (aucune lecture disque, aucune date implicite) : testée dans tests/controles.test.ts.
 *
 * Erreurs (bloquent la pull request) :
 *   - référence vers une source, un parlementaire, un parti, une commission, une législature, un thème,
 *     une catégorie ou un texte lié inexistant ; sous-catégorie hors de sa catégorie ;
 *   - source « officielle » hors des domaines officiels, ou source « presse » sur un domaine officiel ;
 *   - même URL décrite par deux fichiers de source (sauf deux versions d'un PDF aux empreintes différentes) ;
 *   - chambre d'un mandat ≠ chambre de sa législature ; commission d'une étape d'une autre chambre que l'étape ;
 *   - date dans le futur (publication, consultation, étape, révision, mise à jour).
 * Avertissements (signalés, non bloquants) :
 *   - source jamais citée ;
 *   - texte sans aucune source officielle (il portera le badge « Source non officielle »).
 */
import type { Source } from "../../schemas";
import { type Donnees, type Probleme, cheminFichier, sourcesCitees, sourcesParlementaire } from "./donnees";

/** Nom d'hôte d'une URL, sans « www. » ; null si l'URL est illisible. */
function hote(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Vrai si l'hôte est le domaine lui-même ou l'un de ses sous-domaines (plan.gouv.ci ⊂ gouv.ci). */
export function surDomaine(hoteUrl: string, domaine: string): boolean {
  return hoteUrl === domaine || hoteUrl.endsWith(`.${domaine}`);
}

/** URL comparable : sans protocole, « www. », ni barre finale. */
const urlComparable = (url: string) =>
  url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .toLowerCase();

/**
 * @param aujourdhui date du jour AAAA-MM-JJ (passée en paramètre pour des tests reproductibles)
 */
export function controlesCroises(d: Donnees, aujourdhui: string): Probleme[] {
  const problemes: Probleme[] = [];
  const erreur = (fichier: string, champ: string, message: string) =>
    problemes.push({ niveau: "erreur", fichier, champ, message });
  const avertir = (fichier: string, champ: string, message: string) =>
    problemes.push({ niveau: "avertissement", fichier, champ, message });

  const ids = {
    sources: new Map(d.sources.map((s) => [s.id, s])),
    parlementaires: new Set(d.parlementaires.map((p) => p.id)),
    partis: new Set(d.partis.map((p) => p.id)),
    commissions: new Map(d.referentiels.commissions.map((c) => [c.id, c])),
    legislatures: new Map(d.referentiels.legislatures.map((l) => [l.id, l])),
    themes: new Set(d.referentiels.themes.map((t) => t.id)),
    categories: new Map(d.referentiels.categories.map((c) => [c.id, c])),
    textes: new Set(d.textes.map((t) => t.id)),
  };
  const domaines = d.referentiels.domaines_officiels.map((x) => x.domaine.toLowerCase());
  const sourcesUtilisees = new Set<string>();

  /** Vérifie qu'une liste de sources existe, et les marque comme utilisées. */
  const invalides = d.invalides;
  /** Message adapté : une source présente mais invalide n'est pas « introuvable ». */
  const absente = (genre: string, dossier: string, id: string, ensemble?: Set<string>) =>
    ensemble?.has(id)
      ? `${genre} « ${id} » invalide : corrigez d'abord donnees/${dossier}/${id}.json`
      : `${genre} introuvable : « ${id} » (fichier attendu : donnees/${dossier}/${id}.json)`;

  const verifierSources = (fichier: string, champ: string, liste: string[]) => {
    liste.forEach((id, i) => {
      sourcesUtilisees.add(id);
      if (!ids.sources.has(id)) erreur(fichier, `${champ}.${i}`, absente("Source", "sources", id, invalides?.sources));
    });
  };
  const verifierDate = (fichier: string, champ: string, date: string | null) => {
    if (date !== null && date > aujourdhui) erreur(fichier, champ, `Date dans le futur : ${date}`);
  };

  // ---------------------------------------------------------------- Sources
  // Une même URL ne peut être décrite qu'une fois… sauf versions successives d'un même PDF
  // (même adresse, empreintes différentes), que le robot détecte et propose comme nouvelles sources.
  const parUrl = new Map<string, Source[]>();
  for (const s of d.sources) {
    const f = cheminFichier.source(s.id);
    const h = hote(s.url);
    const officielle = h !== null && domaines.some((dom) => surDomaine(h, dom));
    if (s.type === "officielle" && !officielle) {
      erreur(f, "type", `Source typée « officielle » mais ${h ?? "l'URL"} n'est pas un domaine officiel (voir donnees/referentiels/domaines-officiels.json)`);
    }
    if (s.type !== "officielle" && officielle) {
      erreur(f, "type", `Source sur un domaine officiel (${h}) : elle doit être typée « officielle »`);
    }
    const cle = urlComparable(s.url);
    const memesUrl = parUrl.get(cle) ?? [];
    const estUneVersion = (autre: Source) =>
      s.format === "pdf" && autre.format === "pdf" && s.empreinte_sha256 !== null && autre.empreinte_sha256 !== null &&
      s.empreinte_sha256 !== autre.empreinte_sha256;
    const doublon = memesUrl.find((autre) => !estUneVersion(autre));
    if (doublon) erreur(f, "url", `Même URL que la source « ${doublon.id} » : réutilisez-la au lieu d'en créer une nouvelle`);
    parUrl.set(cle, [...memesUrl, s]);
    verifierDate(f, "date_publication", s.date_publication);
    verifierDate(f, "date_consultation", s.date_consultation);
  }

  // ---------------------------------------------------------------- Référentiels
  for (const [nom, liste] of [
    ["legislatures", d.referentiels.legislatures],
    ["commissions", d.referentiels.commissions],
  ] as const) {
    liste.forEach((el, i) => verifierSources(cheminFichier.referentiel(nom), `${i}.source_ids`, el.source_ids));
  }
  d.referentiels.legislatures.forEach((l, i) => {
    verifierDate(cheminFichier.referentiel("legislatures"), `${i}.date_debut`, l.date_debut);
    verifierDate(cheminFichier.referentiel("legislatures"), `${i}.date_fin`, l.date_fin);
  });

  // ---------------------------------------------------------------- Partis
  for (const p of d.partis) verifierSources(cheminFichier.parti(p.id), "source_ids", p.source_ids);

  // ---------------------------------------------------------------- Parlementaires
  for (const p of d.parlementaires) {
    const f = cheminFichier.parlementaire(p.id);
    verifierSources(f, "source_ids", p.source_ids);
    p.mandats.forEach((m, i) => {
      const champ = `mandats.${i}`;
      verifierSources(f, `${champ}.source_ids`, m.source_ids);
      const legislature = ids.legislatures.get(m.legislature_id);
      if (!legislature) erreur(f, `${champ}.legislature_id`, `Législature inconnue : « ${m.legislature_id} »`);
      else if (legislature.chambre !== m.chambre) {
        erreur(f, `${champ}.chambre`, `La législature « ${m.legislature_id} » concerne la chambre « ${legislature.chambre} »`);
      }
      if (m.parti_id !== null && !ids.partis.has(m.parti_id)) erreur(f, `${champ}.parti_id`, absente("Parti", "partis", m.parti_id, invalides?.partis));
      verifierDate(f, `${champ}.date_debut`, m.date_debut);
      verifierDate(f, `${champ}.date_fin`, m.date_fin);
    });
  }

  // ---------------------------------------------------------------- Textes
  for (const t of d.textes) {
    const f = cheminFichier.texte(t.id);
    verifierSources(f, "source_ids", t.source_ids);
    verifierSources(f, "document_principal_source_id", [t.document_principal_source_id]);
    verifierDate(f, "mis_a_jour_le", t.mis_a_jour_le);

    if (t.legislature_id !== null && !ids.legislatures.has(t.legislature_id)) {
      erreur(f, "legislature_id", `Législature inconnue : « ${t.legislature_id} »`);
    }
    t.themes.forEach((th, i) => {
      if (!ids.themes.has(th)) erreur(f, `themes.${i}`, `Thème inconnu : « ${th} » (voir donnees/referentiels/themes.json)`);
    });

    if (t.categorie_id !== null) {
      const categorie = ids.categories.get(t.categorie_id);
      if (!categorie) {
        erreur(f, "categorie_id", `Catégorie inconnue : « ${t.categorie_id} » (voir donnees/referentiels/categories.json)`);
      } else if (t.sous_categorie_id !== null && !categorie.sous_categories.some((s) => s.id === t.sous_categorie_id)) {
        erreur(f, "sous_categorie_id", `La sous-catégorie « ${t.sous_categorie_id} » n'appartient pas à la catégorie « ${t.categorie_id} »`);
      }
    }
    if (t.vigueur) verifierSources(f, "vigueur.source_ids", t.vigueur.source_ids);
    if (t.reference_jo) {
      verifierSources(f, "reference_jo.source_ids", t.reference_jo.source_ids);
      verifierDate(f, "reference_jo.date", t.reference_jo.date);
    }
    verifierDate(f, "date_signature", t.date_signature);
    t.textes_lies.forEach((l, i) => {
      verifierSources(f, `textes_lies.${i}.source_ids`, l.source_ids);
      if (l.texte_id === null) return;
      if (l.texte_id === t.id) erreur(f, `textes_lies.${i}.texte_id`, "Un texte ne peut pas être lié à lui-même");
      else if (!ids.textes.has(l.texte_id)) erreur(f, `textes_lies.${i}.texte_id`, absente("Texte", "textes", l.texte_id, invalides?.textes));
    });

    const verifierParlementaire = (champ: string, id: string) => {
      if (!ids.parlementaires.has(id)) erreur(f, champ, absente("Parlementaire", "parlementaires", id, invalides?.parlementaires));
    };
    const verifierCommission = (champ: string, id: string | null) => {
      if (id !== null && !ids.commissions.has(id)) erreur(f, champ, `Commission inconnue : « ${id} »`);
    };

    t.acteurs.forEach((a, i) => {
      verifierSources(f, `acteurs.${i}.source_ids`, a.source_ids);
      if (a.acteur.genre === "parlementaire") verifierParlementaire(`acteurs.${i}.acteur.parlementaire_id`, a.acteur.parlementaire_id);
      verifierCommission(`acteurs.${i}.commission_id`, a.commission_id);
    });

    t.etapes.forEach((e, i) => {
      verifierSources(f, `etapes.${i}.source_ids`, e.source_ids);
      if (e.vote) verifierSources(f, `etapes.${i}.vote.source_ids`, e.vote.source_ids);
      verifierDate(f, `etapes.${i}.date`, e.date);
      verifierCommission(`etapes.${i}.commission_id`, e.commission_id);
      const commission = e.commission_id ? ids.commissions.get(e.commission_id) : undefined;
      if (commission && e.chambre !== null && commission.chambre !== e.chambre) {
        erreur(f, `etapes.${i}.commission_id`, `La commission « ${commission.id} » appartient à la chambre « ${commission.chambre} », pas « ${e.chambre} »`);
      }
    });

    t.revisions.forEach((r, i) => {
      verifierSources(f, `revisions.${i}.source_ids`, r.source_ids);
      verifierDate(f, `revisions.${i}.date`, r.date);
      if (r.auteur?.genre === "parlementaire") verifierParlementaire(`revisions.${i}.auteur.parlementaire_id`, r.auteur.parlementaire_id);
    });

    // Avertissement : aucune source officielle → badge « Source non officielle » sur le site.
    const citees = sourcesCitees(t).map((id) => ids.sources.get(id)).filter((s) => s !== undefined);
    if (citees.length > 0 && !citees.some((s) => s.type === "officielle")) {
      avertir(f, "source_ids", "Aucune source officielle : le texte affichera le badge « Source non officielle »");
    }
  }

  // ---------------------------------------------------------------- Sources orphelines
  // Inutile de le signaler si un fichier qui cite des sources a été écarté : l'alerte serait fausse.
  const citeursEcartes = (invalides?.textes.size ?? 0) + (invalides?.parlementaires.size ?? 0) + (invalides?.partis.size ?? 0);
  for (const p of d.parlementaires) sourcesParlementaire(p).forEach((id) => sourcesUtilisees.add(id));
  if (citeursEcartes === 0) {
    for (const s of d.sources) {
      if (!sourcesUtilisees.has(s.id)) avertir(cheminFichier.source(s.id), "id", "Source citée par aucune donnée : à supprimer ou à relier");
    }
  }

  return problemes;
}
