<script setup lang="ts">
/** Fiche parlementaire : identité, mandats (chambre, circonscription, parti), textes déposés ou rapportés. */
const route = useRoute();
const id = String(route.params.id);

const { fiche, etat, reessayer } = useFiche("parlementaires", id);
const { data: textes } = useTextes();
const { data: partis } = usePartis();
const { data: referentiels } = useReferentiels();

const sources = computed(() => (fiche.value ? numeroterSources(fiche.value.sources) : null));
fournirSources(sources);

const nomComplet = computed(() => (fiche.value ? [fiche.value.prenoms, fiche.value.nom].filter(Boolean).join(" ") : ""));

const nomParti = (partiId: string | null) => {
  const p = partis.value?.find((x) => x.id === partiId);
  return p ? (p.sigle ? `${p.nom} (${p.sigle})` : p.nom) : null;
};
const nomLegislature = (legislatureId: string) =>
  referentiels.value?.legislatures.find((l) => l.id === legislatureId)?.libelle ?? null;

/** Textes liés, regroupés : déposés (auteur ou cosignataire) et rapportés. */
const textesLies = computed(() => {
  const lies = (textes.value ?? []).filter((t) => t.parlementaires.some((p) => p.id === id));
  const avecRole = (roles: string[]) => lies.filter((t) => t.parlementaires.some((p) => p.id === id && roles.includes(p.role)));
  return [
    { titre: "Textes déposés", liste: avecRole(["auteur", "cosignataire"]) },
    { titre: "Textes rapportés", liste: avecRole(["rapporteur"]) },
  ];
});

useHead({ title: computed(() => (fiche.value ? `${nomComplet.value} — LoiCI` : "Parlementaire — LoiCI")) });
</script>

<template>
  <UContainer class="py-6">
    <NuxtLink to="/parlementaires" class="inline-flex items-center gap-1 text-sm text-muted underline underline-offset-2">
      <UIcon name="i-lucide-arrow-left" class="size-4" aria-hidden="true" /> Tous les parlementaires
    </NuxtLink>

    <div aria-live="polite" class="mt-4">
      <p v-if="etat === 'chargement'" class="text-muted">Chargement…</p>
      <UAlert
        v-else-if="etat === 'en_cours_de_publication'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-refresh-cw"
        title="Cette fiche vient d'être publiée"
        description="Elle n'est pas encore disponible partout. Nouvel essai automatique en cours ; sinon, réessayez dans quelques minutes."
        :actions="[{ label: 'Réessayer', color: 'neutral', variant: 'outline', onClick: reessayer }]"
      />
      <UAlert
        v-else-if="etat === 'introuvable'"
        color="neutral"
        variant="subtle"
        icon="i-lucide-search-x"
        title="Parlementaire introuvable"
        description="Ce parlementaire n'est pas recensé. Retrouvez-les tous depuis la liste des parlementaires."
      />
      <UAlert
        v-else-if="etat === 'erreur_reseau'"
        color="error"
        variant="subtle"
        icon="i-lucide-wifi-off"
        title="La fiche n'a pas pu être chargée"
        description="Vérifiez votre connexion, puis réessayez."
        :actions="[{ label: 'Réessayer', color: 'error', variant: 'outline', onClick: reessayer }]"
      />
    </div>

    <article v-if="fiche" class="space-y-8">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-highlighted">{{ nomComplet }}</h1>
        <BoutonSignaler :titre="nomComplet" />
        <RefsSources :ids="fiche.source_ids" etiquette="Sources de la fiche" />
      </header>

      <section aria-labelledby="titre-mandats" class="space-y-3">
        <h2 id="titre-mandats" class="text-lg font-semibold text-highlighted">Mandats</h2>
        <ul class="space-y-3">
          <li v-for="m in [...fiche.mandats].reverse()" :key="m.legislature_id" class="rounded-lg border border-default p-3">
            <dl class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
              <dt class="text-muted">Chambre</dt>
              <dd>{{ CHAMBRES[m.chambre] }}</dd>
              <dt class="text-muted">Législature</dt>
              <dd><Valeur :valeur="nomLegislature(m.legislature_id)" /></dd>
              <dt class="text-muted">Désignation</dt>
              <dd><Valeur :valeur="m.mode_designation === 'elu' ? 'Élu' : m.mode_designation === 'nomme' ? 'Nommé' : null" /></dd>
              <dt class="text-muted">Circonscription</dt>
              <dd><Valeur :valeur="m.circonscription" /></dd>
              <dt class="text-muted">Parti</dt>
              <dd><Valeur :valeur="nomParti(m.parti_id)" /></dd>
              <dt class="text-muted">Groupe</dt>
              <dd><Valeur :valeur="m.groupe_parlementaire" /></dd>
              <dt class="text-muted">Période</dt>
              <dd>
                <Valeur :valeur="formaterDate(m.date_debut)" /> –
                <Valeur :valeur="formaterDate(m.date_fin)" />
              </dd>
            </dl>
            <RefsSources :ids="m.source_ids" class="mt-2" />
          </li>
        </ul>
      </section>

      <section v-for="groupe in textesLies" :key="groupe.titre" class="space-y-3" :aria-label="groupe.titre">
        <h2 class="text-lg font-semibold text-highlighted">{{ groupe.titre }}</h2>
        <p v-if="!groupe.liste.length" class="text-muted">Aucun texte recensé.</p>
        <ul v-else class="space-y-3">
          <li v-for="t in groupe.liste" :key="t.id"><CarteTexte :texte="t" /></li>
        </ul>
      </section>

      <section aria-labelledby="titre-sources" class="space-y-3">
        <h2 id="titre-sources" class="text-lg font-semibold text-highlighted">Sources</h2>
        <ListeSources />
      </section>
    </article>
  </UContainer>
</template>
