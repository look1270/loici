"""Faux réseau pour les tests : aucun site réel n'est contacté."""

from __future__ import annotations

from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(nom: str) -> str:
    return (FIXTURES / nom).read_text(encoding="utf-8")


def pdf_minimal(texte: str = "Document factice") -> bytes:
    """Petit PDF valide d'une page, fabriqué à la volée."""
    flux = f"BT /F1 12 Tf 72 720 Td ({texte}) Tj ET".encode()
    objets = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length " + str(len(flux)).encode() + b" >>\nstream\n" + flux + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    sortie = bytearray(b"%PDF-1.4\n")
    positions = []
    for i, obj in enumerate(objets, 1):
        positions.append(len(sortie))
        sortie += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(sortie)
    sortie += f"xref\n0 {len(objets) + 1}\n0000000000 65535 f \n".encode()
    for p in positions:
        sortie += f"{p:010d} 00000 n \n".encode()
    sortie += f"trailer\n<< /Size {len(objets) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(sortie)


class FausseReponse:
    def __init__(self, status_code: int = 200, text: str = "", contenu: bytes | None = None, headers: dict | None = None):
        self.status_code = status_code
        self.text = text
        self.content = contenu if contenu is not None else text.encode()
        self.headers = headers or {}

    def iter_content(self, chunk_size: int = 65536):
        for i in range(0, len(self.content), chunk_size):
            yield self.content[i : i + chunk_size]

    def json(self):
        import json

        return json.loads(self.text)

    def close(self):
        pass


class FausseSession:
    """Session HTTP simulée : `pages` associe une URL à une FausseReponse ; toute autre URL → 404."""

    def __init__(self, pages: dict[str, FausseReponse]):
        self.pages = pages
        self.headers: dict[str, str] = {}
        self.demandees: list[str] = []

    def get(self, url, timeout=None, stream=False, allow_redirects=True):
        self.demandees.append(url)
        return self.pages.get(url, FausseReponse(404))
