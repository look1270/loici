# Contribuer à LoiCI

Merci de votre aide ! LoiCI vit grâce aux citoyens, journalistes, étudiants et chercheurs qui ajoutent et vérifient
les textes. Ce guide explique comment **ajouter une loi sourcée**, corriger une erreur, relire les propositions du robot
et modifier le code.

Avant tout, lisez les [règles du projet](#les-règles-en-bref) et le [code de conduite](CODE_OF_CONDUCT.md).

**Pas à l'aise avec GitHub ?** Ouvrez simplement une issue
« [Proposer un texte](../../issues/new?template=proposer-texte.yml) » ou
« [Signaler une erreur](../../issues/new?template=signaler-erreur.yml) » : une personne de l'équipe fera la saisie.

---

## Les règles en bref

1. **Zéro donnée sans source.** Chaque texte, étape, vote, révision et parlementaire cite au moins une source.
2. **Sources officielles d'abord** : assnat.ci, senat.ci, Journal officiel, Conseil constitutionnel, gouv.ci (et ses sous-domaines).
   La presse (AIP, Fraternité Matin, Abidjan.net…) ne vient que compléter.
3. **Ne jamais inventer.** Une information introuvable s'écrit `null` ; le site affiche « Non renseigné ».
   Une date approximative (« en octobre 2019 ») s'écrit `null`, jamais `2019-10-01`.
4. **Aucun document stocké.** On enregistre l'adresse du document et son lien d'archive, jamais le fichier.
5. **Neutralité.** Les résumés et libellés sont factuels : pas d'adjectif évaluatif (« ambitieux », « controversé »,
   « historique »…), pas de commentaire, pas d'opinion.

---

## Ajouter une loi sourcée, pas à pas

### 1. Trouver la source officielle

Cherchez le texte sur le site de l'Assemblée nationale, du Sénat, du Gouvernement (communiqués du Conseil des ministres)
ou dans le Journal officiel. Notez l'adresse exacte de la page ou du PDF.

> Vérifiez d'abord que le texte n'est pas déjà recensé : cherchez-le sur le site ou dans `donnees/textes/`.

### 2. Archiver la source

Ouvrez https://web.archive.org/save, collez l'adresse, lancez l'archivage. Copiez le lien obtenu, de la forme :

```
https://web.archive.org/web/20261114040658/https://www.gouv.ci/…
```

Le lien d'archive doit pointer vers **la même adresse** que la source. Sans archive, la source est refusée.

### 3. Créer le fichier de la source

Copiez [`docs/modeles/source.json`](docs/modeles/source.json) vers `donnees/sources/<id>.json`, puis remplissez-le :

| Champ | Contenu |
|---|---|
| `id` | Identifiant lisible, minuscules et tirets, préfixé `src-`. Ex. `src-gouv-ccm-2026-10-14`. **Le nom du fichier doit être `<id>.json`.** |
| `url` | Adresse de la page ou du PDF. |
| `titre` | Titre recopié tel quel. |
| `nom` | Émetteur : « Assemblée nationale de Côte d'Ivoire », « Agence ivoirienne de presse (AIP) »… |
| `type` | `officielle` si l'adresse est sur un domaine officiel (liste : `donnees/referentiels/domaines-officiels.json`), sinon `presse`. La CI le vérifie. |
| `format` | `page_web` ou `pdf`. |
| `date_publication` | Date affichée par l'émetteur, `AAAA-MM-JJ`, sinon `null`. |
| `date_consultation` | Date où vous avez lu la source. |
| `url_archive` | Lien obtenu à l'étape 2. |
| `empreinte_sha256` | Pour un PDF : son empreinte (`shasum -a 256 fichier.pdf` sous macOS/Linux, `certutil -hashfile fichier.pdf SHA256` sous Windows). Sinon `null`. |

Une même source peut servir à plusieurs textes : réutilisez-la plutôt que d'en créer une copie (la CI refuse les doublons d'adresse).

### 4. Créer le fichier du texte

Copiez [`docs/modeles/texte.json`](docs/modeles/texte.json) vers `donnees/textes/<id>.json`.

**Identité du texte**

| Champ | Contenu |
|---|---|
| `id` | Ex. `pl-2026-code-penal` (projet), `ppl-2026-…` (proposition), `loi-2019-870-…` (loi promulguée). |
| `titre_officiel` | Intitulé exact, recopié de la meilleure source officielle. |
| `type` | `projet_de_loi` (Gouvernement), `proposition_de_loi` (parlementaires), `projet_de_loi_ratification_ordonnance`. |
| `nature` | `ordinaire`, `organique`, `constitutionnelle`, `finances`, ou `null` si la source ne le dit pas. |
| `numero_depot`, `numero_loi` | S'ils sont publiés, sinon `null`. Un numéro de loi n'existe qu'une fois la loi promulguée. |
| `legislature_id` | Identifiant de `donnees/referentiels/legislatures.json`, ou `null`. |
| `themes` | Identifiants de `donnees/referentiels/themes.json`. |
| `resume` | 3 à 5 lignes neutres (150 à 700 caractères). Chaque fait doit se trouver dans les sources. |
| `document_principal_source_id` | La source ouverte par « Lire plus » : de préférence le PDF du projet ou le Journal officiel. Elle doit figurer dans `source_ids`. |
| `source_ids` | Les sources du titre, du résumé et des numéros. |
| `mis_a_jour_le` | Date du jour. |

**Acteurs** (`acteurs`) — qui porte le texte :

- Projet de loi : `{ "genre": "gouvernement", "ministre": …, "ministere": … }` avec le rôle `auteur`.
- Proposition de loi : `{ "genre": "parlementaire", "parlementaire_id": … }` ; le parlementaire doit avoir sa fiche
  dans `donnees/parlementaires/`.
- Rapporteur : rôle `rapporteur`, avec `commission_id`.

**Parcours** (`etapes`) — dans l'ordre chronologique. Chaque étape indique :

- `organe` : `gouvernement`, `bureau`, `commission`, `pleniere`, `conseil_constitutionnel` ou `presidence` ;
- `chambre` : obligatoire au Parlement (`assemblee_nationale` ou `senat`), `null` ailleurs ;
- `statut` : le statut atteint à l'issue de l'étape, ou `null` si l'étape ne le change pas (ex. Conseil des ministres) ;
- `vote` : en commission ou en plénière seulement, avec `pour`, `contre`, `abstention`, `votants` (`null` si inconnus)
  et `unanimite: true` **seulement** si la source écrit « à l'unanimité ».

Le `statut` du texte doit être celui de la dernière étape qui en porte un. Les statuts possibles :
`depose`, `en_commission`, `adopte_en_commission`, `adopte_en_pleniere`, `au_senat`, `adopte_definitivement`,
`promulgue`, et les sorties `rejete`, `retire`, `declare_non_conforme`.

**Révisions** (`revisions`) — amendements et nouvelles versions. Les extraits « avant / après » sont des citations courtes
(l'article modifié, 1 500 caractères au plus), jamais le document entier.

### 5. Vérifier en local (facultatif mais conseillé)

```bash
npm install
npm run valider   # mêmes règles que la CI : liste toutes les erreurs, fichier par fichier
npm run dev       # voir la fiche sur http://localhost:3000
```

### 6. Ouvrir la pull request

Remplissez le gabarit proposé. La CI vérifie automatiquement vos données et l'existence des archives.
Si elle échoue, chaque erreur est annotée sur le fichier concerné : corrigez puis poussez à nouveau.
Une personne de l'équipe relit **chaque source** avant de fusionner.

---

## Corriger une erreur

Modifiez le fichier concerné dans `donnees/` et **ajoutez la source** qui prouve la correction.
Une correction sans source ne peut pas être acceptée, même si elle paraît évidente.

---

## Relire les propositions du robot

Chaque jour, le robot ouvre (ou met à jour) une pull request « Robot de collecte : propositions à relire ».
Elle ne contient que des **sources**, avec des extraits pour vous guider. Pour chaque case :

1. ouvrez l'adresse et son archive, vérifiez le titre et la date ;
2. reliez la source au texte concerné (nouveau texte, nouvelle étape, nouvelle révision) ;
3. supprimez les sources sans intérêt législatif.

**Ne poussez pas de commit sur la branche `robot/collecte` tant que le robot la met à jour** : il ne l'écraserait pas,
mais il cesserait de la mettre à jour. Fusionnez d'abord, puis complétez dans une nouvelle pull request.

Si le robot ouvre une issue « un site source a changé », c'est que la structure d'un site a évolué :
le collecteur correspondant (`robot/loici_robot/collecteurs/`) doit être adapté.

---

## Modifier le code

```bash
npm install
npm run dev               # site en développement
npm test                  # tests TypeScript (schémas, contrôles, recherche)
npm run verifier:types    # types des scripts
npx nuxt typecheck        # types des pages
npm run generate          # construction du site statique

cd robot
python -m pip install -r requirements.txt
python -m unittest -v     # tests du robot (aucun site réel contacté)
```

Conventions :

- **Français** pour l'interface, les commentaires, les noms de variables et de fonctions.
- **Commentaires** : expliquer le *pourquoi*, surtout pour les règles liées aux sources.
- **Accessibilité** : viser WCAG AA (contrastes, libellés, navigation au clavier ; la couleur n'est jamais la seule information).
- **Légèreté** : le site est surtout consulté sur téléphone avec une connexion lente ; pas de dépendance superflue.
- Toute nouvelle règle de validation s'accompagne d'un test.

### Pour les mainteneurs : configurer le robot

Le robot tourne via `.github/workflows/robot.yml`. Pour que ses pull requests déclenchent la CI, créez un jeton GitHub
dédié (fine-grained, limité à ce dépôt, droits *Contents*, *Pull requests* et *Issues* en écriture) et enregistrez-le
comme secret `LOICI_ROBOT_TOKEN`. Ne collez jamais un jeton dans une issue, une discussion ou un fichier du dépôt.
Activez aussi *Settings → Actions → General → Allow GitHub Actions to create and approve pull requests*.

---

## Licences de vos contributions

En contribuant, vous acceptez que votre code soit publié sous [licence MIT](LICENSE) et vos données sous
[licence ODbL](donnees/LICENSE.md).
