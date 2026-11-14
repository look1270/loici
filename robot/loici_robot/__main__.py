"""Point d'entrée : python -m loici_robot [--essai] [--racine .] [--rapport rapport.md]

Codes de sortie :
  0  exécution normale (avec ou sans propositions) ;
  2  au moins un site a changé de structure ou un collecteur a échoué (une issue doit être ouverte) ;
  1  erreur inattendue du robot lui-même.
"""

from __future__ import annotations

import argparse
import datetime as dt
import sys
import traceback
from pathlib import Path

from . import config
from .archivage import obtenir_archive
from .collecteurs import Contexte, Decouverte, assnat, gouv_conseil_ministres, veille
from .erreurs import StructureChangee
from .rapport import Rapport
from .reseau import ClientPoli
from .sources import Referentiel, fabriquer_source

COLLECTEURS = {
    "gouv_conseil_ministres": gouv_conseil_ministres.collecter,
    "assnat": assnat.collecter,
}


def proposer(ctx: Contexte, rapport: Rapport, d: Decouverte, essai: bool) -> str | None:
    """Archive puis écrit la source. Retourne l'identifiant attribué, ou None si l'archivage a échoué."""
    ident = ctx.referentiel.identifiant_libre(d.identifiant_base)
    if essai:
        return ident
    url_archive = obtenir_archive(ctx.client, d.url, ctx.aujourdhui)
    if url_archive is None:
        rapport.archivage_impossible.append(d)
        return None
    source = fabriquer_source(
        identifiant=ident,
        url=d.url,
        titre=d.titre,
        nom=d.nom,
        type_source=ctx.referentiel.type_source(d.url),
        format_source=d.format,
        date_publication=d.date_publication,
        date_consultation=ctx.aujourdhui.isoformat(),
        url_archive=url_archive,
        empreinte_sha256=d.pdf.empreinte_sha256 if d.pdf else None,
    )
    ctx.referentiel.enregistrer(source)
    return ident


def principal(arguments: list[str] | None = None) -> int:
    parseur = argparse.ArgumentParser(prog="loici_robot", description="Robot de collecte LoiCI (propose, ne publie jamais).")
    parseur.add_argument("--racine", type=Path, default=Path.cwd(), help="racine du dépôt (contient donnees/)")
    parseur.add_argument("--rapport", type=Path, default=Path("rapport-robot.md"))
    parseur.add_argument("--issue", type=Path, default=Path("issue-robot.md"), help="écrit ici le texte d'issue si un site a changé")
    parseur.add_argument("--essai", action="store_true", help="ne demande aucune archive et n'écrit aucune source")
    parseur.add_argument("--collecteurs", nargs="*", default=list(COLLECTEURS), choices=list(COLLECTEURS))
    parseur.add_argument("--sans-veille", action="store_true", help="ne revérifie pas les sources existantes")
    parseur.add_argument("--veille-complete", action="store_true", help="revérifie toutes les sources (sinon rotation)")
    parseur.add_argument("--max-pages", type=int, default=config.MAX_PAGES_PAR_COLLECTEUR)
    args = parseur.parse_args(arguments)

    aujourdhui = dt.datetime.now(dt.timezone.utc).date()
    client = ClientPoli()
    ctx = Contexte(client=client, referentiel=Referentiel.charger(args.racine), aujourdhui=aujourdhui, max_pages=args.max_pages)
    rapport = Rapport(date=aujourdhui.isoformat(), essai=args.essai)
    print(f"Robot LoiCI — {aujourdhui} — agent : {client.agent}")

    # 1. Nouvelles pages, site par site : l'échec d'un site n'empêche pas les autres.
    for nom in args.collecteurs:
        try:
            for d in COLLECTEURS[nom](ctx):
                if ctx.referentiel.connue(d.url):
                    continue
                ident = proposer(ctx, rapport, d, args.essai)
                if ident:
                    rapport.proposees.append((ident, d))
                    print(f"  + {ident} ({d.url})")
        except StructureChangee as e:
            rapport.structures.append(e)
            print(f"  ✖ {e}")
        except Exception as e:  # erreur réseau persistante, réponse inattendue…
            rapport.echecs.append(f"{nom} : {type(e).__name__} : {e}")
            traceback.print_exc()

    # 2. Veille des sources existantes : nouvelles versions et liens morts.
    if not args.sans_veille:
        try:
            resultat = veille.veiller(ctx, tout=args.veille_complete)
            rapport.sources_verifiees = resultat.verifiees
            rapport.liens_morts = resultat.liens_morts
            for d in resultat.nouvelles_versions:
                ident = proposer(ctx, rapport, d, args.essai)
                if ident:
                    rapport.nouvelles_versions.append((ident, d))
        except Exception as e:
            rapport.echecs.append(f"veille : {type(e).__name__} : {e}")
            traceback.print_exc()

    rapport.journal = ctx.journal
    rapport.requetes = dict(client.statistiques)
    args.rapport.write_text(rapport.markdown(), encoding="utf-8")
    print(f"Rapport : {args.rapport} — {len(rapport.proposees)} source(s), {len(rapport.nouvelles_versions)} version(s), "
          f"{len(rapport.liens_morts)} lien(s) mort(s), {len(rapport.structures) + len(rapport.echecs)} problème(s).")

    if rapport.structures or rapport.echecs:
        args.issue.write_text(rapport.markdown_issue(), encoding="utf-8")
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(principal())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
