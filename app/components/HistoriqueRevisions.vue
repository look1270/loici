<script setup lang="ts">
/** Amendements et versions successives, avec vue avant / après de l'article concerné. */
import type { Etape, Parlementaire, Revision } from "~~/schemas";

const props = defineProps<{ revisions: Revision[]; etapes: Etape[]; parlementaires: Record<string, Parlementaire> }>();

const libelleEtape = (id: string | null) => (id ? (props.etapes.find((e) => e.id === id)?.libelle ?? null) : null);

function nomAuteur(r: Revision): string | null {
  if (!r.auteur) return null;
  if (r.auteur.genre === "gouvernement") return ["Gouvernement", r.auteur.ministere].filter(Boolean).join(" — ");
  const p = props.parlementaires[r.auteur.parlementaire_id];
  return p ? [p.prenoms, p.nom].filter(Boolean).join(" ") : r.auteur.parlementaire_id;
}
</script>

<template>
  <p v-if="!revisions.length" class="text-muted">Aucun amendement ni aucune nouvelle version n'est enregistré pour ce texte.</p>
  <ol v-else class="space-y-4">
    <li v-for="r in revisions" :key="r.id" class="rounded-lg border border-default p-3 space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge
          :label="r.type === 'amendement' ? 'Amendement' : 'Nouvelle version'"
          :icon="r.type === 'amendement' ? 'i-lucide-pencil-line' : 'i-lucide-file-stack'"
          color="neutral"
          variant="subtle"
        />
        <span v-if="r.numero" class="text-sm">n° {{ r.numero }}</span>
        <span class="text-sm text-muted"><Valeur :valeur="formaterDate(r.date)" /></span>
        <UBadge v-if="r.sort" :label="SORTS_AMENDEMENT[r.sort]" color="neutral" variant="outline" size="sm" />
      </div>
      <p class="text-highlighted">{{ r.description }}</p>
      <dl class="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
        <dt class="text-muted">Article</dt>
        <dd><Valeur :valeur="r.article_vise" /></dd>
        <dt class="text-muted">Auteur</dt>
        <dd><Valeur :valeur="nomAuteur(r)" /></dd>
        <dt class="text-muted">Étape</dt>
        <dd><Valeur :valeur="libelleEtape(r.etape_id)" /></dd>
      </dl>
      <div v-if="r.extrait_avant !== null || r.extrait_apres !== null" class="grid gap-3 md:grid-cols-2">
        <figure class="rounded-md border border-default p-3">
          <figcaption class="mb-1 text-xs font-semibold uppercase text-muted">Avant</figcaption>
          <blockquote class="whitespace-pre-line text-sm"><Valeur :valeur="r.extrait_avant" /></blockquote>
        </figure>
        <figure class="rounded-md border border-primary/40 p-3">
          <figcaption class="mb-1 text-xs font-semibold uppercase text-muted">Après</figcaption>
          <blockquote class="whitespace-pre-line text-sm"><Valeur :valeur="r.extrait_apres" /></blockquote>
        </figure>
      </div>
      <RefsSources :ids="r.source_ids" />
    </li>
  </ol>
</template>
