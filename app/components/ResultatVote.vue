<script setup lang="ts">
/** Résultat d'un vote : pour / contre / abstention, ou « à l'unanimité ». Chaque chiffre inconnu = « Non renseigné ». */
import type { Vote } from "~~/schemas";

const props = defineProps<{ vote: Vote }>();
const chiffres = computed(() => [
  { libelle: "Pour", valeur: props.vote.pour },
  { libelle: "Contre", valeur: props.vote.contre },
  { libelle: "Abstention", valeur: props.vote.abstention },
  { libelle: "Votants", valeur: props.vote.votants },
]);
const aucunChiffre = computed(() => chiffres.value.every((c) => c.valeur === null));
</script>

<template>
  <div class="rounded-md bg-elevated p-3 text-sm space-y-2">
    <p class="font-medium text-highlighted">
      Vote : {{ vote.resultat === "adopte" ? "adopté" : "rejeté" }}<template v-if="vote.unanimite"> à l'unanimité</template>
    </p>
    <p v-if="aucunChiffre" class="text-muted">Décompte des voix : <Valeur :valeur="null" /></p>
    <dl v-else class="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div v-for="c in chiffres" :key="c.libelle">
        <dt class="text-muted">{{ c.libelle }}</dt>
        <dd class="text-lg font-semibold tabular-nums">
          <Valeur :valeur="c.valeur === null ? null : formaterNombre(c.valeur)" />
        </dd>
      </div>
    </dl>
    <RefsSources :ids="vote.source_ids" etiquette="Sources du vote" />
  </div>
</template>
