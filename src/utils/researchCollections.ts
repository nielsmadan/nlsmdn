import { type CollectionEntry, getCollection, getEntry } from "astro:content";
import {
  type ResearchArticle,
  selectArticle,
  sortArticles,
} from "@/utils/research/articles";

export type ResearchText = CollectionEntry<"researchTexts">;

export const getResearchArticles = async () => {
  const entries = await getCollection("researchMeta");
  return sortArticles(entries.map((e) => e.data));
};

export const getArticle = async (
  slug: string,
): Promise<ResearchArticle<ResearchText> | null> => {
  const entry = await getEntry("researchMeta", slug);
  if (!entry) return null;
  const texts = await getCollection("researchTexts", ({ id }) =>
    id.startsWith(`${slug}/`),
  );
  return selectArticle(entry.data, texts);
};
