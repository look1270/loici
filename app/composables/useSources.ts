/**
 * Sources numérotées d'une fiche, partagées avec tous ses composants.
 * Chaque information affichée renvoie à ses sources par un numéro [1], [2]…
 * qui mène à la liste complète en bas de page (URL, type, dates, archive).
 */
import type { ComputedRef, InjectionKey } from "vue";
import type { Source } from "~~/schemas";

export interface SourcesNumerotees {
  /** Ordre d'affichage : officielles d'abord (règle n° 7), puis presse ; ordre d'apparition conservé sinon. */
  liste: Source[];
  numero: (id: string) => number | null;
  parId: Record<string, Source>;
}

export function numeroterSources(sources: Record<string, Source>): SourcesNumerotees {
  const toutes = Object.values(sources);
  const liste = [...toutes.filter((s) => s.type === "officielle"), ...toutes.filter((s) => s.type !== "officielle")];
  const numeros = new Map(liste.map((s, i) => [s.id, i + 1]));
  return { liste, numero: (id) => numeros.get(id) ?? null, parId: sources };
}

const CLE_SOURCES: InjectionKey<ComputedRef<SourcesNumerotees | null>> = Symbol("sources-de-la-fiche");

export const fournirSources = (sources: ComputedRef<SourcesNumerotees | null>) => provide(CLE_SOURCES, sources);
export const utiliserSources = () => inject(CLE_SOURCES, computed(() => null));
