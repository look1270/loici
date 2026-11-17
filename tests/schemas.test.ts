/**
 * Tests des schémas.
 * ATTENTION : les données ci-dessous sont FACTICES et servent uniquement aux tests.
 * Elles ne décrivent aucun texte réel et ne doivent jamais être copiées dans donnees/.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parlementaire, source, texte, vote } from "../schemas";

const URL_FACTICE = "https://assnat.ci/exemple-factice.pdf";

const sourceValide = {
  id: "src-factice",
  url: URL_FACTICE,
  titre: "Document factice de test",
  nom: "Assemblée nationale",
  type: "officielle",
  format: "pdf",
  date_publication: "2025-01-05",
  date_consultation: "2025-02-01",
  url_archive: `https://web.archive.org/web/20250201120000/${URL_FACTICE}`,
  empreinte_sha256: "a".repeat(64),
};

const etapeDepot = {
  id: "depot",
  date: "2025-01-10",
  statut: "depose",
  chambre: "assemblee_nationale",
  organe: "bureau",
  commission_id: null,
  libelle: "Dépôt factice",
  vote: null,
  source_ids: ["src-factice"],
};

const texteValide = {
  id: "texte-factice",
  acte: "loi",
  titre_officiel: "Projet de loi factice servant aux tests",
  numero_depot: null,
  type: "projet_de_loi",
  nature: null,
  statut: "depose",
  legislature_id: null,
  resume: "Résumé factice. ".repeat(12),
  themes: [],
  numero_loi: null,
  explication: null,
  categorie_id: null,
  sous_categorie_id: null,
  titre_loi: null,
  numero_acte: null,
  date_signature: null,
  reference_jo: null,
  vigueur: null,
  textes_lies: [],
  document_principal_source_id: "src-factice",
  acteurs: [
    {
      role: "auteur",
      acteur: { genre: "gouvernement", ministre: null, ministere: null },
      commission_id: null,
      source_ids: ["src-factice"],
    },
  ],
  etapes: [etapeDepot],
  revisions: [],
  source_ids: ["src-factice"],
  mis_a_jour_le: "2025-02-01",
};

/** Raccourci : le schéma refuse-t-il cette donnée ? */
const refuse = (schema: { safeParse: (d: unknown) => { success: boolean } }, donnee: unknown) =>
  !schema.safeParse(donnee).success;

test("les données de référence sont valides", () => {
  assert.equal(source.safeParse(sourceValide).success, true);
  const r = texte.safeParse(texteValide);
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues, null, 2));
});

test("source : archive, dates et empreinte cohérentes", () => {
  assert.ok(refuse(source, { ...sourceValide, url_archive: "https://example.org/x" }), "archive hors Wayback");
  assert.ok(
    refuse(source, { ...sourceValide, url_archive: "https://web.archive.org/web/20250201120000/https://senat.ci/autre" }),
    "archive d'une autre page",
  );
  assert.ok(refuse(source, { ...sourceValide, date_publication: "2025-03-01" }), "publiée après consultation");
  assert.ok(refuse(source, { ...sourceValide, format: "page_web" }), "empreinte sur une page web");
  assert.ok(refuse(source, { ...sourceValide, champ_inconnu: 1 }), "champ non prévu");
});

test("source : article déplacé par l'Assemblée nationale, archive de l'ancienne adresse acceptée", () => {
  const page = { ...sourceValide, format: "page_web" as const, empreinte_sha256: null, url: "https://www.assnat.ci/?six-projets-de-loi" };
  const archive = (adresse: string) => `https://web.archive.org/web/20200605032730/${adresse}`;
  assert.equal(source.safeParse({ ...page, url_archive: archive("http://www.assnat.ci/assembleenationale/?six-projets-de-loi") }).success, true);
  assert.equal(source.safeParse({ ...page, url_archive: archive("http://www.assnat.ci:80/assembleenationale/?six-projets-de-loi") }).success, true);
  assert.ok(refuse(source, { ...page, url_archive: archive("http://www.assnat.ci/assembleenationale/?sept-projets-de-loi") }), "autre article");
  assert.ok(refuse(source, { ...page, url_archive: archive("http://www.senat.ci/assembleenationale/?six-projets-de-loi") }), "autre site");
});

test("texte : règle « zéro donnée sans source » et champs obligatoires", () => {
  assert.ok(refuse(texte, { ...texteValide, source_ids: [] }));
  assert.ok(refuse(texte, { ...texteValide, numero_depot: undefined }), "champ omis au lieu de null");
});

test("texte : statut, auteur et « Lire plus » cohérents", () => {
  assert.ok(refuse(texte, { ...texteValide, statut: "promulgue" }), "statut sans étape");
  assert.ok(refuse(texte, { ...texteValide, numero_loi: "2025-1" }), "numéro de loi avant promulgation");
  assert.ok(refuse(texte, { ...texteValide, type: "proposition_de_loi" }), "proposition portée par le Gouvernement");
  assert.ok(refuse(texte, { ...texteValide, document_principal_source_id: "src-absente" }), "Lire plus hors sources");
  assert.ok(
    refuse(texte, {
      ...texteValide,
      etapes: [{ ...etapeDepot, statut: "retire" }, { ...etapeDepot, id: "apres", date: "2025-01-20" }],
    }),
    "étape avec statut après un retrait",
  );
});

test("étape : chambre, commission et vote cohérents avec l'organe", () => {
  const avecEtape = (e: object) => ({ ...texteValide, etapes: [{ ...etapeDepot, ...e }] });
  assert.ok(refuse(texte, avecEtape({ chambre: null })), "étape au Parlement sans chambre");
  assert.ok(refuse(texte, avecEtape({ organe: "presidence" })), "étape hors Parlement avec chambre");
  assert.ok(refuse(texte, avecEtape({ commission_id: "commission-x" })), "commission sur une étape de dépôt");
});

test("vote : décomptes cohérents", () => {
  const base = { resultat: "adopte", pour: 10, contre: 2, abstention: 1, votants: 13, unanimite: false, source_ids: ["s"] };
  assert.equal(vote.safeParse(base).success, true);
  assert.ok(refuse(vote, { ...base, pour: 1, contre: 5 }), "adopté avec moins de pour que de contre");
  assert.ok(refuse(vote, { ...base, unanimite: true }), "unanimité avec des voix contre");
  assert.ok(refuse(vote, { ...base, votants: 5 }), "décompte supérieur aux votants");
});

test("parlementaire : mandat cohérent", () => {
  const mandat = {
    legislature_id: "legislature-x",
    chambre: "senat",
    mode_designation: "nomme",
    circonscription: null,
    parti_id: null,
    groupe_parlementaire: null,
    date_debut: "2023-01-01",
    date_fin: null,
    source_ids: ["s"],
  };
  const base = { id: "p", nom: "Factice", prenoms: null, mandats: [mandat], source_ids: ["s"] };
  assert.equal(parlementaire.safeParse(base).success, true);
  assert.ok(refuse(parlementaire, { ...base, mandats: [{ ...mandat, circonscription: "X" }] }), "nommé avec circonscription");
  assert.ok(refuse(parlementaire, { ...base, mandats: [{ ...mandat, date_fin: "2020-01-01" }] }), "fin avant début");
  assert.ok(refuse(parlementaire, { ...base, mandats: [mandat, mandat] }), "législature en double");
});

test("forme de l'acte : une loi a un parcours, une ordonnance ou un décret n'en a pas", () => {
  assert.equal(texte.safeParse({ ...texteValide, type: null, acteurs: [] }).success, true, "loi d'initiative inconnue, sans auteur cité");
  assert.ok(refuse(texte, { ...texteValide, acteurs: [] }), "initiative connue : l'auteur est requis");
  assert.ok(refuse(texte, { ...texteValide, etapes: [], statut: "depose" }), "loi sans étape");
  assert.ok(refuse(texte, { ...texteValide, date_signature: "2025-01-01" }), "date de signature sur une loi");
  assert.ok(refuse(texte, { ...texteValide, titre_loi: "Loi factice relative aux tests" }), "titre de loi avant promulgation");

  const decret = {
    ...texteValide,
    acte: "decret",
    titre_officiel: "Décret factice portant application d'une loi factice",
    type: null,
    statut: null,
    etapes: [],
    numero_acte: "2099-1",
    date_signature: "2025-01-10",
  };
  const r = texte.safeParse(decret);
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues, null, 2));
  assert.ok(refuse(texte, { ...decret, statut: "depose", etapes: [etapeDepot] }), "statut parlementaire sur un décret");
  assert.ok(refuse(texte, { ...decret, type: "projet_de_loi" }), "initiative parlementaire sur un décret");
  assert.ok(refuse(texte, { ...decret, numero_loi: "Loi n° 2099-1" }), "numéro de loi sur un décret");
  assert.ok(
    refuse(texte, { ...decret, acteurs: [{ ...texteValide.acteurs[0]!, acteur: { genre: "parlementaire", parlementaire_id: "x" } }] }),
    "un décret a pour auteur le Gouvernement",
  );
});

test("sous-catégorie sans catégorie refusée ; résumé et explication facultatifs mais bornés", () => {
  assert.ok(refuse(texte, { ...texteValide, sous_categorie_id: "nom" }));
  assert.equal(texte.safeParse({ ...texteValide, resume: null }).success, true, "résumé à rédiger");
  assert.ok(refuse(texte, { ...texteValide, explication: "trop court" }));
});
