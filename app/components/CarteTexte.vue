<script setup lang="ts">
/** Un texte dans la liste : titre, statut, type, dernière activité. Toute la carte est cliquable. */
import type { ResumeTexte } from "~~/schemas/api";

const props = defineProps<{ texte: ResumeTexte }>();
const auteur = computed(() => {
  const gouv = props.texte.auteurs_gouvernement[0];
  if (gouv) return gouv.ministere ? `Gouvernement — ${gouv.ministere}` : "Gouvernement";
  return props.texte.parlementaires.some((p) => p.role === "auteur") ? "Initiative parlementaire" : null;
});
</script>

<template>
  <article class="relative rounded-lg border border-default p-4 hover:bg-elevated focus-within:ring-2 focus-within:ring-primary">
    <div class="flex flex-wrap items-center gap-2">
      <BadgeStatut :statut="texte.statut" />
      <span class="text-sm text-muted">{{ TYPES_TEXTE[texte.type]?.libelle }}</span>
      <BadgeSourceNonOfficielle v-if="!texte.source_officielle" />
    </div>
    <h2 class="mt-2 font-semibold text-highlighted">
      <NuxtLink :to="`/textes/${texte.id}`" class="after:absolute after:inset-0">
        {{ texte.titre_officiel }}
      </NuxtLink>
    </h2>
    <p v-if="texte.numero_loi" class="text-sm">{{ texte.numero_loi }}</p>
    <p class="mt-1 text-sm text-muted">
      <template v-if="auteur">{{ auteur }} · </template>
      Dernière étape : <Valeur :valeur="formaterDate(texte.date_derniere_etape)" />
    </p>
  </article>
</template>
