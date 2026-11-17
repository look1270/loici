<script setup lang="ts">
/** Une catégorie de l'accueil : nom, une phrase d'explication, nombre de textes. Toute la carte est cliquable. */
defineProps<{ id: string; libelle: string; explication: string; nombre: number | null }>();
</script>

<template>
  <article class="relative flex h-full flex-col rounded-lg border border-default p-4 hover:bg-elevated focus-within:ring-2 focus-within:ring-primary">
    <h2 class="font-semibold text-highlighted">
      <NuxtLink :to="`/categories/${id}`" class="after:absolute after:inset-0">{{ libelle }}</NuxtLink>
    </h2>
    <p class="mt-1 flex-1 text-sm text-muted">{{ explication }}</p>
    <p class="mt-3 text-sm font-medium">
      <template v-if="nombre === null">…</template>
      <template v-else-if="nombre === 0">Aucun texte recensé pour l'instant</template>
      <template v-else>{{ nombre }} texte{{ nombre > 1 ? "s" : "" }}</template>
    </p>
  </article>
</template>
