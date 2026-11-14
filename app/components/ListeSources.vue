<script setup lang="ts">
/** Liste complète des sources d'une fiche, avec lien original et copie archivée. */
const contexte = utiliserSources();
</script>

<template>
  <ol v-if="contexte" class="space-y-4">
    <li
      v-for="(source, index) in contexte.liste"
      :id="`source-${source.id}`"
      :key="source.id"
      class="scroll-mt-4 rounded-lg border border-default p-3 target:ring-2 target:ring-primary"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-mono text-sm text-muted">[{{ index + 1 }}]</span>
        <UBadge
          v-if="source.type === 'officielle'"
          color="success"
          variant="subtle"
          size="sm"
          icon="i-lucide-shield-check"
          label="Source officielle"
        />
        <UBadge v-else color="neutral" variant="subtle" size="sm" icon="i-lucide-newspaper" label="Presse" />
        <span class="text-sm text-muted">{{ source.nom }}</span>
      </div>
      <p class="mt-2">
        <a :href="source.url" target="_blank" rel="noopener" class="font-medium underline underline-offset-2">
          {{ source.titre }}
          <span class="sr-only">(nouvel onglet)</span>
        </a>
        <span class="text-sm text-muted"> · {{ domaine(source.url) }}<template v-if="source.format === 'pdf'"> · PDF</template></span>
      </p>
      <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt class="text-muted">Publiée le</dt>
        <dd><Valeur :valeur="formaterDate(source.date_publication)" /></dd>
        <dt class="text-muted">Consultée le</dt>
        <dd>{{ formaterDate(source.date_consultation) }}</dd>
        <dt class="text-muted">Archive</dt>
        <dd>
          <a :href="source.url_archive" target="_blank" rel="noopener" class="underline underline-offset-2">
            Copie Wayback Machine<span class="sr-only"> (nouvel onglet)</span>
          </a>
        </dd>
      </dl>
    </li>
  </ol>
</template>
