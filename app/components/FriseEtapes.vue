<script setup lang="ts">
/** Frise chronologique du parcours du texte. Une étape sans date l'indique au lieu de la deviner. */
import type { Commission, Etape } from "~~/schemas";

const props = defineProps<{ etapes: Etape[]; commissions: Record<string, Commission> }>();

/** « Commission des Affaires économiques et financières (CAEF) » ; l'identifiant brut si la commission est inconnue. */
function nomCommission(id: string): string {
  const c = props.commissions[id];
  if (!c) return id;
  return c.sigle ? `${c.nom} (${c.sigle})` : c.nom;
}
</script>

<template>
  <ol class="relative space-y-6 border-s-2 border-default ps-6">
    <li v-for="etape in etapes" :key="etape.id" class="relative">
      <span
        class="absolute -start-[2.15rem] top-0.5 flex size-6 items-center justify-center rounded-full bg-default ring-2 ring-(--ui-border)"
        aria-hidden="true"
      >
        <UIcon :name="ORGANES[etape.organe]?.icone ?? 'i-lucide-circle'" class="size-3.5 text-muted" />
      </span>

      <p class="text-sm font-medium">
        <time v-if="etape.date" :datetime="etape.date">{{ formaterDate(etape.date) }}</time>
        <span v-else class="italic text-muted">Date : {{ NON_RENSEIGNE.toLowerCase() }}</span>
      </p>
      <p class="text-sm text-muted">
        {{ ORGANES[etape.organe]?.libelle }}<template v-if="etape.chambre"> · {{ CHAMBRES[etape.chambre] }}</template>
      </p>
      <p class="mt-1 text-highlighted">{{ etape.libelle }}</p>
      <p v-if="etape.commission_id" class="text-sm">
        {{ nomCommission(etape.commission_id) }}
      </p>
      <div v-if="etape.statut" class="mt-2"><BadgeStatut :statut="etape.statut" /></div>
      <ResultatVote v-if="etape.vote" :vote="etape.vote" class="mt-2" />
      <RefsSources :ids="etape.source_ids" class="mt-1" />
    </li>
  </ol>
</template>
