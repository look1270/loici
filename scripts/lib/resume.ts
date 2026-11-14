/**
 * Résumés des textes publiés dans textes.json : ce qu'il faut pour la liste, la recherche et les filtres.
 * Partagé par la génération de l'API (scripts/construire-api.ts) et la recherche en ligne de commande (scripts/chercher.ts).
 */
import {
  type ResumeTexte,
  chambreDepot,
  commissionsSaisies,
  dateDepot,
  datePromulgation,
} from "../../schemas";
import { type Donnees, sourcesCitees } from "./donnees";

export function resumerTextes(donnees: Donnees): ResumeTexte[] {
  const { sources, textes, parlementaires } = donnees;
  const sourcesParId = new Map(sources.map((s) => [s.id, s]));
  const parlementairesParId = new Map(parlementaires.map((p) => [p.id, p]));

  return textes.map((t): ResumeTexte => {
    const citees = sourcesCitees(t).map((id) => sourcesParId.get(id)!);
    const datesConnues = t.etapes.map((e) => e.date).filter((d): d is string => d !== null);
    const liesParlementaires = t.acteurs.flatMap((a) =>
      a.acteur.genre === "parlementaire" ? [{ id: a.acteur.parlementaire_id, role: a.role }] : [],
    );
    // Parti = celui du mandat correspondant à la législature du texte, et seulement celui-là.
    const partisDuTexte = liesParlementaires.flatMap(({ id }) => {
      const mandat = parlementairesParId.get(id)?.mandats.find((m) => m.legislature_id === t.legislature_id);
      return t.legislature_id !== null && mandat?.parti_id ? [mandat.parti_id] : [];
    });
    return {
      id: t.id,
      titre_officiel: t.titre_officiel,
      numero_depot: t.numero_depot,
      numero_loi: t.numero_loi,
      type: t.type,
      nature: t.nature,
      statut: t.statut,
      legislature_id: t.legislature_id,
      annee: datesConnues.length > 0 ? Number(datesConnues[0]!.slice(0, 4)) : null,
      date_depot: dateDepot(t),
      chambre_depot: chambreDepot(t),
      date_promulgation: datePromulgation(t),
      date_derniere_etape: datesConnues.at(-1) ?? null,
      themes: t.themes,
      commission_ids: commissionsSaisies(t),
      auteurs_gouvernement: t.acteurs.flatMap((a) =>
        a.role === "auteur" && a.acteur.genre === "gouvernement"
          ? [{ ministre: a.acteur.ministre, ministere: a.acteur.ministere }]
          : [],
      ),
      parlementaires: liesParlementaires,
      parti_ids: [...new Set(partisDuTexte)],
      /** Badge « Source non officielle » : aucune source officielle parmi toutes celles citées. */
      source_officielle: citees.some((s) => s.type === "officielle"),
      mis_a_jour_le: t.mis_a_jour_le,
    };
  });
}
