"""gouv.ci — communiqués du Conseil des ministres.

C'est là que le Gouvernement annonce l'adoption de ses projets de loi (et d'ordonnances),
première étape du parcours d'un projet de loi.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from ..erreurs import StructureChangee
from ..textefr import couper, espaces, premiere_date, sans_accents
from . import Contexte, Decouverte

SITE = "gouv.ci (Conseil des ministres)"
LISTE = "https://www.gouv.ci/publications/documents/Conseils%20des%20Ministres"
_LIEN = re.compile(r"^https://www\.gouv\.ci/publications/conseils-des-ministres/(\d+)/?$")
_INTRO = re.compile(r"^Le\s+(?:\w+\s+)?\d{1,2}(?:er)?\s+\w+\s+\d{4},\s+un\s+Conseil\s+des\s+Ministres", re.IGNORECASE)
_AU_TITRE = re.compile(r"^(?:\d+\s*[-–]\s*)?Au titre du (.+?)\s*;?$", re.IGNORECASE)
_DEBUT_SECTION = re.compile(r"^PROJETS? (DE LOI|D.ORDONNANCES?)\b")
_FIN_SECTION = re.compile(r"^(PROJETS? DE DECRETS?|[A-E]\s*/|MESURES?\b|COMMUNICATIONS?\b|DIVERS\b)")
_MENTION = re.compile(r"projets? de loi|projets? d.ordonnance", re.IGNORECASE)


def liens_communiques(html: str) -> list[str]:
    """Liens vers les communiqués, du plus récent (numéro le plus élevé) au plus ancien."""
    soup = BeautifulSoup(html, "html.parser")
    numeros = {int(m.group(1)) for a in soup.find_all("a", href=True) if (m := _LIEN.match(a["href"].strip()))}
    return [f"https://www.gouv.ci/publications/conseils-des-ministres/{n}" for n in sorted(numeros, reverse=True)]


def analyser_communique(html: str, url: str) -> tuple[str | None, str, list[str]]:
    """(date du Conseil, phrase d'introduction, projets de loi ou d'ordonnance annoncés avec leur ministère)."""
    soup = BeautifulSoup(html, "html.parser")
    publication = soup.select_one("#publication")
    corps = publication.select_one(".description") if publication else None
    intro = next((espaces(p.get_text(" ")) for p in (publication or soup).find_all("p") if _INTRO.match(espaces(p.get_text(" ")))), None)
    if corps is None or intro is None:
        raise StructureChangee(SITE, url, "communiqué sans bloc « #publication .description » ou sans phrase « Le … un Conseil des Ministres »")

    projets: list[str] = []
    dans_section = False
    ministere: str | None = None
    for element in corps.find_all(["p", "li"]):
        texte = espaces(element.get_text(" "))
        if not texte:
            continue
        majuscules = sans_accents(texte).upper()
        if _DEBUT_SECTION.match(majuscules):
            dans_section = True
            continue
        if dans_section and _FIN_SECTION.match(majuscules):
            dans_section = False
            continue
        if not dans_section:
            continue
        titre_ministere = _AU_TITRE.match(texte)
        if titre_ministere:
            ministere = titre_ministere.group(1)
        elif _MENTION.search(texte) or texte.startswith(("•", "–", "- ")):
            # Les puces détaillent souvent chaque texte annoncé (« • la première ordonnance … »).
            prefixe = f"{ministere} — " if ministere else ""
            projets.append(prefixe + couper(texte, 280))
    return premiere_date(intro), intro, projets


def collecter(ctx: Contexte) -> list[Decouverte]:
    reponse = ctx.client.get(LISTE)
    liens = liens_communiques(reponse.text) if reponse.status_code == 200 else []
    if not liens:
        raise StructureChangee(SITE, LISTE, f"aucun lien de communiqué trouvé sur la liste (HTTP {reponse.status_code})")

    decouvertes: list[Decouverte] = []
    for url in [u for u in liens if not ctx.referentiel.connue(u)][: ctx.max_pages]:
        page = ctx.client.get(url)
        if page.status_code != 200:
            ctx.journal.append(f"{url} : HTTP {page.status_code}, ignoré")
            continue
        date, intro, projets = analyser_communique(page.text, url)
        if not projets:
            ctx.journal.append(f"{url} : aucun projet de loi ni d'ordonnance annoncé")
            continue
        jour = re.search(r"Le\s+((?:\w+\s+)?\d{1,2}(?:er)?\s+\w+\s+\d{4})", intro)
        decouvertes.append(
            Decouverte(
                collecteur="gouv_conseil_ministres",
                url=url,
                titre=f"Communiqué du Conseil des Ministres du {jour.group(1)}" if jour else "Communiqué du Conseil des Ministres",
                nom="Gouvernement de Côte d'Ivoire",
                format="page_web",
                date_publication=date,
                identifiant_base=f"src-gouv-ccm-{date}" if date else "src-gouv-ccm",
                pistes=projets,
            )
        )
    return decouvertes
