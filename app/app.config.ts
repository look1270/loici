/**
 * Couleurs de l'interface : volontairement neutres (règle n° 6).
 * Aucune couleur ne doit évoquer un parti ; le vert et l'orange du drapeau sont aussi évités pour cette raison.
 */
export default defineAppConfig({
  /** Dépôt public : contributions, signalements d'erreurs et de bugs. */
  depot: "https://github.com/look1270/loici",
  ui: {
    colors: { primary: "blue", neutral: "slate" },
  },
});
