"""Robot de collecte de LoiCI.

Il lit les pages publiques des sources officielles, extrait les métadonnées et le lien des documents,
demande leur archivage à la Wayback Machine, puis prépare des fichiers de source pour une pull request.
Il ne publie jamais directement : un humain relit et valide chaque proposition.
"""

__version__ = "1.0.0"
