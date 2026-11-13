import type { CollectionEntry } from "astro:content";
import type { SeriesSlug } from "@/series";
import postFilter from "./postFilter";

const getPostsBySeries = (
  posts: CollectionEntry<"blog">[],
  series: SeriesSlug,
) =>
  posts
    .filter(postFilter)
    .filter((post) => post.data.series === series)
    .sort(
      (a, b) => b.data.pubDatetime.getTime() - a.data.pubDatetime.getTime(),
    );

export default getPostsBySeries;
