"""Client HTTP poli : respecte robots.txt, s'identifie clairement et attend entre deux requêtes.

Toutes les requêtes du robot passent par ce client (y compris vers la Wayback Machine).
"""

from __future__ import annotations

import time
import urllib.robotparser
from collections import Counter
from typing import Callable
from urllib.parse import urlsplit

import requests

from . import config
from .erreurs import PageInterdite


class ClientPoli:
    def __init__(
        self,
        agent: str | None = None,
        pause: float = config.PAUSE_PAR_HOTE,
        dormir: Callable[[float], None] = time.sleep,
        horloge: Callable[[], float] = time.monotonic,
        session: requests.Session | None = None,
    ):
        self.agent = agent or config.agent_utilisateur()
        self.pause = pause
        self._dormir = dormir
        self._horloge = horloge
        self.session = session or requests.Session()
        self.session.headers.update({"User-Agent": self.agent, "Accept-Language": "fr"})
        self._robots: dict[str, urllib.robotparser.RobotFileParser | None] = {}
        self._derniere_requete: dict[str, float] = {}
        self.statistiques: Counter[str] = Counter()

    # ------------------------------------------------------------------ robots.txt

    def _regles(self, url: str) -> urllib.robotparser.RobotFileParser | None:
        """Règles robots.txt du site (mises en cache). None = tout est permis (pas de robots.txt)."""
        parties = urlsplit(url)
        racine = f"{parties.scheme}://{parties.netloc}"
        if racine in self._robots:
            return self._robots[racine]
        regles: urllib.robotparser.RobotFileParser | None
        try:
            reponse = self._requete_brute(f"{racine}/robots.txt", stream=False)
            if reponse.status_code >= 500:
                # Serveur en erreur : par prudence, on considère que tout est interdit pour cette exécution.
                regles = urllib.robotparser.RobotFileParser()
                regles.parse(["User-agent: *", "Disallow: /"])
            elif reponse.status_code >= 400:
                regles = None  # pas de robots.txt : tout est permis
            else:
                regles = urllib.robotparser.RobotFileParser()
                regles.parse(reponse.text.splitlines())
        except requests.RequestException:
            regles = urllib.robotparser.RobotFileParser()
            regles.parse(["User-agent: *", "Disallow: /"])
        self._robots[racine] = regles
        return regles

    def autorise(self, url: str) -> bool:
        regles = self._regles(url)
        return regles is None or regles.can_fetch(self.agent, url)

    def _pause_pour(self, url: str) -> float:
        regles = self._robots.get(_racine(url))
        delai_robots = regles.crawl_delay(self.agent) if regles else None
        return max(self.pause, float(delai_robots or 0))

    # ------------------------------------------------------------------ requêtes

    def _attendre(self, url: str) -> None:
        hote = urlsplit(url).netloc
        derniere = self._derniere_requete.get(hote)
        if derniere is not None:
            reste = self._pause_pour(url) - (self._horloge() - derniere)
            if reste > 0:
                self._dormir(reste)
        self._derniere_requete[hote] = self._horloge()

    def _requete_brute(self, url: str, stream: bool, suivre: bool = True) -> requests.Response:
        self._attendre(url)
        self.statistiques[urlsplit(url).netloc] += 1
        return self.session.get(url, timeout=config.DELAI_REPONSE, stream=stream, allow_redirects=suivre)

    def get(self, url: str, stream: bool = False, suivre: bool = True, verifier_robots: bool = True) -> requests.Response:
        """GET poli. Lève PageInterdite si robots.txt l'interdit. Réessaie sur erreur réseau ou 5xx."""
        if verifier_robots and not self.autorise(url):
            raise PageInterdite(url)
        derniere_erreur: Exception | None = None
        for essai in range(1, config.ESSAIS + 1):
            try:
                reponse = self._requete_brute(url, stream=stream, suivre=suivre)
                if reponse.status_code < 500 and reponse.status_code != 429:
                    return reponse
                derniere_erreur = requests.HTTPError(f"HTTP {reponse.status_code}", response=reponse)
            except requests.RequestException as e:
                derniere_erreur = e
            if essai < config.ESSAIS:
                self._dormir(10 * essai)
        assert derniere_erreur is not None
        raise derniere_erreur


def _racine(url: str) -> str:
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"
