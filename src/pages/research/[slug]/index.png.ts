import type { APIRoute } from "astro";
import { SITE } from "@/config";
import type { ResearchMeta } from "@/types/research";
import { generateOgImageForResearch } from "@/utils/generateOgImages";
import { getResearchArticles } from "@/utils/researchCollections";

export async function getStaticPaths() {
  if (!SITE.dynamicOgImage) {
    return [];
  }

  const metas = await getResearchArticles();
  return metas.map((meta) => ({ params: { slug: meta.slug }, props: meta }));
}

export const GET: APIRoute = async ({ props }) => {
  if (!SITE.dynamicOgImage) {
    return new Response(null, {
      status: 404,
      statusText: "Not found",
    });
  }

  const buffer = await generateOgImageForResearch(props as ResearchMeta);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
};
