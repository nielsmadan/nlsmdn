import type { CollectionEntry } from "astro:content";
import { SERIES } from "@/series";

type SeriesFields = Pick<
  CollectionEntry<"blog">["data"],
  "series" | "seriesPart"
>;

export const getSeriesLabel = (data: SeriesFields): string | undefined => {
  const numbered = data.series ? SERIES[data.series].numbered : undefined;
  if (numbered === undefined || data.seriesPart === undefined) return undefined;
  return numbered.replace("%s", String(data.seriesPart));
};

export const getFullTitle = (
  data: Pick<CollectionEntry<"blog">["data"], "title" | keyof SeriesFields>,
): string => {
  const label = getSeriesLabel(data);
  const titleIncludesSeries =
    data.series && SERIES[data.series].titleIncludesSeries;
  return label && !titleIncludesSeries ? `${label}: ${data.title}` : data.title;
};
