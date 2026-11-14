<script setup lang="ts">
/** Renvois numérotés vers les sources d'une information : « Sources : [1] [4] ». */
const props = withDefaults(defineProps<{ ids: string[]; etiquette?: string }>(), { etiquette: "Sources" });
const contexte = utiliserSources();

const refs = computed(() =>
  props.ids
    .map((id) => ({ id, numero: contexte.value?.numero(id) ?? null, source: contexte.value?.parId[id] }))
    .filter((r) => r.numero !== null && r.source)
    .sort((a, b) => a.numero! - b.numero!),
);
</script>

<template>
  <p v-if="refs.length" class="text-xs text-muted">
    {{ etiquette }} :
    <template v-for="r in refs" :key="r.id">
      <a
        :href="`#source-${r.id}`"
        class="inline-block min-w-6 px-1 text-center underline underline-offset-2 hover:text-highlighted"
        :aria-label="`Source ${r.numero} : ${r.source!.nom}${r.source!.type === 'presse' ? ' (presse)' : ''}`"
        :title="r.source!.titre"
      >[{{ r.numero }}]</a>
    </template>
  </p>
</template>
