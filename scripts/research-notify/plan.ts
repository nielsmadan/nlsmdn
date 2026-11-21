import type { ResearchMeta } from "@/types/research";
import { articlePath, changesPath } from "@/utils/research/articles";
import { articleTopicDescription } from "@/utils/research/resend";

export interface PlannedBroadcast {
  slug: string;
  n: number;
  name: string;
  topicDescription: string;
  subject: string;
  html: string;
  text: string;
  liveUrl: string;
  isFirst: boolean;
}

type Config = { siteUrl: string; notifyFrom: string };

const absolute = (siteUrl: string, path: string) =>
  `${siteUrl}${path.replace(/^\//, "")}`;

export const absolutizeHrefs = (html: string, siteUrl: string) =>
  html.replace(/href="\/(?!\/)/g, `href="${siteUrl.replace(/\/$/, "")}/`);

export const broadcastName = (slug: string, n: number, published: string) =>
  `research:${slug}:v${n}:${published}`;

export const wasAnnounced = (
  meta: Pick<ResearchMeta, "slug" | "published">,
  existing: { name: string; status: string }[],
) => {
  const prefix = `research:${meta.slug}:v`;
  const suffix = `:${meta.published}`;
  return existing.some(
    (e) =>
      e.status !== "draft" &&
      e.name.startsWith(prefix) &&
      e.name.endsWith(suffix) &&
      /^\d+$/.test(e.name.slice(prefix.length, -suffix.length)),
  );
};

export const broadcastSubject = (title: string, n: number) =>
  n === 1 ? `New research: ${title}` : `Updated: ${title} (version ${n})`;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const P = 'style="margin:0 0 16px"';
const LINK = 'style="color:#2563eb"';

const emailBody = (
  meta: ResearchMeta,
  n: number,
  summary: string,
  urls: { article: string; changes: string },
  renderMarkdown: (md: string) => string,
  siteUrl: string,
) => {
  const intro =
    n === 1
      ? "A new research note is up on nlsmdn.com."
      : `Version ${n} of this research note is up on nlsmdn.com.`;
  const changesLabel = n === 1 ? "Read the note" : "See what changed";
  const unsubscribe =
    "You get this because you subscribed to research notes on nlsmdn.com.";
  const html = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111;max-width:600px">',
    `<h1 style="font-size:22px;margin:0 0 16px"><a href="${escapeHtml(urls.article)}" ${LINK}>${escapeHtml(meta.title)}</a></h1>`,
    `<p ${P}>${escapeHtml(intro)}</p>`,
    ...(n === 1 ? [`<p ${P}>${escapeHtml(meta.description)}</p>`] : []),
    `<div style="margin:0 0 16px">${absolutizeHrefs(renderMarkdown(summary), siteUrl)}</div>`,
    `<p ${P}><a href="${escapeHtml(urls.changes)}" ${LINK}>${changesLabel}</a>${n === 1 ? "" : ` · <a href="${escapeHtml(urls.article)}" ${LINK}>Read the note</a>`}</p>`,
    `<p style="margin:24px 0 0;font-size:13px;color:#666">${unsubscribe} <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#666">Unsubscribe or manage topics</a></p>`,
    "</div>",
  ].join("\n");
  const text = [
    meta.title,
    "",
    intro,
    ...(n === 1 ? ["", meta.description] : []),
    "",
    summary,
    "",
    `${changesLabel}: ${urls.changes}`,
    ...(n === 1 ? [] : [`Read the note: ${urls.article}`]),
    "",
    "--",
    unsubscribe,
    "Unsubscribe or manage topics: {{{RESEND_UNSUBSCRIBE_URL}}}",
    "",
  ].join("\n");
  return { html, text };
};

export const eligibleBroadcasts = (
  metas: ResearchMeta[],
  cfg: Config,
  renderMarkdown: (md: string) => string,
): PlannedBroadcast[] =>
  cfg.notifyFrom === ""
    ? []
    : metas.flatMap((meta) => {
        const latest = meta.versions.at(-1);
        if (!latest || latest.date < cfg.notifyFrom) return [];
        const { n } = latest;
        const article = absolute(cfg.siteUrl, articlePath(meta.slug));
        const liveUrl = absolute(cfg.siteUrl, changesPath(meta.slug, n));
        return [
          {
            slug: meta.slug,
            n,
            name: broadcastName(meta.slug, n, meta.published),
            topicDescription: articleTopicDescription(meta.slug),
            subject: broadcastSubject(meta.title, n),
            ...emailBody(
              meta,
              n,
              latest.summary,
              { article, changes: n === 1 ? article : liveUrl },
              renderMarkdown,
              cfg.siteUrl,
            ),
            liveUrl,
            isFirst: n === 1,
          },
        ];
      });

export function planBroadcasts(
  metas: ResearchMeta[],
  existing: { id: string; name: string; status: string }[],
  cfg: Config,
  renderMarkdown: (md: string) => string,
): { send: PlannedBroadcast[]; resendDrafts: { id: string; name: string }[] } {
  const planned = eligibleBroadcasts(metas, cfg, renderMarkdown).map((b) => {
    const same = existing.filter((e) => e.name === b.name);
    return {
      b,
      started: same.some((e) => e.status !== "draft"),
      draft: same.find((e) => e.status === "draft"),
    };
  });
  const pending = planned.filter(({ started }) => !started);
  return {
    send: pending.filter(({ draft }) => !draft).map(({ b }) => b),
    resendDrafts: pending.flatMap(({ b, draft }) =>
      draft ? [{ id: draft.id, name: b.name }] : [],
    ),
  };
}
