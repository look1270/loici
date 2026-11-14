"""Rapport d'exécution : il devient le texte de la pull request (et de l'issue en cas de problème)."""

from __future__ import annotations

from dataclasses import dataclass, field

from .collecteurs import Decouverte
from .erreurs import StructureChangee


@dataclass
class Rapport:
    date: str
    essai: bool = False
    proposees: list[tuple[str, Decouverte]] = field(default_factory=list)  # (id attribué, découverte)
    archivage_impossible: list[Decouverte] = field(default_factory=list)
    nouvelles_versions: list[tuple[str, Decouverte]] = field(default_factory=list)
    liens_morts: list[tuple[str, str, str]] = field(default_factory=list)
    structures: list[StructureChangee] = field(default_factory=list)
    echecs: list[str] = field(default_factory=list)
    journal: list[str] = field(default_factory=list)
    sources_verifiees: int = 0
    requetes: dict[str, int] = field(default_factory=dict)

    @property
    def a_proposer(self) -> bool:
        return bool(self.proposees or self.nouvelles_versions)

    def markdown(self) -> str:
        l: list[str] = [f"## Robot de collecte — {self.date}" + (" (essai, rien n'a été écrit)" if self.essai else ""), ""]
        l += [
            "> **Rien n'est publié sans relecture humaine.** Ce robot propose ; vous vérifiez chaque source, puis fusionnez.",
            "",
        ]
        if self.proposees:
            l += ["### Nouvelles sources", "", "Pour chacune : ouvrez l'URL, vérifiez le titre et la date, puis reliez la source au texte concerné "
                  "(nouveau texte ou nouvelle étape). Une source non reliée reste signalée par la CI.", ""]
            for ident, d in self.proposees:
                l.append(f"- [ ] **`{ident}`** — [{d.titre}]({d.url}) · {d.nom} · {d.format}"
                         + (f" · publié le {d.date_publication}" if d.date_publication else " · date de publication non renseignée"))
                l += [f"  - {p}" for p in d.pistes]
            l.append("")
        if self.nouvelles_versions:
            l += ["### Nouvelles versions de documents", ""]
            for ident, d in self.nouvelles_versions:
                l.append(f"- [ ] **`{ident}`** — [{d.titre}]({d.url})")
                l += [f"  - {p}" for p in d.pistes]
            l.append("")
        if self.liens_morts:
            l += ["### Liens originaux qui ne répondent plus", "",
                  "« Lire plus » bascule sur l'archive quand le site est injoignable ; ces liens méritent une vérification.", ""]
            l += [f"- `{i}` : {u} — {r}" for i, u, r in self.liens_morts]
            l.append("")
        if self.archivage_impossible:
            l += ["### Archivage impossible (non proposées)", "",
                  "La Wayback Machine n'a pas pu archiver ces pages : sans archive, une source est refusée. Nouvel essai demain.", ""]
            l += [f"- [{d.titre}]({d.url})" for d in self.archivage_impossible]
            l.append("")
        if self.structures or self.echecs:
            l += ["### ⚠️ Problèmes du robot", ""]
            l += [f"- **Structure changée** — {s}" for s in self.structures]
            l += [f"- **Échec** — {e}" for e in self.echecs]
            l.append("")
        l += ["<details><summary>Journal et statistiques</summary>", ""]
        l += [f"- Sources existantes revérifiées aujourd'hui : {self.sources_verifiees}"]
        l += [f"- Requêtes vers {h} : {n}" for h, n in sorted(self.requetes.items())]
        l += [f"- {j}" for j in self.journal]
        l += ["", "</details>", ""]
        return "\n".join(l)

    def markdown_issue(self) -> str:
        """Texte de l'issue ouverte quand un site a changé de structure."""
        l = ["Le robot de collecte s'est arrêté proprement sur ces sites, sans rien proposer à partir d'eux :", ""]
        for s in self.structures:
            l += [f"- **{s.site}** : {s.detail}", f"  - Page : {s.url}"]
        l += [f"- **Échec** : {e}" for e in self.echecs]
        l += ["", "À faire : ouvrir la page, constater le changement, adapter le collecteur dans `robot/loici_robot/collecteurs/`, "
              "puis mettre à jour les tests (`robot/tests/`).", ""]
        return "\n".join(l)
