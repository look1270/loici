# LoiCI — Observatoire citoyen des lois de Côte d'Ivoire

LoiCI recense les textes législatifs ivoiriens — projets de loi, propositions de loi, ratifications d'ordonnances,
lois promulguées — et leur parcours au Parlement, qu'ils soient en cours d'examen, adoptés, rejetés ou retirés.

🌐 **Site : https://look1270.github.io/loici/** · 📖 **[Wiki](https://github.com/look1270/loici/wiki)** · 📦 **[Données JSON](https://look1270.github.io/loici/api/v1/textes.json)**

**Pour qui ?** Citoyens, journalistes, étudiants, chercheurs. Pensé d'abord pour le téléphone et les connexions lentes.

**Objectif :** sans créer de compte, trouver une loi en moins de 3 clics, comprendre son statut en 5 secondes,
voir qui l'a portée et ce qui a été modifié, et vérifier chaque information en cliquant sur sa source.

## Principes

| | |
|---|---|
| **Accès libre** | Aucun compte, aucun paiement, aucune publicité, aucun traceur. |
| **Zéro donnée sans source** | Chaque texte, étape, vote, révision et parlementaire cite au moins une source, avec sa copie archivée (Wayback Machine). |
| **Aucun document stocké** | Seul un index léger est conservé ; les textes restent sur les sites officiels. « Lire plus » ouvre l'original, ou son archive si le site ne répond plus. |
| **Ne jamais inventer** | Une information inconnue est affichée « Non renseigné ». |
| **Neutralité** | Résumés factuels, aucune couleur partisane, aucun commentaire. |
| **Sources officielles d'abord** | Assemblée nationale, Sénat, Journal officiel, Conseil constitutionnel, Gouvernement ; la presse ensuite. Un texte sans source officielle porte le badge « Source non officielle ». |

La méthode complète est expliquée sur la page « Méthodologie et sources » du site (`app/pages/methodologie.vue`).

## Contribuer

Vous pouvez ajouter une loi, corriger une erreur ou relire les propositions du robot : voir **[CONTRIBUTING.md](CONTRIBUTING.md)**.
Sans compétence technique, ouvrez simplement une issue « Proposer un texte » ou « Signaler une erreur ».

## Fonctionnement

```
Sites officiels ──(robot quotidien)──▶ pull request ──(relecture humaine + CI)──▶ donnees/*.json
                                                                                       │
                                               npm run generate (GitHub Pages)       ▼
                       Navigateur ◀── /api/v1/*.json + pages statiques ◀── validation + API JSON
```

- **Données** : fichiers JSON versionnés dans [`donnees/`](donnees/) — un fichier par texte, par source, par parlementaire, par parti.
- **Validation** : schémas Zod ([`schemas/`](schemas/)) et contrôles entre fichiers ([`scripts/lib/`](scripts/lib/)).
  La CI refuse toute donnée sans source valide ; la construction du site applique exactement les mêmes règles.
- **Site** : Nuxt 4 + Nuxt UI, généré en pages 100 % statiques. Les données sont lues par le navigateur à chaque visite
  depuis `/api/v1/` ; la recherche et les filtres fonctionnent sans serveur.
- **Robot** ([`robot/`](robot/)) : chaque jour, il lit les communiqués du Conseil des ministres et les articles de l'Assemblée
  nationale, archive les nouvelles sources, détecte les nouvelles versions des PDF et les liens morts,
  puis ouvre une pull request. **Il ne publie jamais directement.**

### Arborescence

```
app/                 Site (pages, composants, logique de recherche)
schemas/             Schémas des données (Zod) et format de l'API
scripts/             Validation des données et génération de l'API JSON
donnees/             Données sous licence ODbL
  textes/ sources/ parlementaires/ partis/ referentiels/
robot/               Robot de collecte (Python)
tests/               Tests TypeScript
docs/modeles/        Modèles de fichiers à copier pour contribuer
.github/             CI, robot quotidien, gabarits d'issues et de pull requests
```

## Démarrer en local

Prérequis : Node.js 22 ou plus (24 recommandé, voir `.nvmrc`) ; Python 3.9 ou plus pour le robot.

```bash
npm install
npm run dev            # site sur http://localhost:3000
npm run valider        # valide toutes les données (mêmes règles que la CI)
npm run chercher -- 2019          # recherche : mot du titre, année, numéro, ministre ou parlementaire
npm run chercher -- --personnalites   # personnalités et nombre de textes portés
npm test               # tests
npm run generate       # site statique dans .output/public
npm run preview        # sert le site généré
```

Robot de collecte :

```bash
python -m pip install -r robot/requirements.txt
PYTHONPATH=robot python -m loici_robot --essai     # essai : n'archive rien, n'écrit rien
(cd robot && python -m unittest -v)                # tests, sans contacter aucun site
```

## Réutiliser les données

Les données sont publiées en JSON, en lecture libre, sous **licence ODbL** :

| Fichier | Contenu |
|---|---|
| `/api/v1/textes.json` | liste de tous les textes (statut, dates, éléments de filtre) |
| `/api/v1/textes/<id>.json` | fiche complète d'un texte, avec toutes ses sources |
| `/api/v1/parlementaires.json`, `/api/v1/parlementaires/<id>.json` | parlementaires et mandats |
| `/api/v1/partis.json` | partis |
| `/api/v1/referentiels.json` | législatures, commissions, thèmes, domaines officiels |
| `/api/v1/meta.json` | date de génération et effectifs |

Le format est décrit dans [`schemas/api.ts`](schemas/api.ts). Merci de citer « LoiCI, sous licence ODbL ».

## Déploiement

**GitHub Pages (actuel)** : le workflow [`pages.yml`](.github/workflows/pages.yml) valide les données, génère le site
avec le préfixe `/loici/` (`NUXT_APP_BASE_URL`) et le publie sur https://look1270.github.io/loici/ à chaque push sur `main`.
Voir le wiki : [Déploiement](https://github.com/look1270/loici/wiki/Deploiement).

**Cloudflare Pages (alternative)** :

| Réglage | Valeur |
|---|---|
| Commande de build | `npm run generate` |
| Dossier publié | `.output/public` |
| Variable d'environnement | `NODE_VERSION` = `24` |

Chaque fusion sur la branche principale reconstruit le site et l'API. Aucun serveur, aucune base de données.

Après création du dépôt GitHub, à configurer :

1. **Protéger la branche principale** : exiger le passage des jobs « Sources et données » et « Tests du robot de collecte ».
2. **Autoriser le robot** à ouvrir des pull requests (*Settings → Actions → General*).
3. **Ajouter le secret `LOICI_ROBOT_TOKEN`** (voir [CONTRIBUTING.md](CONTRIBUTING.md#pour-les-mainteneurs--configurer-le-robot)).

## Feuille de route

- **P0 (fait)** : liste avec recherche et filtres, fiche texte (statut, parcours, votes, révisions, sources, « Lire plus »),
  fiche parlementaire, méthodologie, CI de validation, robot de collecte, recherche par année et par personnalité,
  page « Personnalités », page « Contribuer » et bouton « Signaler une erreur » (issue pré-remplie).
- **P1** : fiche parti, export CSV, collecteur du Sénat,
  allègement des pages.
- **P2** : flux RSS par texte et par thème, statistiques par législature, mode hors ligne (PWA).

## Licences

- **Code** : [MIT](LICENSE).
- **Données** : [ODbL 1.0](donnees/LICENSE.md).
- Les documents officiels et articles cités restent la propriété de leurs auteurs ; LoiCI n'en conserve que les références.

## Contact

Contact des mainteneurs : _à définir_. En attendant, ouvrez une issue (sauf pour un signalement lié au
[code de conduite](CODE_OF_CONDUCT.md), qui doit rester privé).
