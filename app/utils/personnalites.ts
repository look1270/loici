/**
 * Personnalités liées aux textes recensés : ministres porteurs (pour le Gouvernement) et parlementaires.
 * Tout est DÉDUIT des fiches publiées (textes.json) : aucune personnalité n'est ajoutée à la main,
 * et un nombre de textes ne compte que les textes recensés par LoiCI.
 * Fonctions pures : testées dans tests/personnalites.test.ts.
 */
import type { ResumeTexte } from "../../schemas/api";
import type { RoleActeur } from "../../schemas/statuts";
import { nomAffiche } from "./nom";
import { normaliser } from "./recherche";

export interface TexteLie {
  id: string;
  titre: string;
  role: RoleActeur;
  annee: number | null;
}

export interface Personnalite {
  /** Clé stable, utilisée comme ancre de page : « gouv-<nom normalisé> » ou « parl-<identifiant> ». */
  cle: string;
  nom: string;
  genre: "gouvernement" | "parlementaire";
  /** Fiche parlementaire, s'il y en a une. */
  parlementaire_id: string | null;
  /** Ministères au nom desquels la personne a porté un texte (vide pour un parlementaire). */
  ministeres: string[];
  textes: TexteLie[];
  /** Textes dont la personne est l'auteur ou le porteur (rôle « auteur »). */
  nb_portes: number;
}

/** Regroupe les personnalités citées par les textes, de la plus active à la moins active. */
export function listerPersonnalites(textes: ResumeTexte[], nomsParlementaires: Map<string, string>): Personnalite[] {
  const parCle = new Map<string, Personnalite>();
  const ajouter = (base: Omit<Personnalite, "textes" | "nb_portes" | "ministeres">, t: ResumeTexte, role: RoleActeur, ministere: string | null) => {
    let p = parCle.get(base.cle);
    if (!p) {
      p = { ...base, ministeres: [], textes: [], nb_portes: 0 };
      parCle.set(base.cle, p);
    }
    if (ministere && !p.ministeres.includes(ministere)) p.ministeres.push(ministere);
    // Un même texte n'est compté qu'une fois par rôle.
    if (p.textes.some((x) => x.id === t.id && x.role === role)) return;
    p.textes.push({ id: t.id, titre: nomAffiche(t, t.date_promulgation), role, annee: t.annee });
    if (role === "auteur") p.nb_portes += 1;
  };

  for (const t of textes) {
    for (const a of t.auteurs_gouvernement) {
      if (!a.ministre) continue; // ministre non renseigné : on ne devine pas qui portait le texte
      const cle = `gouv-${normaliser(a.ministre).replace(/ /g, "-")}`;
      ajouter({ cle, nom: a.ministre, genre: "gouvernement", parlementaire_id: null }, t, "auteur", a.ministere);
    }
    for (const lien of t.parlementaires) {
      const nom = nomsParlementaires.get(lien.id) ?? lien.id;
      ajouter({ cle: `parl-${lien.id}`, nom, genre: "parlementaire", parlementaire_id: lien.id }, t, lien.role, null);
    }
  }

  const liste = [...parCle.values()];
  for (const p of liste) p.textes.sort((a, b) => (b.annee ?? 0) - (a.annee ?? 0));
  return liste.sort((a, b) => b.nb_portes - a.nb_portes || b.textes.length - a.textes.length || a.nom.localeCompare(b.nom, "fr"));
}

/**
 * Personnalités suggérées pendant la recherche : celles dont un mot du nom commence par un mot saisi
 * (3 lettres au moins, chiffres exclus). « coul » ou « budget coulibaly » proposent « Adama Coulibaly ».
 */
export function personnalitesCorrespondantes(personnalites: Personnalite[], requete: string): Personnalite[] {
  const mots = normaliser(requete)
    .split(" ")
    .filter((m) => m.length >= 3 && !/^\d+$/.test(m));
  if (mots.length === 0) return [];
  return personnalites.filter((p) => {
    const motsNom = normaliser(p.nom).split(" ");
    return mots.some((m) => motsNom.some((n) => n.startsWith(m)));
  });
}
