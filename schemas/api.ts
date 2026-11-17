/**
 * Formats publiés dans public/api/v1/ : contrat partagé entre le générateur (scripts/construire-api.ts)
 * et le site (app/composables/useDonnees.ts). Toute modification ici est une modification de l'API publique.
 */
import type { z } from "zod";
import type { chambre } from "./communs";
import type { Parlementaire } from "./acteurs";
import type { Categorie, Commission, Legislature, Theme, domaineOfficiel } from "./referentiels";
import type { Source } from "./source";
import type { RoleActeur } from "./statuts";
import type { StatutTexte, Texte } from "./texte";

/** Version courante de l'API (chemin /api/v1/). */
export const VERSION_API = "v1";

/** Entrée de textes.json : ce qu'il faut pour la liste, la recherche et les filtres, rien de plus. */
export interface ResumeTexte {
  id: string;
  acte: Texte["acte"];
  titre_officiel: string;
  titre_loi: string | null;
  numero_depot: string | null;
  numero_loi: string | null;
  numero_acte: string | null;
  /** Initiative d'une loi ; null pour une ordonnance ou un décret. */
  type: Texte["type"];
  nature: Texte["nature"];
  /** Statut du parcours d'une loi ; null pour une ordonnance ou un décret. */
  statut: StatutTexte | null;
  legislature_id: string | null;
  /**
   * Année du texte : première étape datée d'une loi (début connu du parcours),
   * ou date de signature d'une ordonnance ou d'un décret ; null si inconnue.
   */
  annee: number | null;
  date_signature: string | null;
  categorie_id: string | null;
  sous_categorie_id: string | null;
  /** État de vigueur sourcé ; null = non renseigné. */
  vigueur: NonNullable<Texte["vigueur"]>["etat"] | null;
  date_depot: string | null;
  chambre_depot: z.infer<typeof chambre> | null;
  date_promulgation: string | null;
  /** Date de la dernière étape datée : sert au tri « activité la plus récente ». */
  date_derniere_etape: string | null;
  themes: string[];
  commission_ids: string[];
  /** Gouvernement auteur : ministre et ministère porteurs (recherchables). */
  auteurs_gouvernement: { ministre: string | null; ministere: string | null }[];
  /** Parlementaires liés au texte, avec leur rôle. */
  parlementaires: { id: string; role: RoleActeur }[];
  /**
   * Partis des parlementaires liés, pris dans leur mandat de la législature du texte.
   * Vide si la législature du texte est inconnue : on ne devine jamais un parti.
   */
  parti_ids: string[];
  /** false → badge « Source non officielle ». */
  source_officielle: boolean;
  mis_a_jour_le: string;
}

/** Contenu de textes/<id>.json : le texte complet et toutes les sources qu'il cite. */
export type FicheTexte = Texte & { sources: Record<string, Source> };

/** Contenu de parlementaires/<id>.json : la fiche et toutes les sources qu'elle cite. */
export type FicheParlementaire = Parlementaire & { sources: Record<string, Source> };

/** Contenu de referentiels.json. */
export interface Referentiels {
  legislatures: Legislature[];
  commissions: Commission[];
  themes: Theme[];
  categories: Categorie[];
  domaines_officiels: z.infer<typeof domaineOfficiel>[];
}

/** Contenu de meta.json. */
export interface MetaApi {
  genere_le: string;
  licence: "ODbL-1.0";
  effectifs: { textes: number; parlementaires: number; partis: number; sources: number };
}
