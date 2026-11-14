"""Lecture des sources existantes et fabrication des nouveaux fichiers de source.

Les fichiers produits suivent exactement le schéma des sources (schemas/source.ts) ;
la CI les valide de toute façon avant qu'un humain ne fusionne la pull request.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit


def url_comparable(url: str) -> str:
    """Même règle que la CI : sans protocole, « www. », ni barre finale."""
    u = url.strip()
    for prefixe in ("https://", "http://"):
        if u.lower().startswith(prefixe):
            u = u[len(prefixe):]
    if u.lower().startswith("www."):
        u = u[4:]
    return u.rstrip("/").lower()


@dataclass
class Referentiel:
    """Ce que le robot doit savoir des données déjà publiées."""

    racine: Path
    sources: dict[str, dict] = field(default_factory=dict)  # id → source
    par_url: dict[str, str] = field(default_factory=dict)  # url comparable → id
    domaines_officiels: list[str] = field(default_factory=list)

    @classmethod
    def charger(cls, racine: Path) -> "Referentiel":
        ref = cls(racine=racine)
        for chemin in sorted((racine / "donnees" / "sources").glob("*.json")):
            source = json.loads(chemin.read_text(encoding="utf-8"))
            ref.sources[source["id"]] = source
            ref.par_url.setdefault(url_comparable(source["url"]), source["id"])
        domaines = json.loads((racine / "donnees" / "referentiels" / "domaines-officiels.json").read_text(encoding="utf-8"))
        ref.domaines_officiels = [d["domaine"].lower() for d in domaines]
        return ref

    def connue(self, url: str) -> bool:
        return url_comparable(url) in self.par_url

    def type_source(self, url: str) -> str:
        """« officielle » si l'URL est sur un domaine officiel (ou un sous-domaine), sinon « presse »."""
        hote = (urlsplit(url).hostname or "").lower()
        if hote.startswith("www."):
            hote = hote[4:]
        officielle = any(hote == d or hote.endswith("." + d) for d in self.domaines_officiels)
        return "officielle" if officielle else "presse"

    def identifiant_libre(self, base: str) -> str:
        """Identifiant pas encore utilisé : base, puis base-2, base-3…"""
        candidat, n = base, 2
        while candidat in self.sources or (self.racine / "donnees" / "sources" / f"{candidat}.json").exists():
            candidat, n = f"{base}-{n}", n + 1
        return candidat

    def enregistrer(self, source: dict) -> Path:
        """Écrit donnees/sources/<id>.json (même mise en forme que les fichiers rédigés à la main)."""
        chemin = self.racine / "donnees" / "sources" / f"{source['id']}.json"
        chemin.write_text(json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        self.sources[source["id"]] = source
        self.par_url.setdefault(url_comparable(source["url"]), source["id"])
        return chemin


def fabriquer_source(
    *,
    identifiant: str,
    url: str,
    titre: str,
    nom: str,
    type_source: str,
    format_source: str,
    date_publication: str | None,
    date_consultation: str,
    url_archive: str,
    empreinte_sha256: str | None,
) -> dict:
    """Source au format du schéma, champs dans l'ordre habituel. Une date inconnue reste None (null)."""
    return {
        "id": identifiant,
        "url": url,
        "titre": titre[:400],
        "nom": nom,
        "type": type_source,
        "format": format_source,
        "date_publication": date_publication,
        "date_consultation": date_consultation,
        "url_archive": url_archive,
        "empreinte_sha256": empreinte_sha256 if format_source == "pdf" else None,
    }
