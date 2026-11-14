"""Veille des sources déjà publiées : nouvelles versions des PDF et liens morts.

Chaque source est revérifiée une fois tous les ROTATION_VEILLE_JOURS jours (pour ménager les sites).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import requests

from .. import config
from ..erreurs import DocumentRefuse, PageInterdite
from ..pdf import analyser_pdf
from . import Contexte, Decouverte


@dataclass
class ResultatVeille:
    nouvelles_versions: list[Decouverte] = field(default_factory=list)
    liens_morts: list[tuple[str, str, str]] = field(default_factory=list)  # (id, url, raison)
    verifiees: int = 0


def sources_du_jour(ids: list[str], ordinal_du_jour: int, tout: bool = False) -> list[str]:
    """Rotation : sources dont le rang modulo N égale le jour modulo N (toutes si `tout`)."""
    n = config.ROTATION_VEILLE_JOURS
    return sorted(ids) if tout else [i for rang, i in enumerate(sorted(ids)) if rang % n == ordinal_du_jour % n]


def veiller(ctx: Contexte, tout: bool = False) -> ResultatVeille:
    resultat = ResultatVeille()
    sources = ctx.referentiel.sources
    for ident in sources_du_jour(list(sources), ctx.aujourdhui.toordinal(), tout):
        source = sources[ident]
        resultat.verifiees += 1
        try:
            if source["format"] == "pdf" and source.get("empreinte_sha256"):
                infos = analyser_pdf(ctx.client, source["url"])
                if infos.empreinte_sha256 != source["empreinte_sha256"]:
                    resultat.nouvelles_versions.append(
                        Decouverte(
                            collecteur="veille",
                            url=source["url"],
                            titre=source["titre"],
                            nom=source["nom"],
                            format="pdf",
                            date_publication=None,
                            identifiant_base=f"{ident}-version-{ctx.aujourdhui.isoformat()}",
                            pistes=[
                                f"Le document de « {ident} » a changé.",
                                f"Ancienne empreinte : {source['empreinte_sha256'][:16]}…  Nouvelle : {infos.empreinte_sha256[:16]}…",
                                "À vérifier : s'agit-il d'une nouvelle version du texte ? Si oui, ajoutez une révision au texte concerné.",
                            ],
                            pdf=infos,
                            version_de=ident,
                        )
                    )
            else:
                reponse = ctx.client.get(source["url"], stream=True)
                reponse.close()
                if reponse.status_code in (404, 410):
                    resultat.liens_morts.append((ident, source["url"], f"HTTP {reponse.status_code}"))
        except PageInterdite:
            ctx.journal.append(f"{source['url']} : interdit par robots.txt, non vérifié")
        except DocumentRefuse as e:
            if "HTTP 404" in str(e) or "HTTP 410" in str(e):
                resultat.liens_morts.append((ident, source["url"], str(e)))
            else:
                ctx.journal.append(f"{source['url']} : {e}")
        except requests.RequestException as e:
            resultat.liens_morts.append((ident, source["url"], f"injoignable ({type(e).__name__})"))
    return resultat
