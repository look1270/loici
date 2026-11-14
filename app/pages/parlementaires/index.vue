<script setup lang="ts">
/** Liste des parlementaires recensés (ceux liés à au moins un texte ou ajoutés par contribution). */
useSeoMeta({ title: "Parlementaires — LoiCI", description: "Députés et sénateurs liés aux textes recensés par LoiCI." });

const { data: parlementaires, status, error, refresh } = useParlementaires();
const { data: partis } = usePartis();
const recherche = ref("");

const liste = computed(() =>
  (parlementaires.value ?? [])
    .map((p) => {
      const dernier = p.mandats.at(-1)!;
      const parti = partis.value?.find((x) => x.id === dernier.parti_id);
      return {
        id: p.id,
        nom: [p.prenoms, p.nom].filter(Boolean).join(" "),
        chambre: CHAMBRES[dernier.chambre],
        circonscription: dernier.circonscription,
        parti: parti ? (parti.sigle ?? parti.nom) : null,
      };
    })
    .filter((p) => correspond(normaliser(p.nom), recherche.value))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
);
</script>

<template>
  <UContainer class="py-6 space-y-5">
    <h1 class="text-2xl font-bold text-highlighted">Parlementaires</h1>

    <UFormField label="Rechercher un parlementaire" name="recherche">
      <UInput v-model="recherche" type="search" icon="i-lucide-search" size="lg" class="w-full" autocomplete="off" />
    </UFormField>

    <div aria-live="polite">
      <p v-if="status === 'pending' || status === 'idle'" class="text-muted">Chargement…</p>
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-wifi-off"
        title="La liste n'a pas pu être chargée"
        :actions="[{ label: 'Réessayer', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />
      <p v-else-if="!parlementaires?.length" class="text-highlighted">
        Aucun parlementaire n'est encore recensé : les sources consultées pour les textes actuels ne nomment ni auteur
        parlementaire ni rapporteur.
      </p>
      <ul v-else class="divide-y divide-(--ui-border)">
        <li v-for="p in liste" :key="p.id" class="py-3">
          <NuxtLink :to="`/parlementaires/${p.id}`" class="font-medium underline underline-offset-2">{{ p.nom }}</NuxtLink>
          <p class="text-sm text-muted">
            {{ p.chambre }} · Circonscription : <Valeur :valeur="p.circonscription" /> · Parti : <Valeur :valeur="p.parti" />
          </p>
        </li>
      </ul>
    </div>
  </UContainer>
</template>
