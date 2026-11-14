"""Erreurs du robot."""


class StructureChangee(Exception):
    """La page d'un site source n'a plus la structure attendue : le robot s'arrête proprement
    pour ce site et une issue est ouverte, plutôt que de proposer des données fausses."""

    def __init__(self, site: str, url: str, detail: str):
        super().__init__(f"{site} : {detail} ({url})")
        self.site = site
        self.url = url
        self.detail = detail


class PageInterdite(Exception):
    """robots.txt interdit cette page au robot : elle n'est pas consultée."""


class DocumentRefuse(Exception):
    """Document non téléchargé (trop gros, pas un PDF…)."""
