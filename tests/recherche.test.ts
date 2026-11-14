/**
 * Tests de la recherche et des filtres (exécutés dans le navigateur en production).
 * Données FACTICES, uniquement pour les tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ResumeTexte } from "../schemas/api";
import {
  FILTRES_VIDES,
  correspond,
  filtrerTextes,
  filtresVersRequete,
  nombreFiltresActifs,
  normaliser,
  requeteVersFiltres,
  texteRecherchable,
} from "../app/utils/recherche";

const base: ResumeTexte = {
  id: "a",
  titre_officiel: "Projet de loi factice relatif à l'Économie numérique",
  numero_depot: null,
  numero_loi: "Loi n° 2099-1",
  type: "projet_de_loi",
  nature: null,
  statut: "en_commission",
  legislature_id: null,
  annee: 2099,
  date_depot: null,
  chambre_depot: null,
  date_promulgation: null,
  date_derniere_etape: "2099-03-01",
  themes: ["theme-x"],
  commission_ids: ["commission-x"],
  auteurs_gouvernement: [{ ministre: "Ministre Factice", ministere: "Ministère factice" }],
  parlementaires: [{ id: "depute-x", role: "rapporteur" }],
  parti_ids: [],
  source_officielle: true,
  mis_a_jour_le: "2099-03-01",
};
const autre: ResumeTexte = { ...base, id: "b", titre_officiel: "Proposition factice", type: "proposition_de_loi", statut: "promulgue", annee: 2098, date_derniere_etape: "2099-05-01", themes: [], commission_ids: [], auteurs_gouvernement: [], parlementaires: [] };

test("normalisation : accents, majuscules et ponctuation ignorés", () => {
  assert.equal(normaliser("Économie, l'État !"), "economie l etat");
  assert.ok(correspond(normaliser("Projet relatif à l'économie"), "ECONOMIE projet"));
  assert.ok(!correspond(normaliser("Projet relatif à l'économie"), "économie santé"));
});

test("recherche dans le titre, le numéro, le ministre et les parlementaires", () => {
  const noms = new Map([["depute-x", "Awa Factice"]]);
  const r = texteRecherchable(base, noms);
  for (const q of ["numerique", "2099 1", "ministre factice", "awa"]) assert.ok(correspond(r, q), q);
});

test("filtres combinés et tri par activité récente", () => {
  const tous = filtrerTextes([base, autre], FILTRES_VIDES);
  assert.deepEqual(tous.map((t) => t.id), ["b", "a"], "le plus récemment actif d'abord");
  assert.deepEqual(filtrerTextes([base, autre], { ...FILTRES_VIDES, statut: "en_commission" }).map((t) => t.id), ["a"]);
  assert.deepEqual(filtrerTextes([base, autre], { ...FILTRES_VIDES, annee: "2098" }).map((t) => t.id), ["b"]);
  assert.deepEqual(filtrerTextes([base, autre], { ...FILTRES_VIDES, parlementaire: "depute-x", theme: "theme-x" }).map((t) => t.id), ["a"]);
  assert.equal(filtrerTextes([base, autre], { ...FILTRES_VIDES, q: "proposition", type: "projet_de_loi" }).length, 0);
});

test("filtres ↔ adresse de la page (aller-retour)", () => {
  const f = { ...FILTRES_VIDES, q: "budget", statut: "promulgue" };
  assert.deepEqual(filtresVersRequete(f), { q: "budget", statut: "promulgue" });
  assert.deepEqual(requeteVersFiltres(filtresVersRequete(f)), f);
  assert.equal(nombreFiltresActifs(f), 1, "la recherche libre n'est pas comptée comme filtre");
});
