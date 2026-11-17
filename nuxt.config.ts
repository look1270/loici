import { readFileSync, readdirSync } from "node:fs";

/**
 * Identifiants présents dans donnees/<dossier>/ : chaque fiche doit exister en page statique,
 * car son contenu étant chargé dans le navigateur, le générateur ne peut pas découvrir ses liens seul.
 */
function identifiants(dossier: string): string[] {
  try {
    return readdirSync(`donnees/${dossier}`)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length));
  } catch {
    return [];
  }
}

/**
 * Pages de catégories : celles du référentiel, plus les deux cartes calculées par le site
 * (identifiants ID_EN_COURS et ID_AUTRES de app/utils/categories.ts).
 */
function categoriesAGenerer(): string[] {
  try {
    const liste = JSON.parse(readFileSync("donnees/referentiels/categories.json", "utf8")) as { id: string }[];
    return [...liste.map((c) => c.id), "projets-en-cours", "autres-textes"];
  } catch {
    return [];
  }
}

/**
 * Version des données publiées : date de génération de l'API (écrite juste avant par « npm run api »).
 * Ajoutée à chaque requête vers /api/v1/ : après une mise en ligne, le navigateur ne mélange jamais
 * des fichiers de deux versions (ex. nouvelle liste + ancienne réponse « absent » gardée en cache).
 */
function versionDonnees(): string {
  try {
    return JSON.parse(readFileSync("public/api/v1/meta.json", "utf8")).genere_le ?? "";
  } catch {
    return "";
  }
}

/**
 * Configuration Nuxt de LoiCI.
 * Site 100 % statique (`nuxt generate`) hébergé sur Cloudflare Pages : aucun serveur.
 * Les données ne sont PAS intégrées aux pages : le navigateur les télécharge depuis /api/v1/*.json.
 */
export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],

  // Règle n° 1 : aucun traceur. Pas de télémétrie, pas d'appel à un service tiers depuis le site.
  telemetry: false,
  devtools: { enabled: false },

  // Polices système (pages légères, aucune requête vers Google Fonts).
  ui: { fonts: false },

  // Icônes intégrées au paquet du site au lieu d'être demandées à l'API Iconify à chaque visite.
  icon: {
    provider: "none",
    fallbackToApi: false,
    clientBundle: {
      scan: true,
      // Icônes utilisées dans app/utils/libelles.ts (non détectées par l'analyse automatique).
      icons: [
        "lucide:inbox", "lucide:users", "lucide:check", "lucide:check-check", "lucide:landmark",
        "lucide:badge-check", "lucide:scroll-text", "lucide:circle-x", "lucide:undo-2", "lucide:scale",
        "lucide:building-2", "lucide:circle",
        // Icônes de la page Contribuer (déclarées dans le script de la page).
        "lucide:file-plus", "lucide:flag", "lucide:bug",
      ],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      title: "LoiCI — Observatoire citoyen des lois de Côte d'Ivoire",
      meta: [
        {
          name: "description",
          content: "Tous les textes législatifs ivoiriens, leur parcours, les votes et les sources officielles. Accès libre.",
        },
      ],
    },
  },

  // Génération statique de toutes les pages ; aucune route serveur.
  nitro: {
    preset: "static",
    prerender: {
      crawlLinks: true,
      // Fichiers de l'API : copiés tels quels depuis public/, pas des pages à pré-rendre.
      ignore: [/\/api\/v1\//],
      routes: [
        "/",
        "/parlementaires",
        "/methodologie",
        "/personnalites",
        "/contribuer",
        ...categoriesAGenerer().map((id) => `/categories/${id}`),
        ...identifiants("textes").map((id) => `/textes/${id}`),
        ...identifiants("parlementaires").map((id) => `/parlementaires/${id}`),
      ],
    },
  },
  ssr: true,
  runtimeConfig: { public: { versionDonnees: versionDonnees() } },
});
