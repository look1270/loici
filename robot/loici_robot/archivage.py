"""Archivage Wayback Machine : chaque source proposée doit avoir une copie archivée."""

from __future__ import annotations

import datetime as dt
import re

import requests

from . import config
from .reseau import ClientPoli

API_DISPONIBILITE = "https://archive.org/wayback/available"
ENREGISTRER = "https://web.archive.org/save/"
_HORODATAGE = re.compile(r"/web/(\d{14})/")


def lien_archive(horodatage: str, url: str) -> str:
    """Format exigé par le schéma des sources : https://web.archive.org/web/AAAAMMJJhhmmss/<url>."""
    return f"https://web.archive.org/web/{horodatage}/{url}"


def instantane_recent(client: ClientPoli, url: str, aujourdhui: dt.date) -> str | None:
    """Horodatage d'une archive existante de moins de AGE_MAX_ARCHIVE_JOURS jours, sinon None."""
    try:
        reponse = client.get(f"{API_DISPONIBILITE}?url={requests.utils.quote(url, safe='')}", verifier_robots=False)
        proche = reponse.json().get("archived_snapshots", {}).get("closest") or {}
    except (requests.RequestException, ValueError):
        return None
    horodatage = proche.get("timestamp")
    if not (proche.get("available") and horodatage and len(horodatage) == 14):
        return None
    date = dt.date(int(horodatage[:4]), int(horodatage[4:6]), int(horodatage[6:8]))
    return horodatage if (aujourdhui - date).days <= config.AGE_MAX_ARCHIVE_JOURS else None


def demander_archivage(client: ClientPoli, url: str) -> str | None:
    """Demande une nouvelle archive (Save Page Now). Retourne son horodatage, ou None en cas d'échec."""
    try:
        reponse = client.get(ENREGISTRER + url, suivre=False, verifier_robots=False)
    except requests.RequestException:
        return None
    emplacement = reponse.headers.get("Location") or reponse.headers.get("Content-Location") or ""
    trouve = _HORODATAGE.search(emplacement)
    return trouve.group(1) if trouve else None


def obtenir_archive(client: ClientPoli, url: str, aujourdhui: dt.date) -> str | None:
    """Lien d'archive de l'URL : archive récente réutilisée, sinon nouvelle demande. None si impossible."""
    horodatage = instantane_recent(client, url, aujourdhui) or demander_archivage(client, url)
    return lien_archive(horodatage, url) if horodatage else None
