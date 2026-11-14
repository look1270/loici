<script setup lang="ts">
/** Statut d'un texte : libellé + icône + couleur (la couleur n'est jamais la seule information). */
import type { CodeStatut } from "~~/schemas/statuts";

const props = withDefaults(defineProps<{ statut: CodeStatut; taille?: "md" | "lg" | "xl" }>(), { taille: "md" });
const infos = computed(() => STATUTS_INFOS[props.statut]);
</script>

<template>
  <UBadge :color="infos.couleur" variant="subtle" :icon="infos.icone" :size="taille" :label="infos.libelle" />
</template>
