/**
 * Point d'entrée unique des schémas : utilisé par le site (types) et par la CI (validation).
 *
 * Ce que Zod vérifie ici : la forme et la cohérence interne de chaque fichier.
 * Les contrôles croisés entre fichiers (références existantes, domaines officiels, chambres,
 * dates futures, doublons d'URL…) sont dans scripts/lib/controles.ts.
 */
export * from "./communs";
export * from "./source";
export * from "./referentiels";
export * from "./acteurs";
export * from "./texte";
export * from "./statuts";
export * from "./api";
