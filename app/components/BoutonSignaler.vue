<script setup lang="ts">
/**
 * « Signaler une erreur » : ouvre le formulaire GitHub pré-rempli avec l'adresse et le titre de la fiche.
 * L'adresse réelle n'est connue que dans le navigateur (page pré-générée) : elle est ajoutée au montage.
 */
const props = defineProps<{ titre: string }>();
const { depot } = useAppConfig();
const page = ref("");
onMounted(() => {
  page.value = window.location.href;
});
const lien = computed(() =>
  lienIssue(depot, "signaler-erreur.yml", {
    title: `Erreur : ${props.titre}`.slice(0, 200),
    ...(page.value ? { page: page.value } : {}),
  }),
);
</script>

<template>
  <UButton
    :to="lien"
    target="_blank"
    rel="noopener"
    icon="i-lucide-flag"
    label="Signaler une erreur"
    color="neutral"
    variant="outline"
    size="sm"
  />
</template>
