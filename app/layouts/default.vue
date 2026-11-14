<script setup lang="ts">
/** Gabarit commun : en-tête, contenu, pied de page. */
const { data: meta } = useMetaApi();
const route = useRoute();

const liens = [
  { libelle: "Textes", vers: "/" },
  { libelle: "Personnalités", vers: "/personnalites" },
  { libelle: "Parlementaires", vers: "/parlementaires" },
  { libelle: "Méthodologie", vers: "/methodologie" },
  { libelle: "Contribuer", vers: "/contribuer" },
];
const { depot } = useAppConfig();
const liensGithub = liensDepot(depot);

/** Lien actif : la fiche d'un texte reste rattachée à « Textes ». */
const estActif = (vers: string) =>
  vers === "/" ? route.path === "/" || route.path.startsWith("/textes") : route.path.startsWith(vers);
</script>

<template>
  <div class="min-h-dvh flex flex-col bg-default">
    <a
      href="#contenu"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-inverted focus:px-3 focus:py-2 focus:text-inverted"
    >
      Aller au contenu
    </a>

    <header class="border-b border-default">
      <UContainer class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
        <NuxtLink to="/" class="font-bold text-lg text-highlighted">
          LoiCI
          <span class="sr-only">— Observatoire citoyen des lois de Côte d'Ivoire</span>
        </NuxtLink>
        <nav aria-label="Navigation principale">
          <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <li v-for="lien in liens" :key="lien.vers">
              <NuxtLink
                :to="lien.vers"
                class="underline-offset-4 hover:underline"
                :class="estActif(lien.vers) ? 'font-semibold text-highlighted underline' : 'text-muted'"
                :aria-current="estActif(lien.vers) ? 'page' : undefined"
              >
                {{ lien.libelle }}
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </UContainer>
    </header>

    <main id="contenu" class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default text-sm text-muted">
      <UContainer class="py-6 space-y-1">
        <p>Accès libre : sans compte, sans publicité, sans traceur.</p>
        <p>
          Code sous licence MIT · Données sous licence ODbL
          <template v-if="meta"> · Données générées le {{ formaterDate(meta.genere_le) }}</template>
        </p>
        <p class="flex flex-wrap gap-x-3 gap-y-1">
          <NuxtLink to="/methodologie" class="underline">Méthodologie et sources</NuxtLink>
          <NuxtLink to="/contribuer" class="underline">Contribuer</NuxtLink>
          <a :href="liensGithub.signalerErreur" target="_blank" rel="noopener" class="underline">Signaler une erreur</a>
          <a :href="liensGithub.signalerBug" target="_blank" rel="noopener" class="underline">Signaler un bug</a>
          <a :href="liensGithub.depot" target="_blank" rel="noopener" class="underline">Code source (GitHub)</a>
        </p>
      </UContainer>
    </footer>
  </div>
</template>
