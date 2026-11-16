/**
 * Tests du chargement des fiches : « introuvable » seulement si c'est vrai.
 * API publiée simulée EN MÉMOIRE (adaptateur de test de `LecteurApi`), pauses immédiates.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DELAI_ESSAI_MS, ESSAIS, type EtatFiche, type LecteurApi, type Reponse, chargerFiche } from "../app/utils/chargementFiche";

/**
 * API en mémoire. `cache` : ce que répond une lecture normale (un cache encore périmé) ;
 * `frais` : ce que répond une lecture sans cache, éventuellement une réponse par essai.
 */
function api(opts: { cache?: Record<string, Reponse>; frais?: Record<string, Reponse | Reponse[]> }) {
  const lectures: string[] = [];
  const absent: Reponse = { ok: false, statut: 404 };
  const lecteur: LecteurApi = {
    async lire(chemin) {
      lectures.push(`cache:${chemin}`);
      return opts.cache?.[chemin] ?? absent;
    },
    async lireSansCache(chemin) {
      lectures.push(`frais:${chemin}`);
      const r = opts.frais?.[chemin];
      if (Array.isArray(r)) return r.shift() ?? absent;
      return r ?? absent;
    },
  };
  const pauses: number[] = [];
  const etats: EtatFiche[] = [];
  const deps = { lecteur, attendre: async (ms: number) => void pauses.push(ms), surEtat: (e: EtatFiche) => void etats.push(e) };
  return { deps, lectures, pauses, etats };
}

const ok = (donnees: unknown): Reponse => ({ ok: true, donnees });
const FICHE = { id: "loi-x", titre_officiel: "Texte factice" };

test("fiche lue : prete, sans vérification ni nouvel essai", async () => {
  const { deps, lectures } = api({ cache: { "textes/loi-x.json": ok(FICHE) } });
  assert.deepEqual(await chargerFiche("textes", "loi-x", deps), { etat: "prete", fiche: FICHE });
  assert.deepEqual(lectures, ["cache:textes/loi-x.json"]);
});

test("404 et identifiant absent de la liste publiée : introuvable", async () => {
  const { deps, pauses } = api({ frais: { "textes.json": ok([{ id: "autre" }]) } });
  assert.equal((await chargerFiche("textes", "loi-x", deps)).etat, "introuvable");
  assert.deepEqual(pauses, []);
});

test("404 mais identifiant dans la liste : en cours de publication, puis prete au 2e essai", async () => {
  const { deps, pauses, etats } = api({
    frais: { "parlementaires.json": ok([{ id: "depute-x" }]), "parlementaires/depute-x.json": [{ ok: false, statut: 404 }, ok(FICHE)] },
  });
  assert.deepEqual(await chargerFiche("parlementaires", "depute-x", deps), { etat: "prete", fiche: FICHE });
  assert.deepEqual(etats, ["en_cours_de_publication"]);
  assert.deepEqual(pauses, [DELAI_ESSAI_MS, 2 * DELAI_ESSAI_MS]);
});

test("identifiant dans la liste, fiche toujours absente : en cours de publication après tous les essais", async () => {
  const { deps, pauses } = api({ frais: { "textes.json": ok([{ id: "loi-x" }]) } });
  assert.equal((await chargerFiche("textes", "loi-x", deps)).etat, "en_cours_de_publication");
  assert.equal(pauses.length, ESSAIS);
});

test("erreur autre que 404 : erreur réseau, la liste n'est pas consultée", async () => {
  const { deps, lectures } = api({ cache: { "textes/loi-x.json": { ok: false, statut: null } } });
  assert.equal((await chargerFiche("textes", "loi-x", deps)).etat, "erreur_reseau");
  assert.deepEqual(lectures, ["cache:textes/loi-x.json"]);
});

test("404 et liste illisible : erreur réseau, jamais « introuvable »", async () => {
  for (const liste of [{ ok: false, statut: 500 } as Reponse, ok({ pas: "une liste" })]) {
    const { deps } = api({ frais: { "textes.json": liste } });
    assert.equal((await chargerFiche("textes", "loi-x", deps)).etat, "erreur_reseau");
  }
});

test("Réessayer : la première lecture contourne aussi le cache périmé", async () => {
  const { deps, lectures } = api({ cache: {}, frais: { "textes/loi-x.json": ok(FICHE) } });
  assert.equal((await chargerFiche("textes", "loi-x", deps, { sansCache: true })).etat, "prete");
  assert.deepEqual(lectures, ["frais:textes/loi-x.json"]);
});

test("identifiant avec caractères spéciaux : chemin encodé", async () => {
  const { deps, lectures } = api({});
  await chargerFiche("textes", "a/b", deps);
  assert.equal(lectures[0], "cache:textes/a%2Fb.json");
});
