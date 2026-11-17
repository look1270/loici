/**
 * Texte législatif et tout ce qui lui est propre : acteurs, étapes, votes, révisions.
 * Fichier : donnees/textes/<id>.json — UN fichier par texte, pour qu'une contribution
 * (« ajouter une loi ») tienne dans une seule pull request lisible.
 *
 * Chaque sous-entité (étape, vote, révision, acteur) porte ses propres source_ids :
 * un vote peut venir d'un communiqué de l'Assemblée, une étape du Journal officiel, etc.
 *
 * Principe anti-incohérence : une information n'est saisie qu'à UN endroit.
 * La date et la chambre de dépôt, la date de promulgation et les commissions saisies
 * se déduisent des étapes ; elles ne sont donc pas des champs du texte.
 */
import { z } from "zod";
import { chambre, dateIso, empreinteSha256, identifiant, identifiantsUniques, libelle, sourceIds } from "./communs";
import { ROLES_ACTEUR, STATUTS } from "./statuts";

/* ------------------------------------------------------------------ Énumérations */

export const typeTexte = z.enum([
  "projet_de_loi", // initiative du Gouvernement
  "proposition_de_loi", // initiative parlementaire
  "projet_de_loi_ratification_ordonnance", // initiative du Gouvernement
]);

/** Genre d'auteur attendu pour chaque type de texte. */
const AUTEUR_ATTENDU: Record<z.infer<typeof typeTexte>, "gouvernement" | "parlementaire"> = {
  projet_de_loi: "gouvernement",
  proposition_de_loi: "parlementaire",
  projet_de_loi_ratification_ordonnance: "gouvernement",
};

/**
 * Forme de l'acte. Une loi suit un parcours au Parlement (type d'initiative, statut, étapes) ;
 * une ordonnance ou un décret est signé par l'exécutif : ni initiative parlementaire ni statut de parcours.
 * Un acte uniforme est adopté au niveau de l'OHADA (date_signature = date d'adoption, reference_jo = JO de l'OHADA).
 * Un code est une loi (ex. la loi portant Code pénal) : il se range en sous-catégorie.
 */
export const acte = z.enum(["loi", "ordonnance", "decret", "acte_uniforme"]);
export type Acte = z.infer<typeof acte>;
const ACTE_SINGULIER: Record<Acte, string> = { loi: "Une loi", ordonnance: "Une ordonnance", decret: "Un décret", acte_uniforme: "Un acte uniforme" };

/** État de vigueur, seulement si une source le dit (sinon `vigueur` vaut null : « Non renseigné »). */
export const etatVigueur = z.enum(["en_vigueur", "modifie", "abroge"]);

/** Lien vers un autre texte : celui qu'il modifie, abroge, complète, ratifie ou dont il est le décret d'application. */
export const relationTexte = z.enum(["modifie", "abroge", "complete", "ratifie", "applique"]);

export const texteLie = z.strictObject({
  relation: relationTexte,
  /** Fiche LoiCI du texte visé ; null s'il n'est pas (encore) recensé. */
  texte_id: identifiant.nullable(),
  /** Intitulé du texte visé, recopié de la source. Ex. « loi n° 2018-975 du 27 décembre 2018 portant Code de procédure pénale ». */
  intitule: libelle(5, 600),
  source_ids: sourceIds,
});

/** Publication au Journal officiel, telle qu'indiquée par la source (ex. index du CNDJ). */
export const referenceJo = z.strictObject({
  /** Numéro du Journal officiel. Ex. « 76 » ou « spécial n° 10 » ; null si la source ne donne que la date. */
  numero: libelle(1, 50).nullable(),
  date: dateIso.nullable(),
  /** Page de début. Ex. « 1892 ». */
  page: libelle(1, 20).nullable(),
  source_ids: sourceIds,
});

/** Nature juridique ; null si la source ne la précise pas. Liste à valider (voir questions). */
export const natureTexte = z.enum(["ordinaire", "organique", "constitutionnelle", "finances"]);

/** Statuts : la liste fait foi dans ./statuts (fichier sans Zod, partagé avec le site). */
export const statutTexte = z.enum(STATUTS);
export type StatutTexte = z.infer<typeof statutTexte>;

/** Statuts qui supposent un vote favorable : incompatibles avec un vote « rejete » sur la même étape. */
const STATUTS_ADOPTION: StatutTexte[] = ["adopte_en_commission", "adopte_en_pleniere", "adopte_definitivement"];

/* ------------------------------------------------------------------ Acteurs */

/** Qui agit : un parlementaire (fiche liée) ou le Gouvernement (ministre porteur). */
export const acteur = z.discriminatedUnion("genre", [
  z.strictObject({
    genre: z.literal("parlementaire"),
    parlementaire_id: identifiant,
  }),
  z.strictObject({
    genre: z.literal("gouvernement"),
    /** Nom du ministre tel qu'écrit par la source ; null si non cité. */
    ministre: libelle(2, 150).nullable(),
    /** Intitulé exact du ministère à la date du texte. */
    ministere: libelle(2, 300).nullable(),
  }),
]);

/** Lien texte ↔ acteur (entité « texte_acteur » du cahier des charges). */
export const texteActeur = z
  .strictObject({
    role: z.enum(ROLES_ACTEUR),
    acteur,
    /** Pour un rapporteur : la commission saisie. null pour les autres rôles. */
    commission_id: identifiant.nullable(),
    source_ids: sourceIds,
  })
  .refine((a) => a.role === "auteur" || a.acteur.genre === "parlementaire", {
    message: "Seul l'auteur peut être le Gouvernement ; rapporteur et cosignataire sont des parlementaires",
    path: ["acteur"],
  })
  .refine((a) => a.role === "rapporteur" || a.commission_id === null, {
    message: "Seul un rapporteur est rattaché à une commission",
    path: ["commission_id"],
  });

/* ------------------------------------------------------------------ Votes et étapes */

/** Résultat agrégé d'un vote. Chaque décompte inconnu reste null. */
export const vote = z
  .strictObject({
    resultat: z.enum(["adopte", "rejete"]),
    pour: z.int().nonnegative().nullable(),
    contre: z.int().nonnegative().nullable(),
    abstention: z.int().nonnegative().nullable(),
    votants: z.int().nonnegative().nullable(),
    /** true seulement si la source écrit « à l'unanimité ». */
    unanimite: z.boolean().nullable(),
    source_ids: sourceIds,
  })
  // « À l'unanimité » exclut toute voix contre.
  .refine((v) => v.unanimite !== true || v.contre === null || v.contre === 0, {
    message: "Vote à l'unanimité avec des voix contre",
    path: ["contre"],
  })
  // Quelle que soit la majorité requise, un texte adopté a plus de voix pour que contre.
  // (L'inverse n'est pas vérifié : un texte peut être rejeté faute de majorité qualifiée.)
  .refine((v) => v.resultat !== "adopte" || v.pour === null || v.contre === null || v.pour > v.contre, {
    message: "Texte « adopté » avec moins de voix pour que contre",
    path: ["resultat"],
  })
  // Aucun décompte ne peut dépasser le nombre de votants.
  .refine(
    (v) => v.votants === null || [v.pour, v.contre, v.abstention].every((n) => n === null || n <= v.votants!),
    { message: "Un décompte dépasse le nombre de votants", path: ["votants"] },
  );

/** Où se passe l'étape. */
export const organe = z.enum([
  "gouvernement", // ex. adoption en Conseil des ministres
  "bureau", // dépôt / transmission
  "commission",
  "pleniere",
  "conseil_constitutionnel",
  "presidence", // promulgation
]);

/** Organes situés au Parlement : ils exigent une chambre ; les autres n'en ont pas. */
const ORGANES_PARLEMENTAIRES = ["bureau", "commission", "pleniere"] as const;

export const etape = z
  .strictObject({
    id: identifiant,
    date: dateIso.nullable(),
    /**
     * Statut atteint à l'issue de l'étape.
     * null = étape informative qui ne change pas le statut (ex. Conseil des ministres, transmission).
     */
    statut: statutTexte.nullable(),
    /** Obligatoire au Parlement (bureau, commission, plénière) ; null ailleurs. */
    chambre: chambre.nullable(),
    organe,
    /** Uniquement pour une étape en commission. */
    commission_id: identifiant.nullable(),
    /** Description factuelle courte. Ex. « Examen et adoption en commission ». */
    libelle: libelle(3, 300),
    /** Uniquement en commission ou en plénière. */
    vote: vote.nullable(),
    source_ids: sourceIds,
  })
  .superRefine((e, ctx) => {
    const auParlement = (ORGANES_PARLEMENTAIRES as readonly string[]).includes(e.organe);
    if (auParlement && e.chambre === null) {
      ctx.addIssue({ code: "custom", message: "Une étape au Parlement doit préciser la chambre", path: ["chambre"] });
    }
    if (!auParlement && e.chambre !== null) {
      ctx.addIssue({ code: "custom", message: "Une étape hors Parlement n'a pas de chambre", path: ["chambre"] });
    }
    if (e.organe !== "commission" && e.commission_id !== null) {
      ctx.addIssue({ code: "custom", message: "commission_id réservé aux étapes en commission", path: ["commission_id"] });
    }
    if (e.vote !== null && e.organe !== "commission" && e.organe !== "pleniere") {
      ctx.addIssue({ code: "custom", message: "Un vote n'a lieu qu'en commission ou en plénière", path: ["vote"] });
    }
    if (e.vote?.resultat === "rejete" && e.statut !== null && STATUTS_ADOPTION.includes(e.statut)) {
      ctx.addIssue({ code: "custom", message: "Statut d'adoption alors que le vote est un rejet", path: ["statut"] });
    }
    if (e.vote?.resultat === "adopte" && e.statut === "rejete") {
      ctx.addIssue({ code: "custom", message: "Statut « rejete » alors que le vote est une adoption", path: ["statut"] });
    }
  });

/* ------------------------------------------------------------------ Révisions */

/**
 * Révision : un amendement ou une nouvelle version du texte.
 * Les extraits avant/après sont des citations COURTES (article concerné), jamais le document entier
 * (règle n° 3). Voir la question ouverte sur ce point.
 */
export const revision = z
  .strictObject({
    id: identifiant,
    type: z.enum(["amendement", "version"]),
    /** Numéro d'amendement ou de version tel qu'indiqué par la source. */
    numero: libelle(1, 50).nullable(),
    date: dateIso.nullable(),
    /** Étape au cours de laquelle la révision a eu lieu (référence à etapes[].id). */
    etape_id: identifiant.nullable(),
    auteur: acteur.nullable(),
    /** Ex. « Article 12, alinéa 2 ». */
    article_vise: libelle(1, 150).nullable(),
    /** Résumé factuel de la modification. */
    description: libelle(10, 600),
    extrait_avant: z.string().trim().min(1).max(1500).nullable(),
    extrait_apres: z.string().trim().min(1).max(1500).nullable(),
    /** Sort d'un amendement ; null pour une version ou si inconnu. */
    sort: z.enum(["adopte", "rejete", "retire"]).nullable(),
    /** Empreinte du PDF de cette version (détection automatique des changements). */
    empreinte_sha256: empreinteSha256.nullable(),
    source_ids: sourceIds,
  })
  .refine((r) => r.type === "amendement" || r.sort === null, {
    message: "Le champ « sort » ne concerne que les amendements",
    path: ["sort"],
  })
  // Une empreinte identifie un document complet : elle ne concerne que les versions.
  .refine((r) => r.type === "version" || r.empreinte_sha256 === null, {
    message: "L'empreinte ne concerne que les versions, pas les amendements",
    path: ["empreinte_sha256"],
  });

/* ------------------------------------------------------------------ Texte */

export const texte = z
  .strictObject({
    id: identifiant,
    acte,
    /** Intitulé tel que la source l'écrit (pour une loi : celui du projet ou de la proposition). */
    titre_officiel: libelle(10, 600),
    /** Numéro de dépôt attribué par la chambre ; null si non publié. */
    numero_depot: libelle(1, 50).nullable(),
    /** Initiative d'une loi ; null pour une ordonnance ou un décret. */
    type: typeTexte.nullable(),
    nature: natureTexte.nullable(),
    /**
     * Statut du parcours d'une loi ; doit égaler le statut de la dernière étape qui en porte un (vérifié ci-dessous).
     * null pour une ordonnance ou un décret, qui n'ont pas de parcours parlementaire.
     */
    statut: statutTexte.nullable(),
    legislature_id: identifiant.nullable(),
    /** Résumé neutre de 3 à 5 lignes (≈ 150 à 700 caractères), sans adjectif évaluatif ; null = « Résumé à rédiger ». */
    resume: z.string().trim().min(150).max(700).nullable(),
    /** Encadré « En bref » en langage courant, rédigé uniquement à partir du texte source ; null = « Explication à rédiger ». */
    explication: z.string().trim().min(100).max(700).nullable(),
    themes: identifiantsUniques,
    /** Catégorie de l'accueil (donnees/referentiels/categories.json) ; null = « Autres textes ». */
    categorie_id: identifiant.nullable(),
    /** Sous-catégorie de cette catégorie ; null si aucune ne convient. */
    sous_categorie_id: identifiant.nullable(),
    /** « Loi n° … » ; uniquement si le texte est promulgué (null sinon, ou si inconnu). */
    numero_loi: libelle(3, 50).nullable(),
    /** Titre exact de la loi promulguée, recopié de sa source ; uniquement si le texte est promulgué. */
    titre_loi: libelle(10, 600).nullable(),
    /** Numéro d'une ordonnance ou d'un décret. Ex. « 2026-430 ». null pour une loi (voir numero_loi). */
    numero_acte: libelle(1, 50).nullable(),
    /** Date de signature d'une ordonnance ou d'un décret. null pour une loi (sa date vient des étapes). */
    date_signature: dateIso.nullable(),
    reference_jo: referenceJo.nullable(),
    vigueur: z.strictObject({ etat: etatVigueur, source_ids: sourceIds }).nullable(),
    textes_lies: z.array(texteLie),
    /** Source ouverte par « Lire plus » : PDF du projet ou Journal officiel. Doit figurer dans source_ids. */
    document_principal_source_id: identifiant,
    acteurs: z.array(texteActeur),
    /** Frise chronologique, dans l'ordre. Au moins une pour une loi (vérifié ci-dessous). */
    etapes: z.array(etape),
    revisions: z.array(revision),
    /** Sources du texte lui-même (titre, numéro, résumé…). */
    source_ids: sourceIds,
    /** Dernière mise à jour de la fiche. */
    mis_a_jour_le: dateIso,
  })
  .superRefine((t, ctx) => {
    const signaler = (message: string, path: (string | number)[]) => ctx.addIssue({ code: "custom", message, path });

    // 0. Ce qui dépend de la forme de l'acte : parcours parlementaire pour une loi, signature pour le reste.
    if (t.acte === "loi") {
      // type null = initiative inconnue : une loi connue par le seul Journal officiel ne dit pas si elle vient d'un projet ou d'une proposition.
      if (t.statut === null) signaler("Une loi a un statut de parcours", ["statut"]);
      if (t.etapes.length === 0) signaler("Au moins une étape est requise pour une loi", ["etapes"]);
      if (t.numero_acte !== null) signaler("Le numéro d'une loi s'écrit dans numero_loi", ["numero_acte"]);
      if (t.date_signature !== null) signaler("La date d'une loi se déduit de ses étapes (promulgation)", ["date_signature"]);
    } else {
      if (t.type !== null) signaler(`${ACTE_SINGULIER[t.acte]} n'a pas d'initiative parlementaire`, ["type"]);
      if (t.statut !== null) signaler("Seule une loi a un statut de parcours parlementaire", ["statut"]);
      if (t.numero_loi !== null) signaler("numero_loi est réservé aux lois (voir numero_acte)", ["numero_loi"]);
      if (t.titre_loi !== null) signaler("titre_loi est réservé aux lois", ["titre_loi"]);
    }

    // 0 bis. Une sous-catégorie n'existe qu'à l'intérieur d'une catégorie (appartenance vérifiée dans les contrôles croisés).
    if (t.sous_categorie_id !== null && t.categorie_id === null) {
      signaler("Sous-catégorie sans catégorie", ["sous_categorie_id"]);
    }

    // 1. Identifiants d'étapes et de révisions uniques dans le texte.
    const idsEtapes = t.etapes.map((e) => e.id);
    if (new Set(idsEtapes).size !== idsEtapes.length) signaler("Identifiant d'étape en double", ["etapes"]);
    const idsRevisions = t.revisions.map((r) => r.id);
    if (new Set(idsRevisions).size !== idsRevisions.length) signaler("Identifiant de révision en double", ["revisions"]);

    // 2. Une révision ne peut pointer que vers une étape existante.
    t.revisions.forEach((r, i) => {
      if (r.etape_id === null) return;
      const etapeLiee = t.etapes.find((e) => e.id === r.etape_id);
      if (!etapeLiee) signaler(`Étape inconnue : ${r.etape_id}`, ["revisions", i, "etape_id"]);
    });

    // 3. Les dates connues des étapes vont dans l'ordre chronologique et ne dépassent pas la date de mise à jour.
    let datePrecedente: string | null = null;
    t.etapes.forEach((e, i) => {
      if (e.date === null) return;
      if (datePrecedente !== null && e.date < datePrecedente) signaler("Étapes hors de l'ordre chronologique", ["etapes", i, "date"]);
      if (e.date > t.mis_a_jour_le) signaler("Étape datée après la mise à jour de la fiche", ["etapes", i, "date"]);
      datePrecedente = e.date;
    });

    // 4. Le statut affiché est celui de la dernière étape qui en porte un (aucun statut sans étape sourcée).
    const etapesAvecStatut = t.etapes.filter((e) => e.statut !== null);
    const dernierStatut = etapesAvecStatut.at(-1)?.statut;
    if (t.acte === "loi" && dernierStatut !== t.statut) {
      signaler(`Statut « ${t.statut} » incohérent avec la dernière étape (« ${dernierStatut ?? "aucun"} »)`, ["statut"]);
    }

    // 5. Un texte définitivement sorti du parcours ne connaît plus d'étape après sa sortie.
    const indexPromulgation = t.etapes.findIndex((e) => e.statut === "promulgue" || e.statut === "retire");
    if (indexPromulgation !== -1 && etapesAvecStatut.at(-1) !== t.etapes[indexPromulgation]) {
      signaler("Changement de statut après une promulgation ou un retrait", ["etapes", indexPromulgation]);
    }

    // 6. Le numéro de loi n'existe qu'une fois la loi promulguée.
    if (t.acte === "loi" && t.numero_loi !== null && t.statut !== "promulgue") {
      signaler("Numéro de loi renseigné alors que le texte n'est pas promulgué", ["numero_loi"]);
    }
    if (t.titre_loi !== null && t.statut !== "promulgue") {
      signaler("Titre de loi renseigné alors que le texte n'est pas promulgué", ["titre_loi"]);
    }

    // 7. Auteur du bon genre selon le type de texte (ordonnance et décret : le Gouvernement ; acte uniforme : non contrôlé).
    //    Obligatoire quand l'initiative est connue ; une loi d'initiative inconnue peut n'avoir aucun auteur cité.
    const auteurs = t.acteurs.filter((a) => a.role === "auteur");
    if (auteurs.length === 0 && t.type !== null) signaler("Au moins un acteur de rôle « auteur » est requis", ["acteurs"]);
    const genreAttendu = t.type !== null ? AUTEUR_ATTENDU[t.type] : t.acte === "loi" || t.acte === "acte_uniforme" ? null : "gouvernement";
    t.acteurs.forEach((a, i) => {
      if (a.role === "auteur" && genreAttendu !== null && a.acteur.genre !== genreAttendu) {
        signaler(`Un texte de type « ${t.type ?? t.acte} » a pour auteur : ${genreAttendu}`, ["acteurs", i, "acteur"]);
      }
    });

    // 8. Le Gouvernement n'est cité qu'une fois comme auteur ; un parlementaire n'a qu'un rôle par texte.
    if (auteurs.filter((a) => a.acteur.genre === "gouvernement").length > 1) {
      signaler("Le Gouvernement est cité plusieurs fois comme auteur", ["acteurs"]);
    }
    const cles = t.acteurs
      .filter((a) => a.acteur.genre === "parlementaire")
      .map((a) => `${a.role}:${a.acteur.genre === "parlementaire" ? a.acteur.parlementaire_id : ""}`);
    if (new Set(cles).size !== cles.length) signaler("Même parlementaire cité deux fois avec le même rôle", ["acteurs"]);

    // 9. « Lire plus » ouvre une source qui fait partie des sources du texte.
    if (!t.source_ids.includes(t.document_principal_source_id)) {
      signaler("document_principal_source_id doit aussi figurer dans source_ids", ["document_principal_source_id"]);
    }
  });

/* ------------------------------------------------------------------ Valeurs déduites */

/** Première étape d'un statut donné (sert à déduire date et chambre de dépôt, date de promulgation). */
export const premiereEtape = (t: Texte, statut: StatutTexte) => t.etapes.find((e) => e.statut === statut) ?? null;

/** Date de dépôt déduite de l'étape « depose » ; null si inconnue. */
export const dateDepot = (t: Texte) => premiereEtape(t, "depose")?.date ?? null;

/** Chambre de dépôt déduite de l'étape « depose » ; null si inconnue. */
export const chambreDepot = (t: Texte) => premiereEtape(t, "depose")?.chambre ?? null;

/** Date de promulgation déduite de l'étape « promulgue » ; null si inconnue. */
export const datePromulgation = (t: Texte) => premiereEtape(t, "promulgue")?.date ?? null;

/** Commissions saisies, déduites des étapes et des rapporteurs (pour le filtre « commission »). */
export const commissionsSaisies = (t: Texte) => [
  ...new Set(
    [...t.etapes.map((e) => e.commission_id), ...t.acteurs.map((a) => a.commission_id)].filter(
      (id): id is string => id !== null,
    ),
  ),
];

export type Texte = z.infer<typeof texte>;
export type Etape = z.infer<typeof etape>;
export type Vote = z.infer<typeof vote>;
export type Revision = z.infer<typeof revision>;
export type TexteActeur = z.infer<typeof texteActeur>;
export type TexteLie = z.infer<typeof texteLie>;
