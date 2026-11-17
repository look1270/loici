<script setup lang="ts">
/** Un texte dans la liste : titre, statut, forme, dernière activité. Toute la carte est cliquable. */
import type { ResumeTexte } from "~~/schemas/api";

const props = defineProps<{ texte: ResumeTexte }>();
const nom = computed(() => nomAffiche(props.texte, props.texte.date_promulgation));
const auteur = computed(() => {
  const gouv = props.texte.auteurs_gouvernement[0];
  if (gouv) return gouv.ministere ? `Gouvernement — ${gouv.ministere}` : "Gouvernement";
  return props.texte.parlementaires.some((p) => p.role === "auteur") ? "Initiative parlementaire" : null;
});
</script>

<template>
  <article class="relative rounded-lg border border-default p-4 hover:bg-elevated focus-within:ring-2 focus-within:ring-primary">
    <div class="flex flex-wrap items-center gap-2">
      <BadgeStatut v-if="texte.statut" :statut="texte.statut" />
      <UBadge v-if="texte.vigueur === 'abroge'" color="neutral" variant="subtle" icon="i-lucide-archive" :label="texte.acte === 'decret' ? 'Abrogé' : 'Abrogée'" />
      <span class="text-sm text-muted">{{ natureAffichee(texte) }}</span>
      <BadgeSourceNonOfficielle v-if="!texte.source_officielle" />
    </div>
    <h2 class="mt-2 font-semibold text-highlighted">
      <NuxtLink :to="`/textes/${texte.id}`" class="after:absolute after:inset-0">
        {{ nom }}
      </NuxtLink>
    </h2>
    <p v-if="texte.numero_loi && !nom.startsWith(texte.numero_loi)" class="text-sm">{{ texte.numero_loi }}</p>
    <p v-else-if="texte.numero_acte && !nom.includes(texte.numero_acte)" class="text-sm">n° {{ texte.numero_acte }}</p>
    <p class="mt-1 text-sm text-muted">
      <template v-if="auteur">{{ auteur }} · </template>
      <template v-if="texte.acte === 'loi'">Dernière étape : <Valeur :valeur="formaterDate(texte.date_derniere_etape)" /></template>
      <template v-else>Signé le <Valeur :valeur="formaterDate(texte.date_signature)" /></template>
    </p>
  </article>
</template>
