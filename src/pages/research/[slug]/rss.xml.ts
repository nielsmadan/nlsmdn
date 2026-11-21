import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { SITE } from "@/config";
import type { ResearchMeta } from "@/types/research";
import { feedItems } from "@/utils/research/feed";
import { getResearchArticles } from "@/utils/researchCollections";

export async function getStaticPaths() {
  const metas = await getResearchArticles();
  return metas.map((meta) => ({ params: { slug: meta.slug }, props: meta }));
}

export const GET: APIRoute = async ({ props }) => {
  const meta = props as ResearchMeta;
  return rss({
    title: `${meta.title} | ${SITE.title}`,
    description: meta.description,
    site: new URL(`research/${meta.slug}/`, SITE.website).href,
    items: feedItems([meta]),
  });
};
