/**
 * Tests du nom affiché (« loi » ou « projet de loi ») et de la recherche sur les deux formulations.
 * Données FACTICES, uniquement pour les tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { nomAffiche, objetDuProjet } from "../app/utils/nom";
import { correspond, normaliser } from "../app/utils/recherche";

const projet = {
  acte: "loi",
  titre_officiel: "Projet de loi relatif au nom factice",
  titre_loi: null,
  numero_loi: null,
  statut: "adopte_en_pleniere" as const,
};

test("objet d'un projet ou d'une proposition", () => {
  assert.equal(objetDuProjet("Projet de loi organique portant statut factice"), "organique portant statut factice");
  assert.equal(objetDuProjet("Proposition de loi relative au test"), "relative au test");
  assert.equal(objetDuProjet("Loi n° 2099-1 portant test"), null);
});

test("en examen : l'intitulé du projet reste tel quel", () => {
  assert.equal(nomAffiche(projet), "Projet de loi relatif au nom factice");
  assert.equal(nomAffiche({ ...projet, statut: "rejete" }), "Projet de loi relatif au nom factice");
});

test("adoptée non promulguée : « Loi » + objet", () => {
  assert.equal(nomAffiche({ ...projet, statut: "adopte_definitivement" }), "Loi relative au nom factice");
});

test("promulguée : titre de loi recopié, sinon numéro, date et objet", () => {
  assert.equal(
    nomAffiche({ ...projet, statut: "promulgue", titre_loi: "Loi n° 2099-1 du 2 janvier 2099 relative au nom factice", numero_loi: "Loi n° 2099-1" }),
    "Loi n° 2099-1 du 2 janvier 2099 relative au nom factice",
  );
  assert.equal(
    nomAffiche({ ...projet, statut: "promulgue", numero_loi: "Loi n° 2099-1" }, "2099-01-02"),
    "Loi n° 2099-1 du 2 janvier 2099 relative au nom factice",
  );
  assert.equal(nomAffiche({ ...projet, statut: "promulgue" }), "Loi relative au nom factice", "numéro inconnu : jamais inventé");
});

test("ordonnance et décret : leur intitulé officiel", () => {
  assert.equal(nomAffiche({ ...projet, acte: "decret", titre_officiel: "Décret factice n° 2099-2", statut: null }), "Décret factice n° 2099-2");
});

test("recherche : « loi relative au nom » et « projet de loi relatif au nom » trouvent le même texte", () => {
  const r = normaliser("Projet de loi relatif au nom factice");
  assert.ok(correspond(r, "loi relative au nom"));
  assert.ok(correspond(r, "projet de loi relatif au nom"));
  assert.ok(!correspond(r, "loi relative au divorce"));
  assert.ok(!correspond(normaliser("Décret factice"), "loi relative"), "« loi » reste un mot significatif");
  assert.ok(!correspond(normaliser("Projet de loi relatif à l'économie autonome"), "loi relative au nom"), "« nom » ne se trouve pas dans « économie »");
  assert.ok(correspond(normaliser("Loi portant statut de M. Coulibaly"), "coulib"), "début de mot");
});
