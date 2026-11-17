<script setup lang="ts">
/** Méthodologie et sources : comment les données sont collectées, vérifiées et affichées. */
import { STATUTS } from "~~/schemas/statuts";

useSeoMeta({
  title: "Méthodologie et sources — LoiCI",
  description: "Comment LoiCI collecte, vérifie et présente les textes législatifs ivoiriens.",
});

const { data: meta } = useMetaApi();
const { data: referentiels } = useReferentiels();

const prefixe = useRuntimeConfig().app.baseURL.replace(/\/$/, "");
const fichiersApi = [
  { chemin: "/api/v1/textes.json", description: "liste de tous les textes (statut, dates, filtres)" },
  { chemin: "/api/v1/textes/<id>.json", description: "fiche complète d'un texte, avec ses sources" },
  { chemin: "/api/v1/parlementaires.json", description: "parlementaires et leurs mandats" },
  { chemin: "/api/v1/partis.json", description: "partis politiques" },
  { chemin: "/api/v1/referentiels.json", description: "législatures, commissions, thèmes, catégories, domaines officiels" },
  { chemin: "/api/v1/meta.json", description: "date de génération et effectifs" },
];
</script>

<template>
  <UContainer class="py-6">
    <article class="prose-sm max-w-3xl space-y-8">
      <header>
        <h1 class="text-2xl font-bold text-highlighted">Méthodologie et sources</h1>
        <p class="mt-2 text-muted">
          LoiCI recense les textes législatifs ivoiriens et leur parcours. Ce site ne commente pas : il rapporte des
          faits, chacun relié à sa source.
        </p>
      </header>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">Nos règles</h2>
        <ul class="list-disc space-y-2 ps-5">
          <li><strong>Accès libre.</strong> Aucun compte, aucun paiement, aucune publicité, aucun traceur.</li>
          <li>
            <strong>Aucune donnée sans source.</strong> Chaque texte, étape, vote, révision et fiche de parlementaire
            renvoie à au moins une source : adresse, émetteur, type, date de publication, date de consultation et copie
            archivée sur la Wayback Machine.
          </li>
          <li>
            <strong>Aucun document stocké.</strong> Le site ne garde qu'un index (titres, statuts, dates, votes, liens).
            Les textes eux-mêmes restent sur les sites officiels ; « Lire plus » vous y conduit.
          </li>
          <li>
            <strong>Ne jamais inventer.</strong> Une information introuvable est affichée « {{ NON_RENSEIGNE }} ». Une
            date approximative (« en octobre ») n'est pas transformée en date précise.
          </li>
          <li>
            <strong>Neutralité.</strong> Les résumés sont factuels. Aucune couleur ni aucun logo de parti n'est utilisé ;
            les couleurs du site indiquent seulement l'avancement d'un texte.
          </li>
        </ul>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">Hiérarchie des sources</h2>
        <p>
          Les sources officielles passent en premier : Assemblée nationale, Sénat, Gouvernement, Journal officiel,
          Conseil constitutionnel. La presse (AIP, Fraternité Matin, Abidjan.net…) vient compléter une information
          absente des sources officielles. Un texte qui ne s'appuie sur aucune source officielle porte le badge
          <BadgeSourceNonOfficielle class="align-middle" />.
        </p>
        <p v-if="referentiels?.domaines_officiels.length">
          Sont considérés comme officiels les sites suivants et leurs sous-domaines :
          {{ referentiels.domaines_officiels.map((d) => `${d.domaine} (${d.institution})`).join(", ") }}.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">Les statuts d'un texte</h2>
        <dl class="space-y-2">
          <div v-for="code in STATUTS" :key="code" class="flex flex-wrap items-start gap-x-3 gap-y-1">
            <dt><BadgeStatut :statut="code" /></dt>
            <dd class="text-sm">{{ STATUTS_INFOS[code].explication }}</dd>
          </div>
        </dl>
        <p class="text-sm">
          Le statut affiché est toujours celui de la dernière étape sourcée du parcours. L'« année » utilisée dans les
          filtres est celle de la première étape datée.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">« Lire plus » et liens morts</h2>
        <p>
          « Lire plus » ouvre le document original dans un nouvel onglet. Si le site d'origine ne répond pas, la copie
          archivée s'ouvre à sa place. Depuis votre navigateur, nous pouvons détecter un site injoignable, mais pas une
          page supprimée sur un site qui fonctionne : le lien « copie archivée » reste donc toujours affiché.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">Collecte et vérification</h2>
        <p>
          Les données sont des fichiers ouverts, versionnés publiquement. Un robot lit chaque jour les pages publiques des
          sources et propose des mises à jour ; il ne publie jamais seul : une personne relit et valide chaque
          modification. Toute contribution humaine suit le même circuit. Une vérification automatique refuse toute
          donnée sans source valide.
        </p>
        <p>
          Pour détecter une nouvelle version d'un document, nous conservons son empreinte numérique, jamais le fichier.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">Réutiliser les données</h2>
        <p>Les données sont publiées sous licence ODbL, en fichiers JSON en lecture libre :</p>
        <ul class="list-disc space-y-1 ps-5 text-sm">
          <li v-for="f in fichiersApi" :key="f.chemin">
            <a v-if="!f.chemin.includes('<')" :href="prefixe + f.chemin" class="font-mono underline">{{ f.chemin }}</a>
            <code v-else class="font-mono">{{ f.chemin }}</code>
            — {{ f.description }}
          </li>
        </ul>
        <p v-if="meta" class="text-sm text-muted">
          Données générées le {{ formaterDate(meta.genere_le) }} : {{ meta.effectifs.textes }} texte(s),
          {{ meta.effectifs.sources }} source(s).
        </p>
      </section>
    </article>
  </UContainer>
</template>
