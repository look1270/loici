"""Collecteurs : un par site source. Chacun repère les pages nouvelles et en extrait les métadonnées."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field

from ..pdf import InfosPdf
from ..reseau import ClientPoli
from ..sources import Referentiel


@dataclass
class Decouverte:
    """Une page ou un document repéré, à proposer comme nouvelle source."""

    collecteur: str
    url: str
    titre: str
    nom: str  # émetteur, ex. « Assemblée nationale de Côte d'Ivoire »
    format: str  # « page_web » ou « pdf »
    date_publication: str | None  # None si la page ne l'indique pas : jamais devinée
    identifiant_base: str
    pistes: list[str] = field(default_factory=list)  # extraits courts pour aider le relecteur
    pdf: InfosPdf | None = None
    version_de: str | None = None  # identifiant de la source dont c'est une nouvelle version


@dataclass
class Contexte:
    client: ClientPoli
    referentiel: Referentiel
    aujourdhui: dt.date
    max_pages: int
    journal: list[str] = field(default_factory=list)  # remarques pour le rapport
