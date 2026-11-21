import rss from "@astrojs/rss";
import { SITE } from "@/config";
import { RESEARCH } from "@/research.config";
import { feedItems } from "@/utils/research/feed";
import { getResearchArticles } from "@/utils/researchCollections";

export async function GET() {
  const metas = await getResearchArticles();
  return rss({
    title: `${RESEARCH.title} | ${SITE.title}`,
    description: "New versions of the research notes on nlsmdn.com.",
    site: new URL("research/", SITE.website).href,
    items: feedItems(metas),
  });
}
