<script setup lang="ts">
/** Qui a porté le texte : auteur(s), rapporteur(s), cosignataire(s). */
import type { Commission, Parlementaire, Parti, TexteActeur } from "~~/schemas";
import type { RoleActeur } from "~~/schemas/statuts";
import { ROLES_ACTEUR } from "~~/schemas/statuts";

const props = defineProps<{
  acteurs: TexteActeur[];
  legislatureId: string | null;
  parlementaires: Record<string, Parlementaire>;
  partis: Record<string, Parti>;
  commissions: Record<string, Commission>;
}>();

const parRole = computed(() =>
  ROLES_ACTEUR.map((role) => ({ role, liste: props.acteurs.filter((a) => a.role === role) })).filter((g) => g.liste.length),
);

const titreRole = (role: RoleActeur, n: number) => (n > 1 ? `${ROLES[role]}s` : ROLES[role]);

/** Parti du parlementaire pendant la législature du texte, sinon null (jamais deviné). */
function partiPendantLeTexte(parlementaireId: string): string | null {
  if (!props.legislatureId) return null;
  const mandat = props.parlementaires[parlementaireId]?.mandats.find((m) => m.legislature_id === props.legislatureId);
  if (!mandat?.parti_id) return null;
  const parti = props.partis[mandat.parti_id];
  return parti ? (parti.sigle ? `${parti.nom} (${parti.sigle})` : parti.nom) : null;
}
</script>

<template>
  <p v-if="!acteurs.length"><Valeur :valeur="null" /></p>
  <div v-else class="space-y-4">
    <section v-for="groupe in parRole" :key="groupe.role">
      <h3 class="text-sm font-semibold text-muted">{{ titreRole(groupe.role, groupe.liste.length) }}</h3>
      <ul class="mt-1 space-y-3">
        <li v-for="(a, i) in groupe.liste" :key="i">
          <template v-if="a.acteur.genre === 'gouvernement'">
            <p class="font-medium text-highlighted">Gouvernement</p>
            <dl class="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
              <dt class="text-muted">Ministère</dt>
              <dd><Valeur :valeur="a.acteur.ministere" /></dd>
              <dt class="text-muted">Ministre</dt>
              <dd><Valeur :valeur="a.acteur.ministre" /></dd>
            </dl>
          </template>
          <template v-else>
            <NuxtLink :to="`/parlementaires/${a.acteur.parlementaire_id}`" class="font-medium underline underline-offset-2">
              <Valeur
                :valeur="
                  parlementaires[a.acteur.parlementaire_id]
                    ? [parlementaires[a.acteur.parlementaire_id]!.prenoms, parlementaires[a.acteur.parlementaire_id]!.nom]
                        .filter(Boolean)
                        .join(' ')
                    : a.acteur.parlementaire_id
                "
              />
            </NuxtLink>
            <p class="text-sm">Parti : <Valeur :valeur="partiPendantLeTexte(a.acteur.parlementaire_id)" /></p>
          </template>
          <p v-if="a.commission_id" class="text-sm">
            Commission : {{ commissions[a.commission_id]?.nom ?? a.commission_id }}
          </p>
          <RefsSources :ids="a.source_ids" />
        </li>
      </ul>
    </section>
    <p v-if="!acteurs.some((a) => a.role === 'rapporteur')" class="text-sm">
      Rapporteur : <Valeur :valeur="null" />
    </p>
  </div>
</template>
