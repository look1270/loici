<script setup lang="ts">
/**
 * « Où en est ce texte ? » en une ligne : statut, explication, et position dans le parcours.
 * Objectif du cahier des charges : comprendre le statut en 5 secondes.
 */
import type { CodeStatut } from "~~/schemas/statuts";
import { STATUTS_PARCOURS } from "~~/schemas/statuts";

const props = defineProps<{ statut: CodeStatut }>();
const infos = computed(() => STATUTS_INFOS[props.statut]);
const position = computed(() => positionParcours(props.statut));
const total = STATUTS_PARCOURS.length;
</script>

<template>
  <section aria-labelledby="titre-statut" class="rounded-lg border border-default p-4 space-y-3">
    <h2 id="titre-statut" class="sr-only">Statut du texte</h2>
    <div class="flex flex-wrap items-center gap-3">
      <BadgeStatut :statut="statut" taille="xl" />
      <p v-if="position" class="text-sm text-muted">Étape {{ position }} sur {{ total }} du parcours</p>
    </div>
    <p class="text-highlighted">{{ infos.explication }}</p>
    <UProgress
      v-if="position"
      :model-value="position"
      :max="total"
      :color="infos.couleur"
      size="sm"
      :aria-label="`Avancement : étape ${position} sur ${total}`"
    />
  </section>
</template>
