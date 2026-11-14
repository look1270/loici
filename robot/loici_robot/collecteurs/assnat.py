"""assnat.ci — articles de l'Assemblée nationale (activités parlementaires, lois) et leurs PDF."""

from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from ..erreurs import DocumentRefuse, PageInterdite, StructureChangee
from ..pdf import analyser_pdf
from ..textefr import couper, espaces, identifiant, premiere_date
from . import Contexte, Decouverte

SITE = "assnat.ci (Assemblée nationale)"
BASE = "https://www.assnat.ci/"
PAGES_DEPART = [BASE, BASE + "?-lois-82-"]
# Articles (et non rubriques, qui commencent par « - ») dont l'adresse évoque le travail législatif.
_ARTICLE = re.compile(r"^\.?/?\?([a-z0-9][a-z0-9-]+)$")
_LEGISLATIF = re.compile(r"projet-de-loi|proposition-de-loi|(^|-)lois?(-|$)|pleniere|ordonnance|ratifi|budget|finances|adopt|vote")
_MENTION = re.compile(r"projets? de loi|propositions? de loi|ordonnance|loi n°", re.IGNORECASE)


def liens_articles(html: str) -> list[str]:
    """Articles liés depuis une page de l'Assemblée et dont l'adresse évoque le travail législatif."""
    soup = BeautifulSoup(html, "html.parser")
    vus: dict[str, None] = {}
    for a in soup.find_all("a", href=True):
        m = _ARTICLE.match(a["href"].strip())
        if m and _LEGISLATIF.search(m.group(1)):
            vus[f"{BASE}?{m.group(1)}"] = None
    return list(vus)


def analyser_article(html: str, url: str) -> tuple[str, str, list[tuple[str, str]]]:
    """(titre, texte de l'article, PDF liés [(url, intitulé du lien)])."""
    soup = BeautifulSoup(html, "html.parser")
    contenu = soup.select_one("div.entry-content")
    titre_el = contenu.select_one("h2.entry-title") if contenu else None
    if contenu is None or titre_el is None:
        raise StructureChangee(SITE, url, "article sans bloc « div.entry-content » ou sans titre « h2.entry-title »")
    corps = " ".join(espaces(d.get_text(" ")) for d in contenu.select('div[align="justify"]')) or espaces(contenu.get_text(" "))
    pdfs = []
    for a in contenu.find_all("a", href=True):
        if a["href"].lower().split("?")[0].endswith(".pdf"):
            pdfs.append((urljoin(url, a["href"].strip()), espaces(a.get_text(" "))))
    return espaces(titre_el.get_text(" ")), corps, pdfs


def collecter(ctx: Contexte) -> list[Decouverte]:
    liens: dict[str, None] = {}
    for depart in PAGES_DEPART:
        reponse = ctx.client.get(depart)
        if reponse.status_code == 200:
            liens.update(dict.fromkeys(liens_articles(reponse.text)))
    if not liens:
        raise StructureChangee(SITE, BASE, "aucun lien d'article législatif trouvé sur les pages de départ")

    decouvertes: list[Decouverte] = []
    for url in [u for u in liens if not ctx.referentiel.connue(u)][: ctx.max_pages]:
        page = ctx.client.get(url)
        if page.status_code != 200:
            ctx.journal.append(f"{url} : HTTP {page.status_code}, ignoré")
            continue
        titre, corps, pdfs = analyser_article(page.text, url)
        if not (_MENTION.search(titre) or _MENTION.search(corps)):
            ctx.journal.append(f"{url} : ne mentionne aucun texte de loi")
            continue
        phrases = [p for p in re.split(r"(?<=[.;])\s+", corps) if _MENTION.search(p)][:3]
        date_citee = premiere_date(corps)
        pistes = [couper(p, 280) for p in phrases]
        if date_citee:
            pistes.append(f"Première date citée dans l'article : {date_citee} (date d'un événement, pas de publication)")
        decouvertes.append(
            Decouverte(
                collecteur="assnat",
                url=url,
                titre=titre,
                nom="Assemblée nationale de Côte d'Ivoire",
                format="page_web",
                date_publication=None,  # l'Assemblée n'affiche pas la date de publication sur ses articles
                identifiant_base=f"src-assnat-{identifiant(titre, 55)}",
                pistes=pistes,
            )
        )
        for url_pdf, intitule in pdfs:
            if ctx.referentiel.connue(url_pdf):
                continue
            try:
                infos = analyser_pdf(ctx.client, url_pdf)
            except (DocumentRefuse, PageInterdite) as e:
                ctx.journal.append(f"{url_pdf} : PDF non lu ({e})")
                continue
            titre_pdf = intitule or infos.titre_metadonnees or titre
            decouvertes.append(
                Decouverte(
                    collecteur="assnat",
                    url=url_pdf,
                    titre=titre_pdf,
                    nom="Assemblée nationale de Côte d'Ivoire",
                    format="pdf",
                    date_publication=None,
                    identifiant_base=f"src-assnat-{identifiant(titre_pdf, 50)}-pdf",
                    pistes=[f"PDF lié depuis : {url}"] + ([f"Début du document : {couper(infos.debut_texte, 280)}"] if infos.debut_texte else []),
                    pdf=infos,
                )
            )
    return decouvertes
