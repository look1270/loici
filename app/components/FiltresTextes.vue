<script setup lang="ts">
/** Filtres de la liste. Un filtre sans aucune valeur possible n'est pas affiché. */
import type { Filtres, OptionFiltre } from "~/utils/recherche";

const filtres = defineModel<Filtres>({ required: true });
const props = defineProps<{ options: Record<Exclude<keyof Filtres, "q">, OptionFiltre[]> }>();

const champs: { cle: Exclude<keyof Filtres, "q">; libelle: string }[] = [
  { cle: "acte", libelle: "Forme" },
  { cle: "statut", libelle: "Statut" },
  { cle: "type", libelle: "Type" },
  { cle: "annee", libelle: "Année" },
  { cle: "legislature", libelle: "Législature" },
  { cle: "commission", libelle: "Commission" },
  { cle: "theme", libelle: "Thème" },
  { cle: "parti", libelle: "Parti" },
  { cle: "parlementaire", libelle: "Parlementaire" },
];
const visibles = computed(() => champs.filter((c) => props.options[c.cle].length > 0));

const changer = (cle: Exclude<keyof Filtres, "q">, valeur: string) => {
  filtres.value = { ...filtres.value, [cle]: valeur };
};
</script>

<template>
  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <UFormField v-for="champ in visibles" :key="champ.cle" :label="champ.libelle" :name="champ.cle">
      <USelect
        :model-value="filtres[champ.cle]"
        :items="[{ label: 'Tous', value: TOUS }, ...options[champ.cle]]"
        class="w-full"
        @update:model-value="(v: unknown) => changer(champ.cle, String(v))"
      />
    </UFormField>
  </div>
</template>
