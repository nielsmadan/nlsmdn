import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { SITE } from "@/config";
import { SERIES_SLUGS } from "@/series";
import {
  includeResearchSamples,
  researchGlob,
  researchMetaId,
  researchTextId,
} from "@/utils/research/articles";

export const BLOG_PATH = "src/data/blog";
export const RESEARCH_PATH = "src/data/research";

const includeSamples = includeResearchSamples(process.env.RESEARCH_SAMPLES);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: `./${BLOG_PATH}` }),
  schema: ({ image }) =>
    z.object({
      author: z.string().default(SITE.author),
      pubDatetime: z.date(),
      modDatetime: z.date().optional().nullable(),
      title: z.string(),
      featured: z.boolean().optional(),
      draft: z.boolean().optional(),
      tags: z.array(z.string()).default(["others"]),
      series: z.enum(SERIES_SLUGS).optional(),
      ogImage: image().or(z.string()).optional(),
      description: z.string(),
      canonicalURL: z.string().optional(),
      hideEditPost: z.boolean().optional(),
      timezone: z.string().optional(),
    }),
});

const researchMeta = defineCollection({
  loader: glob({
    pattern: researchGlob("*/meta.json", includeSamples),
    base: `./${RESEARCH_PATH}`,
    generateId: ({ entry }) => researchMetaId(entry),
  }),
  schema: z.object({
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    published: isoDate,
    updated: isoDate,
    lastVerified: isoDate,
    cursor: z.string(),
    minorEdits: z.array(isoDate),
    versions: z.array(
      z.object({
        n: z.number().int().positive(),
        date: isoDate,
        summary: z.string(),
        pr: z.number().int().nullable(),
      }),
    ),
  }),
});

const researchTexts = defineCollection({
  loader: glob({
    pattern: researchGlob("*/{v*,current}.md", includeSamples),
    base: `./${RESEARCH_PATH}`,
    generateId: ({ entry }) => researchTextId(entry),
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
  }),
});

export const collections = { blog, researchMeta, researchTexts };
