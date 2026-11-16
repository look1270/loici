<script setup lang="ts">
/**
 * Fiche d'un texte. Ordre de lecture pensé pour le critère de réussite :
 *   1. le titre et le statut (compris en 5 secondes) ;
 *   2. « Lire plus » vers le document original ;
 *   3. le résumé neutre, puis qui a porté le texte ;
 *   4. le parcours avec les votes, les révisions, et toutes les sources numérotées.
 */
import type { Commission, Parlementaire, Parti } from "~~/schemas";

const route = useRoute();
const id = String(route.params.id);

const { fiche, etat, reessayer } = useFiche("textes", id);
const { data: referentiels } = useReferentiels();
const { data: listeParlementaires } = useParlementaires();
const { data: listePartis } = usePartis();

const sources = computed(() => (fiche.value ? numeroterSources(fiche.value.sources) : null));
fournirSources(sources);

const parId = <T extends { id: string }>(liste: T[] | undefined | null) =>
  Object.fromEntries((liste ?? []).map((x) => [x.id, x])) as Record<string, T>;
const commissions = computed(() => parId<Commission>(referentiels.value?.commissions));
const parlementaires = computed(() => parId<Parlementaire>(listeParlementaires.value));
const partis = computed(() => parId<Parti>(listePartis.value));

const documentPrincipal = computed(() => (fiche.value ? fiche.value.sources[fiche.value.document_principal_source_id] : null));
const sourceOfficielle = computed(() => sources.value?.liste.some((s) => s.type === "officielle") ?? true);

/** Informations d'identité, toutes affichées même inconnues (« Non renseigné »). */
const identite = computed(() => {
  const t = fiche.value;
  if (!t) return [];
  const depot = t.etapes.find((e) => e.statut === "depose");
  const legislature = referentiels.value?.legislatures.find((l) => l.id === t.legislature_id);
  return [
    { terme: "Type", valeur: TYPES_TEXTE[t.type]?.libelle ?? t.type, aide: TYPES_TEXTE[t.type]?.explication },
    { terme: "Nature", valeur: t.nature ? NATURES_TEXTE[t.nature] : null },
    { terme: "Numéro de dépôt", valeur: t.numero_depot },
    { terme: "Numéro de loi", valeur: t.numero_loi },
    { terme: "Date de dépôt", valeur: formaterDate(depot?.date) },
    { terme: "Chambre de dépôt", valeur: depot?.chambre ? CHAMBRES[depot.chambre] : null },
    { terme: "Législature", valeur: legislature?.libelle ?? null },
    {
      terme: "Thèmes",
      valeur: t.themes.map((th) => referentiels.value?.themes.find((x) => x.id === th)?.libelle ?? th).join(", ") || null,
    },
  ];
});

useHead({ title: computed(() => (fiche.value ? `${fiche.value.titre_officiel} — LoiCI` : "Texte — LoiCI")) });

const sommaire = [
  { ancre: "resume", libelle: "Résumé" },
  { ancre: "acteurs", libelle: "Qui porte ce texte" },
  { ancre: "parcours", libelle: "Parcours et votes" },
  { ancre: "revisions", libelle: "Révisions" },
  { ancre: "sources", libelle: "Sources" },
];
</script>

<template>
  <UContainer class="py-6">
    <NuxtLink to="/" class="inline-flex items-center gap-1 text-sm text-muted underline underline-offset-2">
      <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> Tous les textes
    </NuxtLink>

    <div aria-live="polite" class="mt-4">
      <p v-if="etat === 'chargement'" class="text-muted">Chargement du texte…</p>

      <UAlert
        v-else-if="etat === 'en_cours_de_publication'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-refresh-cw"
        title="Ce texte vient d'être publié"
        description="Sa fiche n'est pas encore disponible partout. Nouvel essai automatique en cours ; sinon, réessayez dans quelques minutes."
        :actions="[{ label: 'Réessayer', color: 'neutral', variant: 'outline', onClick: reessayer }]"
      />

      <UAlert
        v-else-if="etat === 'introuvable'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-search-x"
        title="Texte introuvable"
        description="Ce texte n'existe pas ou n'est plus recensé. Retrouvez tous les textes depuis l'accueil."
      />

      <UAlert
        v-else-if="etat === 'erreur_reseau'"
        color="error"
        variant="subtle"
        icon="i-lucide-wifi-off"
        title="Le texte n'a pas pu être chargé"
        description="Vérifiez votre connexion, puis réessayez."
        :actions="[{ label: 'Réessayer', color: 'error', variant: 'outline', onClick: reessayer }]"
      />
    </div>

    <article v-if="fiche" class="space-y-8">
      <header class="space-y-4">
        <p class="text-sm text-muted">
          {{ TYPES_TEXTE[fiche.type]?.libelle }}<template v-if="fiche.numero_loi"> · {{ fiche.numero_loi }}</template>
        </p>
        <h1 class="text-2xl font-bold leading-tight text-highlighted">{{ fiche.titre_officiel }}</h1>
        <BadgeSourceNonOfficielle v-if="!sourceOfficielle" />
        <ProgressionStatut :statut="fiche.statut" />
        <div class="flex flex-wrap items-center gap-2">
          <BoutonLirePlus v-if="documentPrincipal" :source="documentPrincipal" />
          <BoutonSignaler :titre="fiche.titre_officiel" />
        </div>
        <RefsSources :ids="fiche.source_ids" etiquette="Sources de la fiche" />
      </header>

      <nav aria-label="Sur cette page" class="rounded-lg bg-elevated p-3 text-sm">
        <p class="font-semibold">Sur cette page</p>
        <ul class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <li v-for="s in sommaire" :key="s.ancre">
            <a :href="`#${s.ancre}`" class="underline underline-offset-2">{{ s.libelle }}</a>
          </li>
        </ul>
      </nav>

      <section id="resume" aria-labelledby="titre-resume" class="scroll-mt-4 space-y-3">
        <h2 id="titre-resume" class="text-lg font-semibold text-highlighted">Résumé</h2>
        <p class="leading-relaxed">{{ fiche.resume }}</p>
        <dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <template v-for="ligne in identite" :key="ligne.terme">
            <dt class="text-muted">{{ ligne.terme }}</dt>
            <dd>
              <Valeur :valeur="ligne.valeur" />
              <span v-if="ligne.aide" class="text-muted"> — {{ ligne.aide }}</span>
            </dd>
          </template>
        </dl>
        <p class="text-sm text-muted">Fiche mise à jour le {{ formaterDate(fiche.mis_a_jour_le) }}.</p>
      </section>

      <section id="acteurs" aria-labelledby="titre-acteurs" class="scroll-mt-4 space-y-3">
        <h2 id="titre-acteurs" class="text-lg font-semibold text-highlighted">Qui porte ce texte</h2>
        <BlocActeurs
          :acteurs="fiche.acteurs"
          :legislature-id="fiche.legislature_id"
          :parlementaires="parlementaires"
          :partis="partis"
          :commissions="commissions"
        />
      </section>

      <section id="parcours" aria-labelledby="titre-parcours" class="scroll-mt-4 space-y-3">
        <h2 id="titre-parcours" class="text-lg font-semibold text-highlighted">Parcours et votes</h2>
        <FriseEtapes :etapes="fiche.etapes" :commissions="commissions" />
      </section>

      <section id="revisions" aria-labelledby="titre-revisions" class="scroll-mt-4 space-y-3">
        <h2 id="titre-revisions" class="text-lg font-semibold text-highlighted">Révisions</h2>
        <HistoriqueRevisions :revisions="fiche.revisions" :etapes="fiche.etapes" :parlementaires="parlementaires" />
      </section>

      <section id="sources" aria-labelledby="titre-sources" class="scroll-mt-4 space-y-3">
        <h2 id="titre-sources" class="text-lg font-semibold text-highlighted">Sources</h2>
        <p class="text-sm text-muted">
          Sources officielles d'abord, presse ensuite. Chaque source a une copie archivée sur la Wayback Machine.
        </p>
        <ListeSources />
      </section>
    </article>
  </UContainer>
</template>
