/**
 * Tests du script de recherche en ligne de commande (scripts/chercher.ts), sur les vraies données de donnees/.
 * Vérifie des invariants plutôt que des titres précis, pour ne pas casser à chaque ajout de texte.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const RACINE = join(import.meta.dirname, "..");
const chercher = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", join(RACINE, "scripts", "chercher.ts"), ...args], { encoding: "utf8", cwd: RACINE });

test("sans terme : tous les textes, en JSON valide", () => {
  const r = chercher("--json");
  assert.equal(r.status, 0, r.stderr);
  const tous = JSON.parse(r.stdout);
  assert.ok(Array.isArray(tous) && tous.length > 0);
  // Chaque texte retrouvé par l'une de ses années doit sortir dans la recherche de cette année.
  for (const t of tous.filter((x: { annee: number | null }) => x.annee !== null)) {
    const r2 = JSON.parse(chercher("--json", String(t.annee)).stdout);
    assert.ok(r2.some((x: { id: string }) => x.id === t.id), `${t.id} introuvable par ${t.annee}`);
  }
});

test("personnalités : JSON valide, chacune retrouvée par son nom", () => {
  const liste = JSON.parse(chercher("--json", "--personnalites").stdout);
  for (const p of liste) {
    const nom = p.nom.split(" ").at(-1);
    const r = JSON.parse(chercher("--json", "--personnalites", nom).stdout);
    assert.ok(r.some((x: { cle: string }) => x.cle === p.cle), `${p.nom} introuvable par « ${nom} »`);
  }
});

test("option inconnue : erreur et aide", () => {
  const r = chercher("--personalites");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /option inconnue/);
});

test("dossier de données absent : erreur explicite", () => {
  const r = spawnSync(process.execPath, ["--import", "tsx", join(RACINE, "scripts", "chercher.ts")], {
    encoding: "utf8",
    cwd: RACINE,
    env: { ...process.env, LOICI_RACINE: "/dossier/inexistant" },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /dossier introuvable/);
});
