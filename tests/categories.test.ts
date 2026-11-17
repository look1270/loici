/**
 * Tests des catégories de l'accueil.
 * Données FACTICES, uniquement pour les tests.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ResumeTexte } from "../schemas/api";
import type { Categorie } from "../schemas/referentiels";
import {
  ID_AUTRES,
  ID_EN_COURS,
  SANS_SOUS_CATEGORIE,
  cartesAccueil,
  estEnCoursExamen,
  filtrerSousCategorie,
  sousCategoriesAvecNombre,
  textesDeCategorie,
  trouverCategorie,
} from "../app/utils/categories";

const base: ResumeTexte = {
  id: "a",
  acte: "loi",
  titre_officiel: "Projet de loi factice A",
  titre_loi: null,
  numero_depot: null,
  numero_loi: null,
  numero_acte: null,
  type: "projet_de_loi",
  nature: null,
  statut: "adopte_en_pleniere",
  legislature_id: null,
  annee: 2099,
  date_signature: null,
  categorie_id: "cat-a",
  sous_categorie_id: "sous-1",
  vigueur: null,
  date_depot: null,
  chambre_depot: null,
  date_promulgation: null,
  date_derniere_etape: null,
  themes: [],
  commission_ids: [],
  auteurs_gouvernement: [],
  parlementaires: [],
  parti_ids: [],
  source_officielle: true,
  mis_a_jour_le: "2099-01-01",
};

const referentiel: Categorie[] = [
  {
    id: "cat-a",
    libelle: "Catégorie A",
    explication: "Explication factice A.",
    sous_categories: [
      { id: "sous-1", libelle: "Sous 1" },
      { id: "sous-2", libelle: "Sous 2" },
    ],
  },
  { id: "cat-b", libelle: "Catégorie B", explication: "Explication factice B.", sous_categories: [] },
];

const promulguee: ResumeTexte = { ...base, id: "b", statut: "promulgue", sous_categorie_id: null };
const decret: ResumeTexte = { ...base, id: "c", acte: "decret", type: null, statut: null, categorie_id: "cat-b", sous_categorie_id: null };
const sansCategorie: ResumeTexte = { ...base, id: "d", statut: "adopte_definitivement", categorie_id: null, sous_categorie_id: null };
const textes = [base, promulguee, decret, sansCategorie];

test("en cours d'examen : une loi dont le parcours n'est pas attesté comme terminé", () => {
  assert.ok(estEnCoursExamen(base), "adoptée par une seule chambre");
  assert.ok(!estEnCoursExamen(promulguee));
  assert.ok(!estEnCoursExamen(sansCategorie), "adoptée définitivement : attend la promulgation, plus l'examen");
  assert.ok(!estEnCoursExamen(decret), "un décret n'a pas de parcours parlementaire");
});

test("cartes de l'accueil : ordre du référentiel, puis cartes calculées, avec les effectifs", () => {
  const cartes = cartesAccueil(referentiel, textes);
  assert.deepEqual(
    cartes.map((c) => [c.id, c.nombre]),
    [["cat-a", 2], ["cat-b", 1], [ID_EN_COURS, 1], [ID_AUTRES, 1]],
  );
  assert.ok(!cartesAccueil(referentiel, [base]).some((c) => c.id === ID_AUTRES), "« Autres textes » masqué s'il est vide");
});

test("un texte en cours d'examen reste aussi dans sa catégorie", () => {
  assert.deepEqual(textesDeCategorie(textes, ID_EN_COURS).map((t) => t.id), ["a"]);
  assert.ok(textesDeCategorie(textes, "cat-a").some((t) => t.id === "a"));
});

test("sous-catégories : effectifs, sous-catégories vides gardées, « Autres » pour le reste", () => {
  const cat = trouverCategorie(referentiel, "cat-a")!;
  assert.deepEqual(
    sousCategoriesAvecNombre(cat, textes).map((s) => [s.id, s.nombre]),
    [["sous-1", 1], ["sous-2", 0], [SANS_SOUS_CATEGORIE, 1]],
  );
  assert.deepEqual(sousCategoriesAvecNombre(trouverCategorie(referentiel, "cat-b")!, textes), []);
  assert.deepEqual(filtrerSousCategorie(textesDeCategorie(textes, "cat-a"), SANS_SOUS_CATEGORIE).map((t) => t.id), ["b"]);
  assert.deepEqual(filtrerSousCategorie(textes, "tous").length, textes.length);
  assert.equal(trouverCategorie(referentiel, "inexistante"), null);
});
