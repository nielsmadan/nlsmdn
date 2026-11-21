import { RESEARCH } from "@/research.config";
import type { ResearchMeta } from "@/types/research";

export interface ResearchArticle<T> {
  meta: ResearchMeta;
  versions: T[];
  current: T | null;
}

export const includeResearchSamples = (envValue: string | undefined) =>
  envValue === "1";

export const researchGlob = (pattern: string, includeSamples: boolean) =>
  includeSamples ? [pattern] : [pattern, "!_*/**"];

export const researchTextId = (entry: string) => entry.replace(/\.md$/, "");

export const researchMetaId = (entry: string) => entry.split("/")[0];

export const sortArticles = (metas: ResearchMeta[]) =>
  [...metas].sort(
    (a, b) =>
      b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title),
  );

export const selectArticle = <T extends { id: string }>(
  meta: ResearchMeta,
  texts: T[],
): ResearchArticle<T> => {
  const byId = new Map(texts.map((t) => [t.id, t]));
  const versions = meta.versions.map(({ n }) => {
    const text = byId.get(`${meta.slug}/v${n}`);
    if (!text) throw new Error(`Research ${meta.slug}: v${n}.md is missing`);
    return text;
  });
  return {
    meta,
    versions,
    current: byId.get(`${meta.slug}/current`) ?? null,
  };
};

export const getPublicText = <T>(article: ResearchArticle<T>): T => {
  const latest = article.current ?? article.versions.at(-1);
  if (!latest) throw new Error(`Research ${article.meta.slug} has no text`);
  return latest;
};

export const articlePath = (slug: string) => `${RESEARCH.path}/${slug}/`;

export const changesPath = (slug: string, version?: number | "current") =>
  version === undefined
    ? `${articlePath(slug)}changes/`
    : `${articlePath(slug)}changes/${version === "current" ? "current" : `v${version}`}/`;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const formatResearchDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]}, ${year}`;
};

export interface VersionLinePart {
  text: string;
  href?: string;
}

export const versionLine = (
  meta: ResearchMeta,
  opts: { hasCurrent: boolean; showFirstPublished?: boolean },
): VersionLinePart[] => {
  const n = meta.versions.at(-1)?.n ?? 1;
  return [
    { text: `Version ${n}` },
    { text: `Updated ${formatResearchDate(meta.updated)}` },
    { text: "What changed", href: changesPath(meta.slug) },
    ...(meta.lastVerified > meta.updated
      ? [{ text: `Last verified ${formatResearchDate(meta.lastVerified)}` }]
      : []),
    ...(opts.hasCurrent
      ? [
          {
            text: `minor edits since version ${n}`,
            href: changesPath(meta.slug, "current"),
          },
        ]
      : []),
    ...(opts.showFirstPublished && n > 1
      ? [{ text: `First published ${formatResearchDate(meta.published)}` }]
      : []),
  ];
};
