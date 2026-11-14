/**
 * Vérifie EN LIGNE que le lien d'archive de chaque source indiquée répond (Wayback Machine).
 * La validation hors ligne (valider-donnees.ts) contrôle déjà le format du lien ;
 * ici on s'assure que la copie archivée existe vraiment.
 *
 * Usage : tsx scripts/verifier-archives.ts donnees/sources/a.json donnees/sources/b.json …
 * En CI, seules les sources ajoutées ou modifiées par la pull request sont vérifiées
 * (pour ménager la Wayback Machine et garder une CI rapide).
 *
 * Le lien original est aussi testé, mais seulement pour information : un site officiel
 * momentanément hors service ne doit pas bloquer une contribution, puisque l'archive existe.
 */
import { readFile } from "node:fs/promises";
import { source as schemaSource } from "../schemas";

const AGENT = "LoiCI-CI/1.0 (verification des archives ; observatoire citoyen open source)";
const PAUSE_MS = 2000;
const ESSAIS = 3;
const SUR_GITHUB = process.env.GITHUB_ACTIONS === "true";

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Code HTTP final (redirections suivies), ou null si injoignable. Plusieurs essais espacés. */
async function codeHttp(url: string): Promise<number | null> {
  for (let essai = 1; essai <= ESSAIS; essai++) {
    try {
      const reponse = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: { "User-Agent": AGENT },
        signal: AbortSignal.timeout(45_000),
      });
      await reponse.body?.cancel(); // on ne télécharge pas le document : seul le code nous intéresse
      if (reponse.status < 500) return reponse.status;
    } catch {
      // erreur réseau : on réessaie
    }
    if (essai < ESSAIS) await attendre(PAUSE_MS * essai * 2);
  }
  return null;
}

async function principal() {
  const fichiers = process.argv.slice(2).filter((f) => f.endsWith(".json"));
  if (!fichiers.length) {
    console.log("Aucune source à vérifier.");
    return;
  }
  let echecs = 0;
  for (const fichier of fichiers) {
    const resultat = schemaSource.safeParse(JSON.parse(await readFile(fichier, "utf8")));
    if (!resultat.success) {
      console.log(`⚠ ${fichier} : invalide, déjà signalé par la validation des données.`);
      continue;
    }
    const s = resultat.data;
    const archive = await codeHttp(s.url_archive);
    await attendre(PAUSE_MS);
    const original = await codeHttp(s.url);
    await attendre(PAUSE_MS);

    if (archive === 200) {
      console.log(`✔ ${fichier} : archive OK${original === 200 ? ", original OK" : ` (original : ${original ?? "injoignable"})`}`);
      if (original !== 200 && SUR_GITHUB) {
        console.log(`::warning file=${fichier},title=Lien original::Le site d'origine répond ${original ?? "pas"} ; « Lire plus » basculera sur l'archive.`);
      }
    } else {
      echecs++;
      const message = `L'archive ne répond pas correctement (${archive ?? "injoignable"}) : ${s.url_archive}`;
      console.log(`✖ ${fichier} : ${message}`);
      if (SUR_GITHUB) console.log(`::error file=${fichier},title=Archive introuvable::${message}`);
    }
  }
  if (echecs) {
    console.error(`\n✖ ${echecs} archive(s) introuvable(s). Archivez la page sur https://web.archive.org/save puis reportez le lien.`);
    process.exit(1);
  }
}

principal().catch((e: Error) => {
  console.error(`✖ Erreur inattendue : ${e.message}`);
  process.exit(1);
});
