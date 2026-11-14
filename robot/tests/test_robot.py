"""Tests du robot de collecte. Lancer : cd robot && python -m unittest -v"""

from __future__ import annotations

import atexit
import datetime as dt
import shutil
import glob
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from loici_robot import __main__ as robot
from loici_robot import archivage, textefr
from loici_robot.collecteurs import Contexte, Decouverte, assnat, gouv_conseil_ministres, veille
from loici_robot.erreurs import DocumentRefuse, PageInterdite, StructureChangee
from loici_robot.pdf import analyser_pdf
from loici_robot.reseau import ClientPoli
from loici_robot.sources import Referentiel, fabriquer_source, url_comparable

from .outils import FausseReponse, FausseSession, fixture, pdf_minimal

ROBOTS_OUVERT = FausseReponse(200, "User-agent: *\nDisallow:\n")


def client(pages: dict, pause: float = 0.0) -> ClientPoli:
    return ClientPoli(agent="LoiCI-robot/test", pause=pause, dormir=lambda s: None, session=FausseSession(pages))


def racine_temporaire(sources: list[dict] | None = None) -> Path:
    racine = Path(tempfile.mkdtemp(prefix="loici-robot-test-"))
    atexit.register(shutil.rmtree, racine, True)
    (racine / "donnees" / "sources").mkdir(parents=True)
    (racine / "donnees" / "referentiels").mkdir(parents=True)
    (racine / "donnees" / "referentiels" / "domaines-officiels.json").write_text(
        json.dumps([{"domaine": "assnat.ci", "institution": "AN"}, {"domaine": "gouv.ci", "institution": "Gouv"}])
    )
    for s in sources or []:
        (racine / "donnees" / "sources" / f"{s['id']}.json").write_text(json.dumps(s))
    return racine


class TestTexteFrancais(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(textefr.premiere_date("Le mercredi 14 octobre 2026, un Conseil"), "2026-10-14")
        self.assertEqual(textefr.premiere_date("le 1er juillet 2026"), "2026-07-01")
        self.assertEqual(textefr.premiere_date("le 7 août 2026 et le 8"), "2026-08-07")
        self.assertIsNone(textefr.premiere_date("en octobre 2019"), "une date incomplète n'est jamais complétée")

    def test_identifiant_et_extrait(self):
        self.assertEqual(textefr.identifiant("Examen du Projet de loi : l'État !"), "examen-du-projet-de-loi-l-etat")
        self.assertTrue(textefr.couper("mot " * 200, 50).endswith("…"))


class TestGouvConseilMinistres(unittest.TestCase):
    def test_liens_du_plus_recent_au_plus_ancien_sans_doublon(self):
        self.assertEqual(
            gouv_conseil_ministres.liens_communiques(fixture("gouv_liste.html")),
            [
                "https://www.gouv.ci/publications/conseils-des-ministres/3415",
                "https://www.gouv.ci/publications/conseils-des-ministres/3399",
            ],
        )

    def test_extraction_des_projets_de_loi(self):
        date, intro, projets = gouv_conseil_ministres.analyser_communique(fixture("gouv_communique.html"), "u")
        self.assertEqual(date, "2099-10-14")
        self.assertEqual(len(projets), 4, projets)
        self.assertTrue(projets[0].startswith("Ministère Factice de la Justice — Le Conseil a adopté un projet de loi"))
        self.assertTrue(projets[2].startswith("Ministère Factice des Finances — • le premier projet de loi"))
        self.assertTrue(projets[3].endswith("• la seconde ordonnance factice porte sur une caisse factice ;"), "les puces sont reprises")
        self.assertFalse(any("décret" in p for p in projets), "la section des décrets est exclue")

    def test_communique_sans_projet_de_loi(self):
        _, _, projets = gouv_conseil_ministres.analyser_communique(fixture("gouv_communique_sans_loi.html"), "u")
        self.assertEqual(projets, [])

    def test_structure_changee(self):
        with self.assertRaises(StructureChangee):
            gouv_conseil_ministres.analyser_communique("<html><body><p>Nouvelle maquette</p></body></html>", "u")

    def test_collecte_complete(self):
        pages = {
            "https://www.gouv.ci/robots.txt": ROBOTS_OUVERT,
            gouv_conseil_ministres.LISTE: FausseReponse(200, fixture("gouv_liste.html")),
            "https://www.gouv.ci/publications/conseils-des-ministres/3415": FausseReponse(200, fixture("gouv_communique.html")),
            "https://www.gouv.ci/publications/conseils-des-ministres/3399": FausseReponse(200, fixture("gouv_communique_sans_loi.html")),
        }
        ctx = Contexte(client(pages), Referentiel.charger(racine_temporaire()), dt.date(2099, 10, 20), 10)
        decouvertes = gouv_conseil_ministres.collecter(ctx)
        self.assertEqual([d.identifiant_base for d in decouvertes], ["src-gouv-ccm-2099-10-14"])
        self.assertEqual(decouvertes[0].titre, "Communiqué du Conseil des Ministres du mercredi 14 octobre 2099")
        self.assertTrue(any("aucun projet de loi" in j for j in ctx.journal))

    def test_liste_vide_structure_changee(self):
        pages = {"https://www.gouv.ci/robots.txt": ROBOTS_OUVERT, gouv_conseil_ministres.LISTE: FausseReponse(200, "<html></html>")}
        ctx = Contexte(client(pages), Referentiel.charger(racine_temporaire()), dt.date(2099, 1, 1), 10)
        with self.assertRaises(StructureChangee):
            gouv_conseil_ministres.collecter(ctx)


class TestAssnat(unittest.TestCase):
    def test_liens_articles_legislatifs_seulement(self):
        self.assertEqual(
            assnat.liens_articles(fixture("assnat_accueil.html")),
            [
                "https://www.assnat.ci/?examen-du-projet-de-loi-factice-la-commission-adopte",
                "https://www.assnat.ci/?seance-pleniere-factice-du-jeudi",
            ],
        )

    def test_analyse_article(self):
        titre, corps, pdfs = assnat.analyser_article(fixture("assnat_article.html"), "https://www.assnat.ci/?x")
        self.assertEqual(titre, "Examen du projet de loi factice La commission adopte")
        self.assertIn("10 novembre 2099", corps)
        self.assertEqual(pdfs, [("https://www.assnat.ci/IMG/pdf/texte_factice.pdf", "Texte du projet de loi factice")])

    def test_structure_changee(self):
        with self.assertRaises(StructureChangee):
            assnat.analyser_article("<html><div class='autre'><h1>Titre</h1></div></html>", "u")

    def test_collecte_avec_pdf_lu_puis_supprime(self):
        url_article = "https://www.assnat.ci/?examen-du-projet-de-loi-factice-la-commission-adopte"
        pages = {
            "https://www.assnat.ci/robots.txt": ROBOTS_OUVERT,
            assnat.BASE: FausseReponse(200, fixture("assnat_accueil.html")),
            url_article: FausseReponse(200, fixture("assnat_article.html")),
            "https://www.assnat.ci/IMG/pdf/texte_factice.pdf": FausseReponse(200, contenu=pdf_minimal()),
        }
        ctx = Contexte(client(pages), Referentiel.charger(racine_temporaire()), dt.date(2099, 11, 11), 10)
        decouvertes = assnat.collecter(ctx)
        formats = [(d.format, d.url) for d in decouvertes]
        self.assertIn(("page_web", url_article), formats)
        self.assertIn(("pdf", "https://www.assnat.ci/IMG/pdf/texte_factice.pdf"), formats)
        article = next(d for d in decouvertes if d.format == "page_web")
        self.assertIsNone(article.date_publication, "la date de publication n'est jamais devinée")
        self.assertTrue(any("2099-11-10" in p and "pas de publication" in p for p in article.pistes))


class TestReseauPoli(unittest.TestCase):
    def test_robots_txt_respecte(self):
        pages = {"https://site.ci/robots.txt": FausseReponse(200, "User-agent: *\nDisallow: /prive/\n")}
        c = client(pages)
        self.assertTrue(c.autorise("https://site.ci/public"))
        with self.assertRaises(PageInterdite):
            c.get("https://site.ci/prive/page")
        self.assertNotIn("https://site.ci/prive/page", c.session.demandees, "la page interdite n'est jamais demandée")

    def test_sans_robots_txt_tout_est_permis_et_serveur_en_erreur_tout_est_interdit(self):
        self.assertTrue(client({}).autorise("https://libre.ci/x"))
        c = client({"https://panne.ci/robots.txt": FausseReponse(503)})
        with mock.patch("loici_robot.config.ESSAIS", 1):
            self.assertFalse(c.autorise("https://panne.ci/x"))

    def test_pause_entre_deux_requetes_et_crawl_delay(self):
        attentes: list[float] = []
        horloge = iter(range(0, 1000))
        c = ClientPoli(
            agent="LoiCI-robot/test",
            pause=3,
            dormir=attentes.append,
            horloge=lambda: float(next(horloge)),
            session=FausseSession({"https://lent.ci/robots.txt": FausseReponse(200, "User-agent: *\nCrawl-delay: 10\n")}),
        )
        c.get("https://lent.ci/a")
        c.get("https://lent.ci/b")
        self.assertTrue(attentes and max(attentes) > 3, f"le Crawl-delay de 10 s doit primer : {attentes}")

    def test_identification(self):
        c = ClientPoli(session=FausseSession({}))
        self.assertTrue(c.session.headers["User-Agent"].startswith("LoiCI-robot/"))


class TestArchivage(unittest.TestCase):
    def test_lien_au_format_du_schema(self):
        self.assertEqual(archivage.lien_archive("20991114040658", "https://gouv.ci/x"), "https://web.archive.org/web/20991114040658/https://gouv.ci/x")

    def test_demande_d_archivage(self):
        url = "https://gouv.ci/x"
        c = client({archivage.ENREGISTRER + url: FausseReponse(302, headers={"Location": f"https://web.archive.org/web/20991114040658/{url}"})})
        self.assertEqual(archivage.demander_archivage(c, url), "20991114040658")
        c2 = client({archivage.ENREGISTRER + url: FausseReponse(520)})
        with mock.patch("loici_robot.config.ESSAIS", 1):
            self.assertIsNone(archivage.demander_archivage(c2, url))

    def test_archive_recente_reutilisee_ancienne_ignoree(self):
        url = "https://gouv.ci/x"
        api = f"{archivage.API_DISPONIBILITE}?url=https%3A%2F%2Fgouv.ci%2Fx"
        reponse = lambda ts: FausseReponse(200, json.dumps({"archived_snapshots": {"closest": {"available": True, "timestamp": ts}}}))
        self.assertEqual(archivage.instantane_recent(client({api: reponse("20991101000000")}), url, dt.date(2099, 11, 14)), "20991101000000")
        self.assertIsNone(archivage.instantane_recent(client({api: reponse("20980101000000")}), url, dt.date(2099, 11, 14)))


class TestPdf(unittest.TestCase):
    def fichiers_temporaires(self) -> set[str]:
        return set(glob.glob(os.path.join(tempfile.gettempdir(), "loici-*.pdf")))

    def test_pdf_lu_puis_supprime(self):
        avant = self.fichiers_temporaires()
        contenu = pdf_minimal("Loi factice")
        c = client({"https://assnat.ci/robots.txt": ROBOTS_OUVERT, "https://assnat.ci/a.pdf": FausseReponse(200, contenu=contenu)})
        infos = analyser_pdf(c, "https://assnat.ci/a.pdf")
        import hashlib

        self.assertEqual(infos.empreinte_sha256, hashlib.sha256(contenu).hexdigest())
        self.assertEqual(infos.nombre_pages, 1)
        self.assertIn("Loi factice", infos.debut_texte)
        self.assertEqual(self.fichiers_temporaires(), avant, "aucun document ne doit rester sur le disque")

    def test_document_qui_n_est_pas_un_pdf(self):
        avant = self.fichiers_temporaires()
        c = client({"https://assnat.ci/robots.txt": ROBOTS_OUVERT, "https://assnat.ci/b.pdf": FausseReponse(200, contenu=b"<html>erreur</html>")})
        with self.assertRaises(DocumentRefuse):
            analyser_pdf(c, "https://assnat.ci/b.pdf")
        self.assertEqual(self.fichiers_temporaires(), avant)


class TestSourcesEtVeille(unittest.TestCase):
    def test_comparaison_d_url_comme_la_ci(self):
        self.assertEqual(url_comparable("https://www.Gouv.ci/x/"), url_comparable("http://gouv.ci/x"))

    def test_type_et_identifiant(self):
        ref = Referentiel.charger(racine_temporaire([{"id": "src-a", "url": "https://plan.gouv.ci/a"}]))
        self.assertEqual(ref.type_source("https://plan.gouv.ci/b"), "officielle")
        self.assertEqual(ref.type_source("https://fauxgouv.ci/b"), "presse")
        self.assertEqual(ref.identifiant_libre("src-a"), "src-a-2")
        self.assertTrue(ref.connue("http://www.plan.gouv.ci/a/"))

    def test_source_fabriquee_complete(self):
        s = fabriquer_source(identifiant="src-x", url="https://gouv.ci/x", titre="T", nom="N", type_source="officielle",
                             format_source="page_web", date_publication=None, date_consultation="2099-01-01",
                             url_archive="https://web.archive.org/web/20990101000000/https://gouv.ci/x", empreinte_sha256="a" * 64)
        self.assertEqual(list(s), ["id", "url", "titre", "nom", "type", "format", "date_publication", "date_consultation", "url_archive", "empreinte_sha256"])
        self.assertIsNone(s["empreinte_sha256"], "pas d'empreinte pour une page web")

    def test_rotation_couvre_toutes_les_sources_en_une_semaine(self):
        ids = [f"s{i}" for i in range(20)]
        vues = [i for jour in range(7) for i in veille.sources_du_jour(ids, jour)]
        self.assertEqual(sorted(vues), sorted(ids))


class TestExecutionComplete(unittest.TestCase):
    def test_propose_une_source_archivee_et_ecrit_un_rapport(self):
        racine = racine_temporaire()
        decouverte = Decouverte("faux", "https://www.gouv.ci/publications/conseils-des-ministres/1", "Communiqué factice",
                                "Gouvernement de Côte d'Ivoire", "page_web", "2099-01-01", "src-gouv-ccm-2099-01-01", ["piste"])
        with mock.patch.dict(robot.COLLECTEURS, {"gouv_conseil_ministres": lambda ctx: [decouverte]}, clear=True), \
                mock.patch.object(robot, "obtenir_archive", lambda c, u, d: f"https://web.archive.org/web/20990101000000/{u}"):
            code = robot.principal(["--racine", str(racine), "--sans-veille", "--rapport", str(racine / "r.md"), "--issue", str(racine / "i.md")])
        self.assertEqual(code, 0)
        source = json.loads((racine / "donnees/sources/src-gouv-ccm-2099-01-01.json").read_text())
        self.assertEqual(source["type"], "officielle")
        self.assertIn("src-gouv-ccm-2099-01-01", (racine / "r.md").read_text())
        self.assertFalse((racine / "i.md").exists())

    def test_archivage_impossible_rien_n_est_ecrit(self):
        racine = racine_temporaire()
        decouverte = Decouverte("faux", "https://www.assnat.ci/?x", "Article", "AN", "page_web", None, "src-assnat-x")
        with mock.patch.dict(robot.COLLECTEURS, {"assnat": lambda ctx: [decouverte]}, clear=True), \
                mock.patch.object(robot, "obtenir_archive", lambda c, u, d: None):
            robot.principal(["--racine", str(racine), "--sans-veille", "--rapport", str(racine / "r.md")])
        self.assertEqual(list((racine / "donnees/sources").glob("*.json")), [])
        self.assertIn("Archivage impossible", (racine / "r.md").read_text())

    def test_structure_changee_code_2_et_texte_d_issue(self):
        racine = racine_temporaire()

        def casse(ctx):
            raise StructureChangee("site factice", "https://site.ci", "bloc introuvable")

        with mock.patch.dict(robot.COLLECTEURS, {"assnat": casse}, clear=True):
            code = robot.principal(["--racine", str(racine), "--sans-veille", "--rapport", str(racine / "r.md"), "--issue", str(racine / "i.md")])
        self.assertEqual(code, 2)
        self.assertIn("bloc introuvable", (racine / "i.md").read_text())


if __name__ == "__main__":
    unittest.main()
