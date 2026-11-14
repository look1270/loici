"""Réglages du robot. Tout ce qui touche à la politesse envers les sites sources est ici."""

from __future__ import annotations

import os

from . import __version__


def agent_utilisateur() -> str:
    """Identification claire du robot, avec l'adresse du dépôt pour nous contacter."""
    depot = os.environ.get("LOICI_DEPOT_URL", "").strip()
    contact = f"; +{depot}" if depot else ""
    return f"LoiCI-robot/{__version__} (observatoire citoyen open source des lois de Côte d'Ivoire{contact})"


# Pause minimale entre deux requêtes vers un même site (secondes).
# Un « Crawl-delay » plus long dans robots.txt est toujours respecté.
PAUSE_PAR_HOTE = float(os.environ.get("LOICI_PAUSE", "3"))

# Délai maximal d'attente d'une réponse (secondes).
DELAI_REPONSE = 45

# Nombre d'essais en cas d'erreur réseau ou serveur (5xx).
ESSAIS = 3

# Un PDF plus gros n'est pas téléchargé (il ne sert qu'à lire ses métadonnées et calculer son empreinte).
TAILLE_MAX_PDF = 50 * 1024 * 1024

# Nombre maximal de pages nouvelles examinées par collecteur et par exécution.
MAX_PAGES_PAR_COLLECTEUR = int(os.environ.get("LOICI_MAX_PAGES", "15"))

# Une archive Wayback plus récente que ce délai est réutilisée au lieu d'en redemander une.
AGE_MAX_ARCHIVE_JOURS = 30

# Veille des sources existantes : chacune est revérifiée une fois tous les N jours (rotation).
ROTATION_VEILLE_JOURS = 7
