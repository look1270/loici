<script setup lang="ts">
/**
 * Une catégorie : ses sous-catégories (avec leur nombre de textes), puis la liste de ses textes,
 * filtrable par forme (loi, ordonnance, décret) et par année. Les choix sont recopiés dans l'adresse
 * (?sous=…&acte=…&annee=…) : une sélection se partage par lien.
 */
import type { OptionFiltre } from "~/utils/recherche";

const route = useRoute();
const router = useRouter();
const id = String(route.params.id);

const { data: textes, status, error, refresh } = useTextes();
const { data: referentiels } = useReferentiels();

const categorie = computed(() => (referentiels.value ? trouverCategorie(referentiels.value.categories, id) : undefined));

interface Choix {
  sous: string;
  acte: string;
  annee: string;
}
const lireChoix = (q: Record<string, unknown>): Choix => ({
  sous: typeof q.sous === "string" && q.sous ? q.sous : TOUS,
  acte: typeof q.acte === "string" && q.acte ? q.acte : TOUS,
  annee: typeof q.annee === "string" && q.annee ? q.annee : TOUS,
});
const choix = ref<Choix>(lireChoix(route.query));
const memes = (a: Choix, b: Choix) => a.sous === b.sous && a.acte === b.acte && a.annee === b.annee;

// Même principe que l'accueil : la page est pré-générée sans paramètres, on lit l'adresse réelle au montage.
onMounted(() => {
  watch(
    () => route.query,
    (q) => {
      const depuisAdresse = lireChoix(q);
      if (!memes(depuisAdresse, choix.value)) choix.value = depuisAdresse;
    },
    { immediate: true },
  );
  watch(
    choix,
    (c) => {
      if (memes(c, lireChoix(route.query))) return;
      const query = Object.fromEntries(Object.entries(c).filter(([, v]) => v !== TOUS));
      router.replace({ query });
    },
    { deep: true },
  );
});

const duLot = computed(() => textesDeCategorie(textes.value ?? [], id));
const sousCategories = computed(() => (categorie.value ? sousCategoriesAvecNombre(categorie.value, textes.value ?? []) : []));
const dansSous = computed(() => filtrerSousCategorie(duLot.value, choix.value.sous));
const resultats = computed(() =>
  filtrerTextes(dansSous.value, { ...FILTRES_VIDES, acte: choix.value.acte, annee: choix.value.annee }),
);

/** Options présentes dans la sous-catégorie choisie, avec leur effectif. */
function options(valeurs: string[], libelle: (v: string) => string, ordre?: (a: string, b: string) => number): OptionFiltre[] {
  const effectifs = new Map<string, number>();
  for (const v of valeurs) effectifs.set(v, (effectifs.get(v) ?? 0) + 1);
  const cles = [...effectifs.keys()];
  if (ordre) cles.sort(ordre);
  return [{ label: "Tous", value: TOUS }, ...cles.map((v) => ({ value: v, label: `${libelle(v)} (${effectifs.get(v)})` }))];
}
const ORDRE_ACTES = Object.keys(ACTES);
const optionsActe = computed(() =>
  options(
    dansSous.value.map((t) => t.acte),
    (v) => ACTES[v]?.libelle ?? v,
    (a, b) => ORDRE_ACTES.indexOf(a) - ORDRE_ACTES.indexOf(b),
  ),
);
const optionsAnnee = computed(() =>
  options(
    dansSous.value.flatMap((t) => (t.annee ? [String(t.annee)] : [])),
    (v) => v,
    (a, b) => b.localeCompare(a),
  ),
);

const sousChoisie = computed(() => sousCategories.value.find((s) => s.id === choix.value.sous) ?? null);
const reinitialiser = () => (choix.value = { sous: TOUS, acte: TOUS, annee: TOUS });

useHead({ title: computed(() => (categorie.value ? `${categorie.value.libelle} — LoiCI` : "Catégorie — LoiCI")) });
</script>

<template>
  <UContainer class="py-6 space-y-5">
    <nav aria-label="Fil d'Ariane" class="text-sm text-muted">
      <ol class="flex flex-wrap items-center gap-1">
        <li><NuxtLink to="/" class="underline underline-offset-2">Accueil</NuxtLink></li>
        <li aria-hidden="true">›</li>
        <li :aria-current="sousChoisie ? undefined : 'page'">
          <button v-if="sousChoisie" type="button" class="underline underline-offset-2" @click="choix.sous = TOUS">
            {{ categorie?.libelle ?? "Catégorie" }}
          </button>
          <span v-else>{{ categorie?.libelle ?? "Catégorie" }}</span>
        </li>
        <template v-if="sousChoisie">
          <li aria-hidden="true">›</li>
          <li aria-current="page">{{ sousChoisie.libelle }}</li>
        </template>
      </ol>
    </nav>

    <div aria-live="polite">
      <p v-if="categorie === undefined || status === 'pending' || status === 'idle'" class="text-muted">Chargement…</p>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-wifi-off"
        title="Les textes n'ont pas pu être chargés"
        description="Vérifiez votre connexion, puis réessayez."
        :actions="[{ label: 'Réessayer', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />

      <UAlert
        v-else-if="categorie === null"
        color="neutral"
        variant="subtle"
        icon="i-lucide-search-x"
        title="Catégorie introuvable"
        description="Cette catégorie n'existe pas. Retrouvez toutes les catégories depuis l'accueil."
      />

      <div v-else class="space-y-5">
        <header>
          <h1 class="text-2xl font-bold text-highlighted">{{ categorie.libelle }}</h1>
          <p class="mt-1 text-muted">{{ categorie.explication }}</p>
        </header>

        <section v-if="sousCategories.length" aria-labelledby="titre-sous">
          <h2 id="titre-sous" class="mb-2 font-semibold text-highlighted">Sous-catégories</h2>
          <ul class="flex flex-wrap gap-2">
            <li>
              <UButton
                :label="`Toutes (${duLot.length})`"
                size="sm"
                :color="choix.sous === TOUS ? 'primary' : 'neutral'"
                :variant="choix.sous === TOUS ? 'solid' : 'outline'"
                :aria-pressed="choix.sous === TOUS"
                @click="choix = { ...choix, sous: TOUS }"
              />
            </li>
            <li v-for="s in sousCategories" :key="s.id">
              <UButton
                :label="`${s.libelle} (${s.nombre})`"
                size="sm"
                :color="choix.sous === s.id ? 'primary' : 'neutral'"
                :variant="choix.sous === s.id ? 'solid' : 'outline'"
                :aria-pressed="choix.sous === s.id"
                @click="choix = { ...choix, sous: s.id }"
              />
            </li>
          </ul>
        </section>

        <div class="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
          <UFormField label="Type" name="acte">
            <USelect v-model="choix.acte" :items="optionsActe" class="w-full" />
          </UFormField>
          <UFormField label="Année" name="annee">
            <USelect v-model="choix.annee" :items="optionsAnnee" class="w-full" />
          </UFormField>
        </div>

        <section aria-labelledby="titre-liste">
          <h2 id="titre-liste" class="sr-only">Textes</h2>
          <p class="mb-3 text-sm text-muted">
            {{ resultats.length }} texte{{ resultats.length > 1 ? "s" : "" }}
            <template v-if="resultats.length !== duLot.length"> sur {{ duLot.length }}</template>
            · du plus récemment actif au plus ancien
          </p>
          <div v-if="!resultats.length" class="space-y-1">
            <p class="text-highlighted">
              Aucun texte recensé ici pour l'instant.
              <UButton
                v-if="choix.sous !== TOUS || choix.acte !== TOUS || choix.annee !== TOUS"
                label="Effacer les filtres"
                variant="link"
                class="p-0"
                @click="reinitialiser"
              />
            </p>
            <p class="text-sm text-muted">
              Vous connaissez un texte qui manque ?
              <NuxtLink to="/contribuer" class="underline">Proposez-le</NuxtLink> (un lien vers une source suffit).
            </p>
          </div>
          <ul class="space-y-3">
            <li v-for="t in resultats" :key="t.id"><CarteTexte :texte="t" /></li>
          </ul>
        </section>
      </div>
    </div>
  </UContainer>
</template>
