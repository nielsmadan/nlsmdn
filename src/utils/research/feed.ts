import type { ResearchMeta } from "@/types/research";
import { articlePath, changesPath } from "./articles";

export interface ResearchFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
}

export const markdownToPlainText = (md: string) =>
  md
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^(\s*)[*+]\s+/, "$1- ")
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]+)\]\((?:[^()]|\([^)]*\))*\)/g, "$1")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/(?<![\w])__(.+?)__(?![\w.])/g, "$1")
        .replace(/\*([^*\s][^*]*)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .trimEnd(),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const versionFeedLink = (slug: string, n: number) =>
  n === 1 ? articlePath(slug) : changesPath(slug, n);

export const feedItems = (metas: ResearchMeta[]): ResearchFeedItem[] =>
  metas
    .flatMap((meta) => meta.versions.map((version) => ({ meta, version })))
    .sort(
      (a, b) =>
        b.version.date.localeCompare(a.version.date) ||
        a.meta.title.localeCompare(b.meta.title) ||
        b.version.n - a.version.n,
    )
    .map(({ meta, version }) => ({
      title: `${meta.title} (version ${version.n})`,
      link: versionFeedLink(meta.slug, version.n),
      description: markdownToPlainText(version.summary),
      pubDate: new Date(`${version.date}T00:00:00Z`),
    }));
