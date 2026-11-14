/**
 * Tests de la page Personnalités et des suggestions de recherche.
 * Données FACTICES, uniquement pour les tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ResumeTexte } from "../schemas/api";
import { listerPersonnalites, personnalitesCorrespondantes } from "../app/utils/personnalites";

const base: ResumeTexte = {
  id: "a",
  titre_officiel: "Projet de loi factice A",
  numero_depot: null,
  numero_loi: null,
  type: "projet_de_loi",
  nature: null,
  statut: "depose",
  legislature_id: null,
  annee: 2098,
  date_depot: null,
  chambre_depot: null,
  date_promulgation: null,
  date_derniere_etape: null,
  themes: [],
  commission_ids: [],
  auteurs_gouvernement: [{ ministre: "Kouassi Factice", ministere: "Ministère factice" }],
  parlementaires: [{ id: "depute-x", role: "rapporteur" }],
  parti_ids: [],
  source_officielle: true,
  mis_a_jour_le: "2099-01-01",
};
const b: ResumeTexte = { ...base, id: "b", annee: 2099, auteurs_gouvernement: [{ ministre: "KOUASSI factice", ministere: "Autre ministère" }], parlementaires: [] };
const c: ResumeTexte = {
  ...base,
  id: "c",
  type: "proposition_de_loi",
  auteurs_gouvernement: [{ ministre: null, ministere: "Ministère sans ministre" }],
  parlementaires: [{ id: "depute-x", role: "auteur" }, { id: "depute-x", role: "auteur" }],
};
const noms = new Map([["depute-x", "Awa Factice"]]);

test("regroupe un ministre écrit de deux façons et compte ses textes portés", () => {
  const liste = listerPersonnalites([base, b, c], noms);
  const ministre = liste.find((p) => p.genre === "gouvernement")!;
  assert.equal(ministre.nb_portes, 2);
  assert.deepEqual(ministre.ministeres, ["Ministère factice", "Autre ministère"]);
  assert.deepEqual(ministre.textes.map((t) => t.id), ["b", "a"], "les plus récents d'abord");
});

test("un ministre non renseigné n'est jamais deviné", () => {
  const liste = listerPersonnalites([c], noms);
  assert.ok(liste.every((p) => p.genre === "parlementaire"));
});

test("parlementaire : rôles distincts, texte compté une seule fois par rôle", () => {
  const depute = listerPersonnalites([base, c], noms).find((p) => p.cle === "parl-depute-x")!;
  assert.equal(depute.nom, "Awa Factice");
  assert.equal(depute.nb_portes, 1, "rapporteur ne compte pas comme texte porté ; doublon ignoré");
  assert.deepEqual(depute.textes.map((t) => `${t.id}:${t.role}`).sort(), ["a:rapporteur", "c:auteur"]);
});

test("tri : plus de textes portés d'abord", () => {
  assert.equal(listerPersonnalites([base, b, c], noms)[0]!.genre, "gouvernement");
});

test("suggestions pendant la recherche", () => {
  const liste = listerPersonnalites([base, b, c], noms);
  assert.deepEqual(personnalitesCorrespondantes(liste, "kouas").map((p) => p.nom), ["Kouassi Factice"]);
  assert.deepEqual(personnalitesCorrespondantes(liste, "budget awa").map((p) => p.nom), ["Awa Factice"]);
  assert.equal(personnalitesCorrespondantes(liste, "fa").length, 0, "moins de 3 lettres : aucune suggestion");
  assert.equal(personnalitesCorrespondantes(liste, "2099").length, 0, "une année ne suggère personne");
});
