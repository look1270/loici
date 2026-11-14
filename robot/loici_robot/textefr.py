"""Outils pour le texte français des pages sources."""

from __future__ import annotations

import re
import unicodedata

MOIS = {
    "janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12,
}

_DATE = re.compile(
    r"\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})(?:er)?\s+"
    r"(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b",
    re.IGNORECASE,
)


def sans_accents(texte: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", texte) if unicodedata.category(c) != "Mn")


def espaces(texte: str) -> str:
    """Espaces multiples, insécables et retours à la ligne ramenés à une espace simple."""
    return re.sub(r"\s+", " ", texte.replace("\xa0", " ").replace(" ", " ")).strip()


def premiere_date(texte: str) -> str | None:
    """Première date française complète du texte, au format AAAA-MM-JJ ; None si aucune.
    Une date incomplète (« en octobre 2019 ») n'est jamais transformée en date précise."""
    m = _DATE.search(texte)
    if not m:
        return None
    jour, mois, annee = int(m.group(1)), MOIS[sans_accents(m.group(2)).lower()], int(m.group(3))
    if not 1 <= jour <= 31:
        return None
    return f"{annee:04d}-{mois:02d}-{jour:02d}"


def identifiant(texte: str, longueur_max: int = 70) -> str:
    """« Communiqué du 14 octobre » → « communique-du-14-octobre » (format des identifiants LoiCI)."""
    base = re.sub(r"[^a-z0-9]+", "-", sans_accents(texte).lower()).strip("-")
    return base[:longueur_max].rstrip("-") or "sans-titre"


def couper(texte: str, longueur: int = 300) -> str:
    """Extrait court pour le relecteur (jamais le document entier)."""
    texte = espaces(texte)
    return texte if len(texte) <= longueur else texte[: longueur - 1].rsplit(" ", 1)[0] + "…"
