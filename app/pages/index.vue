<script setup lang="ts">
/**
 * Liste des textes : recherche libre + filtres, entièrement dans le navigateur.
 * Les filtres sont recopiés dans l'adresse de la page : une recherche se partage par simple lien.
 * Parcours visé : accueil → recherche ou filtre → fiche, soit moins de 3 clics.
 */
import type { OptionFiltre } from "~/utils/recherche";
import { STATUTS } from "~~/schemas/statuts";

useSeoMeta({
  title: "LoiCI — Les lois de Côte d'Ivoire",
  description: "Recherchez les projets et propositions de loi ivoiriens, leur statut, leur parcours et leurs sources.",
});

const route = useRoute();
const router = useRouter();

const { data: textes, status, error, refresh } = useTextes();
const { data: referentiels } = useReferentiels();
const { data: parlementaires } = useParlementaires();
const { data: partis } = usePartis();

const filtres = ref<Filtres>(requeteVersFiltres(route.query));
const afficherFiltres = ref(nombreFiltresActifs(filtres.value) > 0);

/** Compare deux jeux de filtres (évite les allers-retours infinis entre adresse et filtres). */
const memes = (a: Filtres, b: Filtres) => JSON.stringify(a) === JSON.stringify(b);

// La page est pré-générée sans paramètres : pendant l'hydratation, `route.query` est vide.
// Au montage, le routeur porte l'adresse réelle : on applique alors la recherche partagée par lien
// (ex. /?q=budget&statut=promulgue), puis on suit ses changements (bouton « Précédent » du navigateur).
onMounted(() => {
  watch(
    () => route.query,
    (requete) => {
      const depuisAdresse = requeteVersFiltres(requete);
      if (memes(depuisAdresse, filtres.value)) return;
      filtres.value = depuisAdresse;
      if (nombreFiltresActifs(depuisAdresse) > 0) afficherFiltres.value = true;
    },
    { immediate: true },
  );
  watch(
    filtres,
    (f) => {
      if (!memes(f, requeteVersFiltres(route.query))) router.replace({ query: filtresVersRequete(f) });
    },
    { deep: true },
  );
});

const nomsParlementaires = computed(
  () => new Map((parlementaires.value ?? []).map((p) => [p.id, [p.prenoms, p.nom].filter(Boolean).join(" ")])),
);

const resultats = computed(() => filtrerTextes(textes.value ?? [], filtres.value, nomsParlementaires.value));
const nbActifs = computed(() => nombreFiltresActifs(filtres.value));

/** Options d'un filtre : seulement les valeurs présentes dans les données, avec leur effectif. */
function optionsDepuis(valeurs: string[], libelle: (v: string) => string, ordre?: (a: string, b: string) => number): OptionFiltre[] {
  const effectifs = new Map<string, number>();
  for (const v of valeurs) effectifs.set(v, (effectifs.get(v) ?? 0) + 1);
  const cles = [...effectifs.keys()];
  if (ordre) cles.sort(ordre);
  return cles.map((v) => ({ value: v, label: `${libelle(v)} (${effectifs.get(v)})` }));
}

const options = computed(() => {
  const t = textes.value ?? [];
  const ref = referentiels.value;
  const nomCommission = (id: string) => {
    const c = ref?.commissions.find((x) => x.id === id);
    return c ? `${c.sigle ?? c.nom} — ${CHAMBRES[c.chambre]}` : id;
  };
  const nomParti = (id: string) => {
    const p = partis.value?.find((x) => x.id === id);
    return p ? (p.sigle ?? p.nom) : id;
  };
  return {
    statut: optionsDepuis(
      t.map((x) => x.statut),
      (v) => STATUTS_INFOS[v as keyof typeof STATUTS_INFOS]?.libelle ?? v,
      (a, b) => STATUTS.indexOf(a as never) - STATUTS.indexOf(b as never),
    ),
    type: optionsDepuis(
      t.map((x) => x.type),
      (v) => TYPES_TEXTE[v]?.libelle ?? v,
    ),
    annee: optionsDepuis(
      t.flatMap((x) => (x.annee ? [String(x.annee)] : [])),
      (v) => v,
      (a, b) => b.localeCompare(a),
    ),
    legislature: optionsDepuis(
      t.flatMap((x) => (x.legislature_id ? [x.legislature_id] : [])),
      (v) => ref?.legislatures.find((l) => l.id === v)?.libelle ?? v,
    ),
    commission: optionsDepuis(
      t.flatMap((x) => x.commission_ids),
      nomCommission,
    ),
    theme: optionsDepuis(
      t.flatMap((x) => x.themes),
      (v) => ref?.themes.find((th) => th.id === v)?.libelle ?? v,
    ),
    parti: optionsDepuis(
      t.flatMap((x) => x.parti_ids),
      nomParti,
    ),
    parlementaire: optionsDepuis(
      t.flatMap((x) => [...new Set(x.parlementaires.map((p) => p.id))]),
      (v) => nomsParlementaires.value.get(v) ?? v,
    ),
  };
});

const reinitialiser = () => {
  filtres.value = { ...FILTRES_VIDES };
};
</script>

<template>
  <UContainer class="py-6 space-y-5">
    <div>
      <h1 class="text-2xl font-bold text-highlighted">Les lois de Côte d'Ivoire</h1>
      <p class="mt-1 text-muted">
        Projets et propositions de loi, leur parcours au Parlement et leurs sources. Chaque information renvoie à sa source.
      </p>
    </div>

    <form role="search" class="space-y-3" @submit.prevent>
      <UFormField label="Rechercher un texte" name="q" help="Titre, numéro de loi, ministère, ministre ou parlementaire">
        <UInput
          v-model="filtres.q"
          type="search"
          icon="i-lucide-search"
          size="xl"
          placeholder="Ex. : finances, femme, 2019-870…"
          class="w-full"
          autocomplete="off"
        />
      </UFormField>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          :label="nbActifs ? `Filtres (${nbActifs})` : 'Filtres'"
          icon="i-lucide-sliders-horizontal"
          color="neutral"
          variant="outline"
          :aria-expanded="afficherFiltres"
          aria-controls="filtres"
          @click="afficherFiltres = !afficherFiltres"
        />
        <UButton
          v-if="nbActifs || filtres.q"
          label="Tout effacer"
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          @click="reinitialiser"
        />
      </div>

      <div v-show="afficherFiltres" id="filtres">
        <FiltresTextes v-model="filtres" :options="options" />
      </div>
    </form>

    <div aria-live="polite">
      <p v-if="status === 'pending' || status === 'idle'" class="text-muted">Chargement des textes…</p>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-wifi-off"
        title="Les textes n'ont pas pu être chargés"
        description="Vérifiez votre connexion, puis réessayez."
        :actions="[{ label: 'Réessayer', color: 'error', variant: 'outline', onClick: () => refresh() }]"
      />

      <template v-else>
        <p class="mb-3 text-sm text-muted">
          {{ resultats.length }} texte{{ resultats.length > 1 ? "s" : "" }}
          <template v-if="resultats.length !== (textes?.length ?? 0)"> sur {{ textes?.length ?? 0 }}</template>
          · du plus récemment actif au plus ancien
        </p>
        <p v-if="!resultats.length" class="text-highlighted">
          Aucun texte ne correspond.
          <UButton label="Effacer la recherche et les filtres" variant="link" class="p-0" @click="reinitialiser" />
        </p>
        <ul class="space-y-3">
          <li v-for="t in resultats" :key="t.id"><CarteTexte :texte="t" /></li>
        </ul>
      </template>
    </div>
  </UContainer>
</template>
