/**
 * Chargement de donnees/ : lit chaque fichier, le valide avec son schéma Zod
 * et rassemble TOUS les problèmes (au lieu de s'arrêter au premier),
 * pour qu'un contributeur voie d'un coup tout ce qu'il doit corriger.
 *
 * Utilisé par la CI (scripts/valider-donnees.ts) et par la construction du site (scripts/construire-api.ts) :
 * une seule définition de ce qui est « valide ».
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { z } from "zod";
import {
  type Commission,
  type Legislature,
  type Parlementaire,
  type Parti,
  type Referentiels,
  type Source,
  type Texte,
  type Categorie,
  type Theme,
  categories as schemaCategories,
  commissions as schemaCommissions,
  domainesOfficiels as schemaDomaines,
  legislatures as schemaLegislatures,
  parlementaire as schemaParlementaire,
  parti as schemaParti,
  source as schemaSource,
  texte as schemaTexte,
  themes as schemaThemes,
} from "../../schemas";

export type Niveau = "erreur" | "avertissement";

export interface Probleme {
  niveau: Niveau;
  /** Chemin du fichier depuis la racine du dépôt, ex. « donnees/textes/x.json ». */
  fichier: string;
  /** Emplacement dans le fichier, ex. « etapes.2.date » (vide = tout le fichier). */
  champ: string;
  message: string;
}

export interface Donnees {
  sources: Source[];
  textes: Texte[];
  parlementaires: Parlementaire[];
  partis: Parti[];
  referentiels: Referentiels;
  /**
   * Identifiants (noms de fichiers) présents mais écartés car invalides.
   * Permet de dire « source invalide » plutôt que « source introuvable », et d'éviter
   * de fausses alertes en cascade.
   */
  invalides?: { sources: Set<string>; textes: Set<string>; parlementaires: Set<string>; partis: Set<string> };
}

/** Chemins des fichiers, tels qu'affichés dans les messages (relatifs à la racine du dépôt). */
export const cheminFichier = {
  source: (id: string) => `donnees/sources/${id}.json`,
  texte: (id: string) => `donnees/textes/${id}.json`,
  parlementaire: (id: string) => `donnees/parlementaires/${id}.json`,
  parti: (id: string) => `donnees/partis/${id}.json`,
  referentiel: (nom: string) => `donnees/referentiels/${nom}.json`,
};

/** Toutes les sources citées par un texte, à tous les niveaux (texte, vigueur, JO, textes liés, acteurs, étapes, votes, révisions). */
export function sourcesCitees(t: Texte): string[] {
  return [
    ...new Set([
      ...t.source_ids,
      t.document_principal_source_id,
      ...(t.vigueur?.source_ids ?? []),
      ...(t.reference_jo?.source_ids ?? []),
      ...t.textes_lies.flatMap((l) => l.source_ids),
      ...t.acteurs.flatMap((a) => a.source_ids),
      ...t.etapes.flatMap((e) => [...e.source_ids, ...(e.vote?.source_ids ?? [])]),
      ...t.revisions.flatMap((r) => r.source_ids),
    ]),
  ];
}

/** Sources citées par une fiche parlementaire (fiche et mandats). */
export function sourcesParlementaire(p: Parlementaire): string[] {
  return [...new Set([...p.source_ids, ...p.mandats.flatMap((m) => m.source_ids)])];
}

/**
 * Lit et valide un fichier JSON. Retourne null s'il est illisible ou invalide (le problème est consigné).
 */
async function lireFichier<S extends z.ZodType>(
  racine: string,
  cheminRelatif: string,
  schema: S,
  problemes: Probleme[],
): Promise<z.infer<S> | null> {
  let brut: unknown;
  try {
    brut = JSON.parse(await readFile(join(racine, cheminRelatif), "utf8"));
  } catch (erreur) {
    problemes.push({ niveau: "erreur", fichier: cheminRelatif, champ: "", message: `JSON illisible : ${(erreur as Error).message}` });
    return null;
  }
  const resultat = schema.safeParse(brut);
  if (!resultat.success) {
    for (const issue of resultat.error.issues) {
      problemes.push({ niveau: "erreur", fichier: cheminRelatif, champ: issue.path.join("."), message: issue.message });
    }
    return null;
  }
  return resultat.data;
}

/** Lit tous les *.json d'un dossier de donnees/ ; le nom de chaque fichier doit égaler son id. */
async function lireDossier<S extends z.ZodType<{ id: string }>>(
  racine: string,
  dossier: string,
  schema: S,
  problemes: Probleme[],
  invalides: Set<string>,
): Promise<z.infer<S>[]> {
  let noms: string[];
  try {
    noms = (await readdir(join(racine, "donnees", dossier))).sort();
  } catch {
    return []; // dossier absent = aucun élément
  }
  const elements: z.infer<S>[] = [];
  for (const nom of noms) {
    if (nom.startsWith(".")) continue; // .gitkeep, etc.
    const relatif = `donnees/${dossier}/${nom}`;
    if (!nom.endsWith(".json")) {
      problemes.push({ niveau: "erreur", fichier: relatif, champ: "", message: "Seuls des fichiers .json sont attendus ici" });
      continue;
    }
    const element = await lireFichier(racine, relatif, schema, problemes);
    if (!element) {
      invalides.add(basename(nom, ".json"));
      continue;
    }
    if (basename(nom, ".json") !== element.id) {
      problemes.push({ niveau: "erreur", fichier: relatif, champ: "id", message: `Le fichier doit s'appeler « ${element.id}.json »` });
      invalides.add(basename(nom, ".json"));
      invalides.add(element.id);
      continue;
    }
    elements.push(element);
  }
  return elements;
}

/**
 * Charge et valide toutes les données. Chaque fichier invalide est écarté et ses problèmes consignés.
 * @param racine racine du dépôt (le dossier qui contient donnees/)
 */
export async function chargerDonnees(racine: string): Promise<{ donnees: Donnees; problemes: Probleme[] }> {
  const problemes: Probleme[] = [];
  const ref = <S extends z.ZodType>(nom: string, schema: S) =>
    lireFichier(racine, cheminFichier.referentiel(nom), schema, problemes);

  const invalides = { sources: new Set<string>(), textes: new Set<string>(), parlementaires: new Set<string>(), partis: new Set<string>() };
  const donnees: Donnees = {
    sources: await lireDossier(racine, "sources", schemaSource, problemes, invalides.sources),
    textes: await lireDossier(racine, "textes", schemaTexte, problemes, invalides.textes),
    parlementaires: await lireDossier(racine, "parlementaires", schemaParlementaire, problemes, invalides.parlementaires),
    partis: await lireDossier(racine, "partis", schemaParti, problemes, invalides.partis),
    invalides,
    referentiels: {
      legislatures: ((await ref("legislatures", schemaLegislatures)) ?? []) as Legislature[],
      commissions: ((await ref("commissions", schemaCommissions)) ?? []) as Commission[],
      themes: ((await ref("themes", schemaThemes)) ?? []) as Theme[],
      categories: ((await ref("categories", schemaCategories)) ?? []) as Categorie[],
      domaines_officiels: (await ref("domaines-officiels", schemaDomaines)) ?? [],
    },
  };
  return { donnees, problemes };
}
