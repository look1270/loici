<script setup lang="ts">
/** Contribuer : rejoindre le projet sur GitHub pour proposer un texte, signaler une erreur ou un bug. */
useSeoMeta({
  title: "Contribuer — LoiCI",
  description: "Proposez une loi, signalez une erreur ou un bug, relisez les propositions : LoiCI se construit sur GitHub.",
});

const { depot } = useAppConfig();
const liens = liensDepot(depot);

const actions = [
  {
    icone: "i-lucide-file-plus",
    titre: "Proposer un texte",
    texte: "Une loi ou un projet manque ? Donnez son intitulé et un lien vers une source, de préférence officielle.",
    lien: liens.proposerTexte,
    bouton: "Proposer un texte",
  },
  {
    icone: "i-lucide-flag",
    titre: "Signaler une erreur ou une incohérence",
    texte:
      "Une date, un statut, un vote, un nom ou un résumé est faux ou contradictoire ? Indiquez la page et la source qui montre la bonne information.",
    lien: liens.signalerErreur,
    bouton: "Signaler une erreur",
  },
  {
    icone: "i-lucide-bug",
    titre: "Signaler un bug du site",
    texte: "Une page ne s'affiche pas, la recherche ne trouve rien, un bouton ne marche pas ? Décrivez ce que vous avez fait et ce que vous avez vu.",
    lien: liens.signalerBug,
    bouton: "Signaler un bug",
  },
];
</script>

<template>
  <UContainer class="py-6">
    <article class="max-w-3xl space-y-8">
      <header>
        <h1 class="text-2xl font-bold text-highlighted">Contribuer à LoiCI</h1>
        <p class="mt-2 text-muted">
          LoiCI est un projet citoyen et ouvert. Tout se passe sur GitHub : il suffit d'un compte gratuit pour remplir un
          formulaire. Une personne de l'équipe vérifie chaque proposition et vous répond dans l'issue.
        </p>
      </header>

      <section class="grid gap-4 sm:grid-cols-1">
        <div v-for="a in actions" :key="a.titre" class="rounded-lg border border-default p-4 space-y-3">
          <h2 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
            <UIcon :name="a.icone" class="size-5 shrink-0" aria-hidden="true" />
            {{ a.titre }}
          </h2>
          <p class="text-sm">{{ a.texte }}</p>
          <UButton :to="a.lien" target="_blank" rel="noopener" :label="a.bouton" trailing-icon="i-lucide-external-link" />
        </div>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">Rejoindre l'équipe</h2>
        <p>Vous voulez saisir des textes vous-même, relire les propositions du robot ou améliorer le site ?</p>
        <ol class="list-decimal space-y-2 ps-5">
          <li>Créez un compte sur <a href="https://github.com/signup" target="_blank" rel="noopener" class="underline">github.com</a>.</li>
          <li>
            Lisez le guide
            <a :href="liens.ajouterTexte" target="_blank" rel="noopener" class="underline">« Ajouter un texte »</a>
            et le <a :href="liens.guide" target="_blank" rel="noopener" class="underline">guide de contribution</a>.
          </li>
          <li>
            Choisissez une
            <a :href="liens.issuesOuvertes" target="_blank" rel="noopener" class="underline">demande ouverte</a>
            ou relisez une
            <a :href="liens.propositionsRobot" target="_blank" rel="noopener" class="underline">proposition du robot</a>.
          </li>
          <li>Proposez votre modification par pull request : la vérification automatique vous guide, un relecteur valide.</li>
        </ol>
        <div class="flex flex-wrap gap-2 pt-2">
          <UButton :to="liens.depot" target="_blank" rel="noopener" icon="i-lucide-github" label="Le projet sur GitHub" color="neutral" variant="outline" />
          <UButton :to="liens.wiki" target="_blank" rel="noopener" icon="i-lucide-book-open" label="Le wiki" color="neutral" variant="outline" />
        </div>
      </section>

      <section class="space-y-2">
        <h2 class="text-lg font-semibold text-highlighted">Les règles</h2>
        <ul class="list-disc space-y-1 ps-5">
          <li><strong>Une source pour chaque information</strong>, de préférence officielle. Sans source, une correction ne peut pas être acceptée.</li>
          <li><strong>Des faits, pas d'opinion</strong> : LoiCI reste neutre.</li>
          <li><strong>Un lien suffit</strong> : ne joignez pas de document entier.</li>
          <li>
            Respect du <a :href="`${depot}/blob/main/CODE_OF_CONDUCT.md`" target="_blank" rel="noopener" class="underline">code de conduite</a>.
          </li>
        </ul>
      </section>
    </article>
  </UContainer>
</template>
