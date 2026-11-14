# Files de relecture

Chaque dossier contient une extraction automatique **externe**, transformée en liste de candidats à vérifier
par `npm run importer -- <fichier.json>`. **Rien ici n'est publié** : le site et la validation ne lisent que `donnees/`.

- `RELECTURE.md` : liste à cocher, du plus fiable au moins fiable.
- `candidats.json` : les mêmes candidats, avec chaque ligne brute de l'extraction et les alertes relevées.

Pour chaque candidat : ouvrir la source, recopier le titre officiel exact, puis créer la fiche dans `donnees/`
selon le guide [Ajouter un texte](https://github.com/look1270/loici/wiki/Ajouter-un-texte). Cochez la case dans
`RELECTURE.md` dans la même pull request.

Les statuts et dates de l'extraction ne sont **pas fiables** : ils ne doivent jamais être recopiés sans vérification.
