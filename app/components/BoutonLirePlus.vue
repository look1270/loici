<script setup lang="ts">
/**
 * « Lire plus » (règle n° 4) : ouvre le document original dans un nouvel onglet,
 * ou sa copie archivée si le site d'origine ne répond pas. Le site ne stocke aucun document.
 */
import type { Source } from "~~/schemas";

const props = defineProps<{ source: Source }>();
const auClic = (evenement: MouseEvent) => ouvrirAvecRepli(evenement, props.source.url, props.source.url_archive);
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
    <UButton
      :to="source.url"
      target="_blank"
      rel="noopener"
      size="lg"
      icon="i-lucide-external-link"
      trailing
      label="Lire plus"
      :aria-label="`Lire plus : ${source.titre} (${domaine(source.url)}, nouvel onglet)`"
      @click="auClic"
    />
    <span class="text-sm text-muted">
      {{ source.format === "pdf" ? "Document PDF" : "Page" }} sur {{ domaine(source.url) }} ·
      <a :href="source.url_archive" target="_blank" rel="noopener" class="underline underline-offset-2">copie archivée</a>
    </span>
  </div>
</template>
