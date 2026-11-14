"""Lecture d'un PDF : télécharge, calcule l'empreinte, lit les métadonnées, puis SUPPRIME le fichier.

Le robot ne conserve jamais un document (règle « aucun document stocké ») :
seule son empreinte SHA-256 est gardée, pour détecter une nouvelle version.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from dataclasses import dataclass

from . import config
from .erreurs import DocumentRefuse
from .reseau import ClientPoli
from .textefr import espaces


@dataclass
class InfosPdf:
    empreinte_sha256: str
    nombre_pages: int | None
    titre_metadonnees: str | None
    debut_texte: str  # quelques lignes de la première page, pour aider le relecteur


def analyser_pdf(client: ClientPoli, url: str) -> InfosPdf:
    reponse = client.get(url, stream=True)
    if reponse.status_code != 200:
        raise DocumentRefuse(f"HTTP {reponse.status_code}")
    descripteur, chemin = tempfile.mkstemp(suffix=".pdf", prefix="loici-")
    try:
        empreinte = hashlib.sha256()
        taille = 0
        with os.fdopen(descripteur, "wb") as fichier:
            for bloc in reponse.iter_content(chunk_size=65536):
                taille += len(bloc)
                if taille > config.TAILLE_MAX_PDF:
                    raise DocumentRefuse("PDF trop volumineux")
                empreinte.update(bloc)
                fichier.write(bloc)
        with open(chemin, "rb") as f:
            if f.read(5) != b"%PDF-":
                raise DocumentRefuse("le document n'est pas un PDF")
        return _lire(chemin, empreinte.hexdigest())
    finally:
        reponse.close()
        os.remove(chemin)  # le document n'est jamais conservé


def _lire(chemin: str, empreinte: str) -> InfosPdf:
    import pdfplumber  # importé ici : inutile tant qu'aucun PDF n'est lu

    try:
        with pdfplumber.open(chemin) as pdf:
            titre = (pdf.metadata or {}).get("Title")
            debut = (pdf.pages[0].extract_text() or "") if pdf.pages else ""
            return InfosPdf(empreinte, len(pdf.pages), espaces(str(titre)) if titre else None, espaces(debut)[:500])
    except Exception:  # PDF illisible (scan, chiffré…) : l'empreinte reste utile
        return InfosPdf(empreinte, None, None, "")
