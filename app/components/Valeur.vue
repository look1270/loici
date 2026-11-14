<script setup lang="ts">
/** Affiche une valeur, ou « Non renseigné » si elle est inconnue. Jamais de valeur inventée. */
defineProps<{ valeur: string | number | null | undefined }>();
</script>

<template>
  <span v-if="valeur !== null && valeur !== undefined && valeur !== ''">{{ valeur }}</span>
  <span v-else class="italic text-muted">{{ NON_RENSEIGNE }}</span>
</template>
