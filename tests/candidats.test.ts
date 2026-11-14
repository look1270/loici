/**
 * Tests de l'import d'extractions externes en file de relecture (scripts/lib/candidats.ts).
 * Titres inspirés d'erreurs réelles d'extraction ; aucune donnée n'est publiée.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { alertesDate, classer, nettoyerTitre, ordonnanceCitee, regrouper, ressemblance, type LigneExtraite } from "../scripts/lib/candidats";

const ligne = (titre: string, extra: Partial<LigneExtraite> = {}): LigneExtraite => ({
  id: "x",
  titre_officiel: titre,
  statut: "adopte_assemblee",
  date_derniere_etape: "2020-05-01",
  sources: [{ url: "https://www.assnat.ci/?article-precis" }],
  ...extra,
});

test("nettoyage : commentaires, dates et marques de coupure retirés", () => {
  assert.equal(nettoyerTitre("Projet de loi relatif au domicile, il a été voté à l’unanimité des députés présents"), "Projet de loi relatif au domicile");
  assert.equal(nettoyerTitre("Projet de loi relatif à l’extradition | 11 juin 2024"), "Projet de loi relatif à l’extradition");
  assert.equal(nettoyerTitre("Projet de loi portant gestion de la faune 11 juin 2024"), "Projet de loi portant gestion de la faune");
  assert.equal(nettoyerTitre("Projet de loi de finances portant budget de l’État (…)"), "Projet de loi de finances portant budget de l’État");
  assert.equal(nettoyerTitre("Projet de loi instituant Code de la construction et de l’habitat /14-06-19"), "Projet de loi instituant Code de la construction et de l’habitat");
  assert.equal(nettoyerTitre("Projet de loi INSTITUANT CODE DE LA CONSTRUCTION ET DE L’HABITAT"), "Projet de loi instituant code de la construction et de l’habitat");
});

test("classement : procédure écartée, titres mélangés ou coupés à corriger", () => {
  assert.equal(classer("Projet de loi de finances doit prévoir les recettes nécessaires", []).classe, "ecarte");
  assert.equal(classer("Projet de loi autorisant sa ratification ne peut être mis en discussion", []).classe, "ecarte");
  assert.equal(classer("Projet de loi portant protection session ordinaire du Sénat connaît aujourd’hui de l’éléphant", []).classe, "titre_a_corriger");
  assert.equal(classer("Projet de loi portant ratification de l’ordonnance n°2012-03 du 11 janvier", []).classe, "titre_a_corriger");
  assert.equal(classer("Projet de loi instituant code", []).classe, "titre_a_corriger");
  assert.equal(classer("Loi portant Code minier", []).classe, "candidat");
  assert.equal(classer("Loi portant organisation du système statistique national", []).classe, "candidat");
});

test("dates : ordonnance citée, incohérences signalées sans correction", () => {
  assert.deepEqual(ordonnanceCitee("ratification de l’ordonnance N°2020- 358 du 8 avril 2020 portant…"), { numero: "2020-358", date: "2020-04-08" });
  assert.deepEqual(ordonnanceCitee("ratification de l’ordonnance n°2020-357 du 8 avril"), { numero: "2020-357", date: null });
  const t = "Projet de loi portant ratification de l’ordonnance N°2020-381 du 15 avril 2020 modifiant…";
  assert.match(alertesDate(t, "2020-04-08", "2026-11-14")[0]!, /antérieure à l'ordonnance/);
  assert.match(alertesDate("Projet de loi portant ratification de l’ordonnance N°2020-357 du 8 avril", "2014-03-24", "2026-11-14")[0]!, /antérieure à l'année/);
  assert.match(alertesDate("Projet de loi x", "1959-07-04", "2026-11-14")[0]!, /invraisemblable/);
  assert.deepEqual(alertesDate(t, null, "2026-11-14"), []);
});

test("regroupement : titres court et long d'une même ordonnance, statuts contradictoires conservés", () => {
  const c = regrouper(
    [
      ligne("Projet de loi portant ratification de l’ordonnance n°2020-383 du 15 avril 2020"),
      ligne("Projet de loi portant ratification de l’ordonnance n°2020-383 du 15 avril 2020 portant création du Fonds", { statut: "depose" }),
      ligne("Projet de loi portant ratification de l’ordonnance n°2020-384 du 15 avril 2020 portant création du Fonds"),
    ],
    [],
    "2026-11-14",
  );
  assert.equal(c.length, 2, "deux ordonnances différentes, pas trois");
  const g = c.find((x) => x.titre.includes("2020-383"))!;
  assert.match(g.titre, /portant création du Fonds$/, "le titre le plus complet est gardé");
  assert.deepEqual(g.statuts_observes, ["depose", "adopte_en_pleniere"]);
  assert.equal(g.type_propose, "projet_de_loi_ratification_ordonnance");
});

test("regroupement : un début de titre commun à plusieurs textes reste ambigu", () => {
  const c = regrouper(
    [
      ligne("Projet de loi de finances portant budget de l’État pour l’année 2025"),
      ligne("Projet de loi de finances portant budget de l’État pour l’année 2027"),
      ligne("Projet de loi de finances portant budget de l’État (…)"),
      ligne("Projet de loi relatif à l’amél"),
      ligne("Projet de loi relatif à l’amélioration génétique animale"),
    ],
    [],
    "2026-11-14",
  );
  assert.equal(c.length, 4, "« l’amél » fusionné avec son titre complet");
  const court = c.find((x) => x.titre === "Projet de loi de finances portant budget de l’État")!;
  assert.equal(court.classe, "titre_a_corriger");
  assert.ok(court.raisons.some((r) => /commun à 2 textes/.test(r)));
});

test("texte déjà recensé : repéré, mais jamais confondu avec une autre année", () => {
  const existants = [{ id: "plf-2027", titre_officiel: "Projet de loi de finances portant Budget de l'État pour l'année 2027" }];
  const c = regrouper(
    [
      ligne("Projet de loi de finances portant budget de l’État de Côte d’Ivoire pour l’année 2027"),
      ligne("Projet de loi de Finances portant Budget de l’Etat pour l’année 2025"),
    ],
    existants,
    "2026-11-14",
  );
  assert.equal(c.find((x) => x.titre.includes("2027"))!.deja_recense, "plf-2027");
  assert.equal(c.find((x) => x.titre.includes("2025"))!.deja_recense, null);
  assert.equal(ressemblance("loi 2025 budget etat", "loi 2027 budget etat"), 0);
});

test("texte déjà recensé : entre deux fiches au même intitulé, celle de la bonne année", () => {
  const titre = "Projet de loi modifiant la loi n°2018-975 du 27 décembre 2018 portant Code de procédure pénale";
  const existants = [
    { id: "pl-2022-code-procedure-penale", titre_officiel: titre },
    { id: "pl-2024-code-procedure-penale", titre_officiel: titre },
  ];
  const c = regrouper([ligne(titre, { date_derniere_etape: "2024-06-11" })], existants, "2026-11-14");
  assert.equal(c[0]!.deja_recense, "pl-2024-code-procedure-penale");
});
