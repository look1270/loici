/**
 * Tests de la validation de la CI : contrôles croisés et chargement des fichiers.
 * Données FACTICES, uniquement pour les tests ; elles ne décrivent aucun texte réel.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Donnees } from "../scripts/lib/donnees";
import { chargerDonnees } from "../scripts/lib/donnees";
import { controlesCroises, surDomaine } from "../scripts/lib/controles";

const AUJOURDHUI = "2030-01-01";

const source = (id: string, url: string, type: "officielle" | "presse" = "officielle") => ({
  id,
  url,
  titre: "Document factice",
  nom: "Émetteur factice",
  type,
  format: "page_web" as const,
  date_publication: "2029-01-01",
  date_consultation: "2029-06-01",
  url_archive: `https://web.archive.org/web/20290601000000/${url}`,
  empreinte_sha256: null,
});

/** Jeu de données minimal valide ; chaque test en modifie une copie. */
function donneesValides(): Donnees {
  return {
    sources: [source("src-off", "https://www.assnat.ci/factice"), source("src-presse", "https://presse.example/factice", "presse")],
    textes: [
      {
        id: "texte-factice",
        acte: "loi",
        titre_officiel: "Projet de loi factice de test",
        numero_depot: null,
        type: "projet_de_loi",
        nature: null,
        statut: "en_commission",
        legislature_id: "leg-x",
        resume: "x".repeat(160),
        themes: ["theme-x"],
        numero_loi: null,
        explication: null,
        categorie_id: "cat-x",
        sous_categorie_id: "sous-x",
        titre_loi: null,
        numero_acte: null,
        date_signature: null,
        reference_jo: null,
        vigueur: null,
        textes_lies: [],
        document_principal_source_id: "src-off",
        acteurs: [
          { role: "auteur", acteur: { genre: "gouvernement", ministre: null, ministere: null }, commission_id: null, source_ids: ["src-off"] },
          { role: "rapporteur", acteur: { genre: "parlementaire", parlementaire_id: "depute-x" }, commission_id: "an-com", source_ids: ["src-presse"] },
        ],
        etapes: [
          {
            id: "commission",
            date: "2029-03-01",
            statut: "en_commission",
            chambre: "assemblee_nationale",
            organe: "commission",
            commission_id: "an-com",
            libelle: "Examen en commission",
            vote: null,
            source_ids: ["src-off"],
          },
        ],
        revisions: [],
        source_ids: ["src-off"],
        mis_a_jour_le: "2029-06-01",
      },
    ],
    parlementaires: [
      {
        id: "depute-x",
        nom: "Factice",
        prenoms: null,
        mandats: [
          {
            legislature_id: "leg-x",
            chambre: "assemblee_nationale",
            mode_designation: "elu",
            circonscription: null,
            parti_id: "parti-x",
            groupe_parlementaire: null,
            date_debut: null,
            date_fin: null,
            source_ids: ["src-off"],
          },
        ],
        source_ids: ["src-off"],
      },
    ],
    partis: [{ id: "parti-x", nom: "Parti factice", sigle: null, source_ids: ["src-presse"] }],
    decisions: [],
    referentiels: {
      legislatures: [{ id: "leg-x", chambre: "assemblee_nationale", libelle: "Législature factice", date_debut: null, date_fin: null, source_ids: ["src-off"] }],
      commissions: [{ id: "an-com", chambre: "assemblee_nationale", nom: "Commission factice", sigle: null, source_ids: ["src-off"] }],
      themes: [{ id: "theme-x", libelle: "Thème factice" }],
      categories: [{ id: "cat-x", libelle: "Catégorie factice", explication: "Explication factice de catégorie.", sous_categories: [{ id: "sous-x", libelle: "Sous-catégorie factice" }] }],
      domaines_officiels: [{ domaine: "assnat.ci", institution: "Assemblée nationale" }],
    },
  } as Donnees;
}

/** Messages d'erreur produits par les contrôles. */
const erreurs = (d: Donnees) => controlesCroises(d, AUJOURDHUI).filter((p) => p.niveau === "erreur").map((p) => `${p.fichier} ${p.champ} ${p.message}`);

test("le jeu de référence ne produit aucun problème", () => {
  assert.deepEqual(controlesCroises(donneesValides(), AUJOURDHUI), []);
});

test("décision de référence : publication officielle et texte existant exigés", () => {
  const decisionFactice = {
    id: "decision-factice",
    juridiction: "cour_de_cassation" as const,
    formation: "Chambre pénale",
    numero: "001.Pe/29",
    date: "2029-01-15",
    sens: ["rejet" as const],
    textes_concernes: [{ texte_id: "texte-factice", articles: ["article 1"] }],
    resume: "Résumé factice d'une décision de référence, assez long pour respecter la longueur minimale exigée.",
    page: 1,
    source_ids: ["src-off"],
    mis_a_jour_le: "2029-06-01",
  };
  const d = donneesValides();
  d.decisions = [decisionFactice];
  assert.deepEqual(erreurs(d), []);

  const d2 = donneesValides();
  d2.decisions = [{ ...decisionFactice, source_ids: ["src-presse"], textes_concernes: [{ texte_id: "texte-absent", articles: ["article 1"] }] }];
  const e = erreurs(d2).join("\n");
  assert.ok(e.includes("pas de presse"), "source de presse refusée");
  assert.ok(e.includes("Texte introuvable"), "texte inconnu");
});

test("domaines officiels : domaine exact et sous-domaines seulement", () => {
  assert.ok(surDomaine("assnat.ci", "assnat.ci"));
  assert.ok(surDomaine("plan.gouv.ci", "gouv.ci"));
  assert.ok(!surDomaine("fauxgouv.ci", "gouv.ci"), "un domaine qui se termine pareil n'est pas un sous-domaine");
  assert.ok(!surDomaine("gouv.ci.example.com", "gouv.ci"));
});

test("type de source cohérent avec son domaine", () => {
  const d = donneesValides();
  d.sources[0] = { ...d.sources[0]!, url: "https://blog.example/x", url_archive: "https://web.archive.org/web/20290601000000/https://blog.example/x" };
  assert.ok(erreurs(d).some((e) => e.includes("n'est pas un domaine officiel")));

  const d2 = donneesValides();
  d2.sources[1] = { ...d2.sources[1]!, url: "https://senat.assnat.ci/y" };
  assert.ok(erreurs(d2).some((e) => e.includes("doit être typée « officielle »")));
});

test("références introuvables : source, parlementaire, parti, commission, législature, thème", () => {
  const d = donneesValides();
  const t = d.textes[0]!;
  t.etapes[0]!.source_ids = ["src-absente"];
  t.themes = ["theme-absent"];
  t.legislature_id = "leg-absente";
  t.acteurs[1] = { ...t.acteurs[1]!, acteur: { genre: "parlementaire", parlementaire_id: "inconnu" }, commission_id: "com-absente" };
  d.parlementaires[0]!.mandats[0]!.parti_id = "parti-absent";
  const e = erreurs(d).join("\n");
  for (const attendu of ["Source introuvable", "Thème inconnu", "Législature inconnue", "Parlementaire introuvable", "Commission inconnue", "Parti introuvable"]) {
    assert.ok(e.includes(attendu), attendu);
  }
});

test("une source présente mais invalide est signalée comme invalide, sans alerte en cascade", () => {
  const d = donneesValides();
  d.sources = d.sources.filter((s) => s.id !== "src-presse");
  d.textes = [];
  d.invalides = { sources: new Set(["src-presse"]), textes: new Set(["texte-casse"]), parlementaires: new Set(), partis: new Set() };
  const tous = controlesCroises(d, AUJOURDHUI);
  assert.ok(tous.some((p) => p.message.includes("Source « src-presse » invalide : corrigez d'abord donnees/sources/src-presse.json")));
  assert.ok(!tous.some((p) => p.message.includes("introuvable")));
  assert.ok(!tous.some((p) => p.message.includes("citée par aucune donnée")), "pas d'alerte « orpheline » quand un texte a été écarté");
});

test("cohérence des chambres : mandat/législature et étape/commission", () => {
  const d = donneesValides();
  d.parlementaires[0]!.mandats[0]!.chambre = "senat";
  d.referentiels.commissions[0]!.chambre = "senat";
  const e = erreurs(d).join("\n");
  assert.ok(e.includes("La législature « leg-x » concerne la chambre"));
  assert.ok(e.includes("appartient à la chambre « senat »"));
});

test("dates dans le futur refusées", () => {
  const d = donneesValides();
  d.textes[0]!.etapes[0]!.date = "2031-01-01";
  d.sources[0]!.date_consultation = "2031-01-01";
  assert.equal(erreurs(d).filter((e) => e.includes("Date dans le futur")).length, 2);
});

test("même URL décrite deux fois", () => {
  const d = donneesValides();
  d.sources.push({ ...source("src-doublon", "http://assnat.ci/factice/") });
  assert.ok(erreurs(d).some((e) => e.includes("Même URL que la source « src-off »")));
});

test("deux versions d'un même PDF (empreintes différentes) sont acceptées, pas deux copies identiques", () => {
  const pdf = (id: string, empreinte: string) => ({ ...source(id, "https://assnat.ci/doc.pdf"), format: "pdf" as const, empreinte_sha256: empreinte });
  const d = donneesValides();
  d.sources.push(pdf("src-v1", "a".repeat(64)), pdf("src-v2", "b".repeat(64)));
  assert.ok(!erreurs(d).some((e) => e.includes("Même URL")));
  d.sources.push(pdf("src-v3", "b".repeat(64)));
  assert.ok(erreurs(d).some((e) => e.includes("Même URL que la source « src-v2 »")));
});

test("avertissements : source orpheline et texte sans source officielle", () => {
  const d = donneesValides();
  d.sources.push(source("src-orpheline", "https://presse.example/autre", "presse"));
  const t = d.textes[0]!;
  t.source_ids = ["src-presse"];
  t.document_principal_source_id = "src-presse";
  t.acteurs = t.acteurs.map((a) => ({ ...a, source_ids: ["src-presse"] }));
  t.etapes = t.etapes.map((e) => ({ ...e, source_ids: ["src-presse"] }));
  const avert = controlesCroises(d, AUJOURDHUI).filter((p) => p.niveau === "avertissement").map((p) => p.message);
  assert.ok(avert.some((m) => m.includes("Source citée par aucune donnée")));
  assert.ok(avert.some((m) => m.includes("Source non officielle")));
  assert.deepEqual(erreurs(d), [], "ce ne sont que des avertissements");
});

test("chargement : fichier mal nommé, JSON illisible et champ manquant sont tous signalés", async () => {
  const racine = await mkdtemp(join(tmpdir(), "loici-test-"));
  try {
    for (const dossier of ["sources", "textes", "referentiels"]) await mkdir(join(racine, "donnees", dossier), { recursive: true });
    for (const nom of ["legislatures", "commissions", "themes", "categories", "domaines-officiels"]) {
      await writeFile(join(racine, "donnees", "referentiels", `${nom}.json`), "[]");
    }
    const s = source("src-a", "https://assnat.ci/a");
    await writeFile(join(racine, "donnees", "sources", "mauvais-nom.json"), JSON.stringify(s));
    await writeFile(join(racine, "donnees", "sources", "casse.json"), "{ pas du json");
    const { date_publication: _, ...sansDate } = source("src-b", "https://assnat.ci/b");
    await writeFile(join(racine, "donnees", "sources", "src-b.json"), JSON.stringify(sansDate));

    const { donnees, problemes } = await chargerDonnees(racine);
    const messages = problemes.map((p) => `${p.fichier} ${p.message}`).join("\n");
    assert.equal(donnees.sources.length, 0, "aucun fichier fautif n'est retenu");
    assert.ok(messages.includes("mauvais-nom.json Le fichier doit s'appeler « src-a.json »"));
    assert.ok(messages.includes("casse.json JSON illisible"));
    assert.ok(problemes.some((p) => p.fichier.endsWith("src-b.json") && p.champ === "date_publication"));
  } finally {
    await rm(racine, { recursive: true, force: true });
  }
});

test("catégories : catégorie inconnue, sous-catégorie d'une autre catégorie, texte lié inexistant", () => {
  const d = donneesValides();
  d.textes[0]!.categorie_id = "cat-absente";
  assert.ok(erreurs(d).some((e) => e.includes("Catégorie inconnue")));

  const d2 = donneesValides();
  d2.textes[0]!.sous_categorie_id = "sous-ailleurs";
  assert.ok(erreurs(d2).some((e) => e.includes("n'appartient pas à la catégorie")));

  const d3 = donneesValides();
  d3.textes[0]!.textes_lies = [
    { relation: "modifie", texte_id: "texte-absent", intitule: "loi factice visée", source_ids: ["src-off"] },
    { relation: "modifie", texte_id: "texte-factice", intitule: "lui-même", source_ids: ["src-off"] },
    { relation: "abroge", texte_id: null, intitule: "loi factice non recensée", source_ids: ["src-inconnue"] },
  ];
  const e3 = erreurs(d3);
  assert.ok(e3.some((e) => e.includes("Texte introuvable")));
  assert.ok(e3.some((e) => e.includes("lié à lui-même")));
  assert.ok(e3.some((e) => e.includes("Source introuvable")), "les sources d'un texte lié sont vérifiées");
});
