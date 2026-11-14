<script setup lang="ts">
// Interface Nuxt UI entièrement en français (libellés des composants : fermer, rechercher, etc.).
import { fr } from "@nuxt/ui/locale";
</script>

<template>
  <UApp :locale="fr">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
