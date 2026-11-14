/**
 * Import d'une extraction automatique externe (ex. donnees_lois_ci.json) en FILE DE RELECTURE.
 *
 * Rien n'est publié : ces fonctions nettoient, regroupent et classent les lignes extraites,
 * pour qu'une personne vérifie chaque candidat dans sa source avant de créer la fiche dans donnees/.
 * Aucune information n'est complétée ni devinée : les statuts et dates observés sont rapportés tels quels,
 * avec les incohérences repérées.
 *
 * Fonctions pures : testées dans tests/candidats.test.ts.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ Format d'entrée (souple) */

const sourceExtraite = z.object({
  url: z.string(),
  institution: z.string().nullable().optional(),
  type_document: z.string().nullable().optional(),
  intitule: z.string().nullable().optional(),
});

export const ligneExtraite = z.object({
  id: z.string(),
  titre_officiel: z.string(),
  type: z.string().nullable().optional(),
  nature: z.string().nullable().optional(),
  statut: z.string().nullable().optional(),
  numero_loi: z.string().nullable().optional(),
  chambre_depot: z.string().nullable().optional(),
  date_derniere_etape: z.string().nullable().optional(),
  date_promulgation: z.string().nullable().optional(),
  fiabilite: z.string().nullable().optional(),
  sources: z.array(sourceExtraite).default([]),
});
export type LigneExtraite = z.infer<typeof ligneExtraite>;

export const fichierExtraction = z.object({
  meta: z.record(z.string(), z.unknown()).optional(),
  lois: z.array(ligneExtraite),
});

/* ------------------------------------------------------------------ Nettoyage des titres */

const MOIS = "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre";
const MOIS_NUM: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

/** Minuscules, sans accents ni ponctuation (même logique que la recherche du site). */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Commentaires collés au titre par l'extraction (« , il a été voté… », « La CAEF adopte… »).
 * Le titre est coupé juste avant.
 */
const QUEUES = [
  /,\s*(il|elle) (a|ont) été .*/i,
  /\s+a été adopté.*/i,
  /,\s*c[’']est .*/i,
  /,\s*la (Commission|Présidente|CAEF) .*/i,
  /\s+La (CAEF|Commission) .*/,
  /,\s*le nouveau texte.*/i,
  /,\s*dispositions qu.*/i,
  /,\s*conformément .*/i,
  /\s+poursuivra .*/i,
  /\s+contribue .*/i,
  /\s+est déposée? .*/i,
  /\s*\(…\)\s*$/,
  /\s*…\s*$/,
  /\s*\|\s*Sénat de Côte d['’]Ivoire\s*$/i,
  new RegExp(`\\s*\\|?\\s*\\d{1,2}\\s+(${MOIS})\\s+\\d{4}\\s*$`, "i"), // « | 04 juin 2024 » ajouté à la fin
  /\s*\/\d{2}-\d{2}-\d{2}\s*$/, // « /14-06-19 »
];

/** Titre en capitales (« INSTITUANT CODE DE … ») ramené en casse de phrase, sigles conservés. */
function decapitaliser(titre: string): string {
  return titre.replace(/\b([A-ZÀ-ÖØ-Ý’']{2,}(?:\s+[A-ZÀ-ÖØ-Ý’']{2,}){2,})\b/g, (bloc) =>
    bloc.toLowerCase().replace(/\b(etat|état)\b/g, "État"),
  );
}

export function nettoyerTitre(brut: string): string {
  let t = brut.replace(/\s+/g, " ").trim();
  let avant = "";
  while (avant !== t) {
    avant = t;
    for (const q of QUEUES) t = t.replace(q, "").trim();
  }
  t = decapitaliser(t).replace(/\s+([,;])/g, "$1").replace(/[,;:\s]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ------------------------------------------------------------------ Classement */

/** Phrases de procédure (règlement, guide de la procédure) prises à tort pour des textes. */
const PROCEDURE = [
  /de l[’']année ou d[’']un/i,
  /\bd[’']un traité ou d[’']un accord\b/i,
  /autorisant sa ratification/i,
  /\b(doit|peut|ne peut|n[’']a pu)\b/i,
  /\bn\s*\+\s*1\b/i,
];

/** Signes d'un titre mélangé avec le texte voisin (colonnes d'un PDF lues d'un seul tenant). */
const MELANGE = [
  /\b(OUVERTURE|SILA|HAUTES PERSONN)/,
  /\bMadame\b|\bMonsieur\b/,
  /session ordinaire/i,
  /avec lesquelles vous|nos différentes/i,
  /par un vote/i,
  /mais également/i,
  /sur le de déontologie|processus de révision/i,
  /\(CASC\) a reçu|a reçu, le/i,
  /traduisant l[’']engagement|très haute autorité/i,
  /à la n°\d|portant création, HAUTES/i,
  /\bil convient\b/i,
];

/** Fin de titre manifestement coupée. */
const FIN_COUPEE = new RegExp(
  `(\\b(de|du|des|la|le|les|à|au|aux|et|en|pour|portant|relatif|relative|l[’']ordonnance|l[’']année|code)|\\b[dl][’']|\\bdu \\d{1,2} (${MOIS}))$`,
  "i",
);

export type Classe = "candidat" | "titre_a_corriger" | "ecarte";

export interface Classement {
  classe: Classe;
  raisons: string[];
}

const SOURCE_GENERIQUE = /(^https?:\/\/[^/]+\/?$)|reglement|procedure-legislative|rapport|symposium/i;

export const estSourceGenerique = (url: string) => SOURCE_GENERIQUE.test(url);

export function classer(titreNettoye: string, sources: { url: string }[]): Classement {
  if (PROCEDURE.some((r) => r.test(titreNettoye)) || (sources.length > 0 && sources.every((s) => /reglement|procedure-legislative/i.test(s.url)))) {
    return { classe: "ecarte", raisons: ["phrase de procédure (règlement ou guide), pas un texte déposé"] };
  }
  const raisons: string[] = [];
  if (MELANGE.some((r) => r.test(titreNettoye))) raisons.push("titre mélangé avec un texte voisin");
  if (FIN_COUPEE.test(titreNettoye)) raisons.push("titre incomplet");
  const objet = normaliser(titreNettoye).replace(/^(projet|proposition) de loi( organique)? |^loi /, "");
  if (objet.split(" ").length < 3) raisons.push("titre trop court pour être l'intitulé complet");
  return { classe: raisons.length ? "titre_a_corriger" : "candidat", raisons };
}

/* ------------------------------------------------------------------ Dates */

/** Ordonnance ratifiée : numéro « AAAA-NNN » et date si le titre la donne en entier. */
export function ordonnanceCitee(titre: string): { numero: string; date: string | null } | null {
  const m = titre.match(/ordonnance\s+n\s*°\s*(\d{4})\s*-\s*(\d+)/i);
  if (!m) return null;
  const apres = titre.slice((m.index ?? 0) + m[0].length);
  const d = apres.match(new RegExp(`^\\s*du\\s+(\\d{1,2})(?:er)?\\s+(${MOIS})\\s+(\\d{4})`, "i"));
  let date: string | null = null;
  if (d) {
    const mois = MOIS_NUM[normaliser(d[2]!)];
    if (mois) date = `${d[3]}-${String(mois).padStart(2, "0")}-${d[1]!.padStart(2, "0")}`;
  }
  return { numero: `${m[1]}-${Number(m[2])}`, date };
}

/** Incohérences de date repérées sur une ligne (jamais corrigées : seulement signalées). */
export function alertesDate(titre: string, date: string | null, aujourdhui: string): string[] {
  if (!date) return [];
  const alertes: string[] = [];
  if (date > aujourdhui) alertes.push(`date ${date} dans le futur`);
  if (date < "1990-01-01") alertes.push(`date ${date} invraisemblable`);
  const ord = ordonnanceCitee(titre);
  if (ord?.date && date < ord.date) alertes.push(`date ${date} antérieure à l'ordonnance ratifiée (${ord.date})`);
  else if (ord && !ord.date && date.slice(0, 4) < ord.numero.slice(0, 4)) {
    alertes.push(`date ${date} antérieure à l'année de l'ordonnance n° ${ord.numero}`);
  }
  return alertes;
}

/* ------------------------------------------------------------------ Correspondance avec le schéma LoiCI */

/** Statuts de l'extraction → statuts LoiCI. Une correspondance approximative est signalée. */
const STATUTS: Record<string, { statut: string; note?: string }> = {
  depose: { statut: "depose" },
  en_commission: { statut: "en_commission" },
  adopte_assemblee: { statut: "adopte_en_pleniere", note: "« adopté à l'Assemblée » : vérifier s'il s'agit de la plénière" },
  adopte_parlement: { statut: "adopte_definitivement", note: "« adopté par le Parlement » : vérifier l'adoption par les deux chambres" },
  promulgue: { statut: "promulgue" },
  rejete: { statut: "rejete" },
  retire: { statut: "retire" },
};

/** Ordre du parcours, pour présenter les statuts observés du moins au plus avancé. */
const ORDRE = ["depose", "en_commission", "adopte_en_commission", "adopte_en_pleniere", "au_senat", "adopte_definitivement", "promulgue", "rejete", "retire"];

export function typePropose(ligne: Pick<LigneExtraite, "type" | "nature" | "titre_officiel">): string {
  if (ligne.nature === "ratification_ordonnance" || /ratifi\w* (de )?l[’']ordonnance/i.test(ligne.titre_officiel)) {
    return "projet_de_loi_ratification_ordonnance";
  }
  return ligne.type === "proposition_de_loi" ? "proposition_de_loi" : "projet_de_loi";
}

export function naturePropose(nature: string | null | undefined): string | null {
  return nature && ["ordinaire", "organique", "constitutionnelle", "finances"].includes(nature) ? nature : null;
}

const CHAMBRES: Record<string, string> = { an: "assemblee_nationale", senat: "senat" };

/* ------------------------------------------------------------------ Regroupement */

export interface Observation {
  titre_brut: string;
  statut_extrait: string | null;
  statut_loici: string | null;
  date: string | null;
  chambre: string | null;
  fiabilite: string | null;
  alertes: string[];
}

export interface Candidat {
  cle: string;
  titre: string;
  classe: Classe;
  raisons: string[];
  type_propose: string;
  nature_proposee: string | null;
  numero_loi: string | null;
  date_promulgation: string | null;
  statuts_observes: string[];
  /** Points à vérifier qui n'empêchent pas la saisie (statut approximatif, regroupement). */
  notes: string[];
  observations: Observation[];
  sources: { url: string; generique: boolean; format: string | null }[];
  /** Fiche LoiCI existante au titre équivalent : à compléter plutôt qu'à recréer. */
  deja_recense: string | null;
}

/**
 * Clé de regroupement : numéro de l'ordonnance ratifiée (le titre court et le titre long sont le même texte),
 * sinon le titre normalisé.
 */
export function cleDeGroupe(titreNettoye: string): string {
  const ord = ordonnanceCitee(titreNettoye);
  if (ord) return `ordonnance-${ord.numero}`;
  return normaliser(titreNettoye);
}

/** Verse `source` dans `cible` (observations, sources, statuts) et retire `source` des groupes. */
function fusionner(cible: Candidat, source: Candidat, groupes: Map<string, Candidat>) {
  cible.observations.push(...source.observations);
  for (const s of source.sources) if (!cible.sources.some((x) => x.url === s.url)) cible.sources.push(s);
  for (const st of source.statuts_observes) if (!cible.statuts_observes.includes(st)) cible.statuts_observes.push(st);
  for (const no of source.notes) if (!cible.notes.includes(no)) cible.notes.push(no);
  cible.numero_loi ??= source.numero_loi;
  cible.date_promulgation ??= source.date_promulgation;
  groupes.delete(source.cle);
}

/** Part de mots significatifs communs à deux titres normalisés (0 à 1), pour repérer un texte déjà recensé. */
export function ressemblance(a: string, b: string): number {
  const mots = (t: string) => new Set(t.split(" ").filter((m) => m.length > 3 || /\d/.test(m)));
  const A = mots(a);
  const B = mots(b);
  if (!A.size || !B.size) return 0;
  // Deux titres aux nombres différents (années, numéros d'ordonnance) ne désignent jamais le même texte.
  const nombres = (m: Set<string>) => [...m].filter((x) => /^\d+$/.test(x)).sort().join(" ");
  if (nombres(A) !== nombres(B)) return 0;
  const communs = [...A].filter((m) => B.has(m)).length;
  return communs / Math.max(A.size, B.size);
}

export function regrouper(
  lignes: LigneExtraite[],
  textesExistants: { id: string; titre_officiel: string }[],
  aujourdhui: string,
): Candidat[] {
  const groupes = new Map<string, Candidat>();

  for (const l of lignes) {
    const titre = nettoyerTitre(l.titre_officiel);
    const cle = cleDeGroupe(titre);
    const conv = l.statut ? STATUTS[l.statut] : undefined;
    const date = l.date_derniere_etape ?? null;
    const obs: Observation = {
      titre_brut: l.titre_officiel,
      statut_extrait: l.statut ?? null,
      statut_loici: conv?.statut ?? null,
      date,
      chambre: l.chambre_depot ? (CHAMBRES[l.chambre_depot] ?? null) : null,
      fiabilite: l.fiabilite ?? null,
      alertes: [
        ...alertesDate(titre, date, aujourdhui),
        ...(l.statut && !conv ? [`statut inconnu « ${l.statut} »`] : []),
      ],
    };
    let g = groupes.get(cle);
    if (!g) {
      g = {
        cle,
        titre,
        classe: "candidat",
        raisons: [],
        type_propose: typePropose(l),
        nature_proposee: naturePropose(l.nature),
        numero_loi: null,
        date_promulgation: null,
        statuts_observes: [],
        notes: [],
        observations: [],
        sources: [],
        deja_recense: null,
      };
      groupes.set(cle, g);
    }
    // Le titre le plus complet l'emporte, sauf s'il est mélangé avec un texte voisin.
    if (classer(titre, l.sources).classe !== "titre_a_corriger" && (classer(g.titre, []).classe !== "candidat" || titre.length > g.titre.length)) {
      g.titre = titre;
    }
    g.observations.push(obs);
    if (l.numero_loi) g.numero_loi ??= l.numero_loi;
    if (l.date_promulgation) g.date_promulgation ??= l.date_promulgation;
    if (conv && !g.statuts_observes.includes(conv.statut)) g.statuts_observes.push(conv.statut);
    if (conv?.note && !g.notes.includes(conv.note)) g.notes.push(conv.note);
    g.nature_proposee ??= naturePropose(l.nature);
    for (const s of l.sources) {
      if (g.sources.some((x) => x.url === s.url)) continue;
      g.sources.push({ url: s.url, generique: estSourceGenerique(s.url), format: s.type_document === "pdf" ? "pdf" : s.type_document ? "page_web" : null });
    }
  }

  // Un titre coupé qui est le début d'UN SEUL autre titre est fusionné avec lui ; s'il en commence plusieurs, il reste ambigu.
  const liste = [...groupes.values()];
  for (const court of liste) {
    const n = normaliser(court.titre);
    if (n.split(" ").length < 4) continue;
    const longs = liste.filter((g) => g !== court && groupes.has(g.cle) && normaliser(g.titre).length > n.length && normaliser(g.titre).startsWith(n));
    if (longs.length === 1 && groupes.has(court.cle)) {
      fusionner(longs[0]!, court, groupes);
    } else if (longs.length > 1) {
      court.raisons.push(`titre incomplet, commun à ${longs.length} textes`);
    }
  }

  // Quasi-doublons (accord, sigle ajouté…) : fusionnés, mais signalés pour vérification.
  const restants = [...groupes.values()];
  for (let i = 0; i < restants.length; i++) {
    const a = restants[i]!;
    if (!groupes.has(a.cle)) continue;
    for (const b of restants.slice(i + 1)) {
      if (!groupes.has(b.cle) || a.type_propose !== b.type_propose) continue;
      if (ressemblance(normaliser(a.titre), normaliser(b.titre)) < 0.85) continue;
      fusionner(b.titre.length > a.titre.length ? b : a, b.titre.length > a.titre.length ? a : b, groupes);
      const garde = groupes.has(a.cle) ? a : b;
      const note = "titres voisins regroupés : vérifier qu'il s'agit bien du même texte";
      if (!garde.notes.includes(note)) garde.notes.push(note);
      if (!groupes.has(a.cle)) break;
    }
  }

  const existants = textesExistants.map((t) => ({ id: t.id, n: normaliser(t.titre_officiel) }));
  const resultat = [...groupes.values()].map((g) => {
    const c = classer(g.titre, g.sources);
    g.classe = g.raisons.length && c.classe === "candidat" ? "titre_a_corriger" : c.classe;
    g.raisons = [...new Set([...c.raisons, ...g.raisons])];
    g.statuts_observes.sort((a, b) => ORDRE.indexOf(a) - ORDRE.indexOf(b));
    const n = normaliser(g.titre);
    g.deja_recense = existants.find((e) => e.n === n || ressemblance(e.n, n) >= 0.8)?.id ?? null;
    return g;
  });

  // Plusieurs variantes d'un texte déjà recensé : une seule entrée, rattachée à la fiche existante.
  for (const g of [...resultat]) {
    if (!g.deja_recense) continue;
    const premier = resultat.find((x) => x.deja_recense === g.deja_recense)!;
    if (premier === g) continue;
    fusionner(premier, g, groupes);
    resultat.splice(resultat.indexOf(g), 1);
  }

  const rang: Record<Classe, number> = { candidat: 0, titre_a_corriger: 1, ecarte: 2 };
  return resultat.sort(
    (a, b) =>
      rang[a.classe] - rang[b.classe] ||
      Number(a.sources.every((s) => s.generique)) - Number(b.sources.every((s) => s.generique)) ||
      a.titre.localeCompare(b.titre, "fr"),
  );
}
