<script setup lang="ts">
/**
 * Personnalités : ministres porteurs et parlementaires cités par les textes recensés,
 * avec le nombre de textes qu'ils ont portés. Tout est déduit des fiches publiées.
 */
import type { Personnalite } from "~/utils/personnalites";

useSeoMeta({
  title: "Personnalités — LoiCI",
  description: "Ministres et parlementaires liés aux textes législatifs recensés, avec le nombre de textes portés.",
});

const { data: textes, status, error, refresh } = useTextes();
const { data: parlementaires } = useParlementaires();
const { depot } = useAppConfig();
const liens = liensDepot(depot);
const recherche = ref("");

const nomsParlementaires = computed(
  () => new Map((parlementaires.value ?? []).map((p) => [p.id, [p.prenoms, p.nom].filter(Boolean).join(" ")])),
);
const toutes = computed(() => listerPersonnalites(textes.value ?? [], nomsParlementaires.value));
const liste = computed(() => toutes.value.filter((p) => correspond(normaliser(p.nom), recherche.value)));

const LIBELLES_ROLE: Record<string, string> = { auteur: "porteur", rapporteur: "rapporteur", cosignataire: "cosignataire" };
const qualite = (p: Personnalite) =>
  p.genre === "gouvernement" ? (p.ministeres.length ? `Ministre — ${p.ministeres.join(" ; ")}` : "Ministre") : "Parlementaire";
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
</script>

<template>
  <UContainer class="py-6 space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-highlighted">Personnalités</h1>
      <p class="mt-1 text-muted">
        Ministres et parlementaires liés aux textes recensés, classés selon le nombre de textes qu'ils ont portés.
        Les nombres ne comptent que les textes présents dans LoiCI.
      </p>
    </div>

    <UFormField label="Rechercher une personnalité" name="personnalite">
      <UInput v-model="recherche" type="search" icon="i-lucide-search" size="lg" placeholder="Nom ou prénom" class="w-full" autocomplete="off" />
    </UFormField>

    <div aria-live="polite">
      <p v-if="status === 'pending' || status === 'idle'" class="text-muted">Chargement…</p>
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-wifi-off"
        title="Les données n'ont pas pu être chargées"
        :actions="[{ label: 'Réessayer', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />
      <template v-else>
        <p class="mb-3 text-sm text-muted">{{ pluriel(liste.length, "personnalité") }}</p>
        <p v-if="!liste.length" class="text-highlighted">Aucune personnalité ne correspond.</p>
        <ul class="grid gap-3 sm:grid-cols-2">
          <li v-for="p in liste" :id="p.cle" :key="p.cle" class="rounded-lg border border-default p-4 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="font-semibold text-highlighted">
                  <NuxtLink v-if="p.parlementaire_id" :to="`/parlementaires/${p.parlementaire_id}`" class="underline-offset-4 hover:underline">
                    {{ p.nom }}
                  </NuxtLink>
                  <template v-else>{{ p.nom }}</template>
                </h2>
                <p class="text-sm text-muted">{{ qualite(p) }}</p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-2xl font-bold text-highlighted leading-none">{{ p.nb_portes }}</p>
                <p class="text-xs text-muted">{{ p.nb_portes > 1 ? "textes portés" : "texte porté" }}</p>
              </div>
            </div>
            <ul class="space-y-1 text-sm">
              <li v-for="t in p.textes" :key="`${t.id}-${t.role}`">
                <NuxtLink :to="`/textes/${t.id}`" class="underline underline-offset-2">{{ t.titre }}</NuxtLink>
                <span class="text-muted"> · {{ LIBELLES_ROLE[t.role] }}<template v-if="t.annee"> · {{ t.annee }}</template></span>
              </li>
            </ul>
          </li>
        </ul>
      </template>
    </div>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-users"
      title="Une personnalité manque ou un nombre est faux ?"
      description="Les personnalités viennent des textes recensés. Proposez le texte manquant ou signalez l'erreur, source à l'appui."
      :actions="[
        { label: 'Proposer un texte', to: liens.proposerTexte, target: '_blank', variant: 'outline', color: 'neutral' },
        { label: 'Signaler une erreur', to: liens.signalerErreur, target: '_blank', variant: 'outline', color: 'neutral' },
      ]"
    />
  </UContainer>
</template>
