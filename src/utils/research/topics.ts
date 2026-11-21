import { articleTopicDescription, type ResendClient } from "./resend";

export interface TopicArticle {
  slug: string;
  title: string;
}

type Topic = {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
};

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Resend returns created_at in one fixed-width UTC format, so strings sort by time.
const createdFirst = (a: Topic, b: Topic) =>
  (a.createdAt && b.createdAt ? compare(a.createdAt, b.createdAt) : 0) ||
  compare(a.id, b.id);

export const topicName = (title: string) => title.slice(0, 50);

export const matchArticleTopics = (
  articles: TopicArticle[],
  existing: Topic[],
) => {
  const ordered = [...existing].sort(createdFirst);
  const matched = articles.map((article) => ({
    article,
    topic: ordered.find(
      (t) => t.description === articleTopicDescription(article.slug),
    ),
  }));
  return {
    found: Object.fromEntries(
      matched.flatMap(({ article, topic }) =>
        topic ? [[article.slug, topic.id]] : [],
      ),
    ) as Record<string, string>,
    missing: matched
      .filter(({ topic }) => !topic)
      .map(({ article }) => article),
    renamed: matched
      .filter(
        ({ article, topic }) =>
          topic && topic.name !== topicName(article.title),
      )
      .map(({ article }) => article.slug),
  };
};

export async function ensureArticleTopics(
  resend: ResendClient,
  articles: TopicArticle[],
  existing?: Topic[],
): Promise<Record<string, string>> {
  const { found, missing } = matchArticleTopics(
    articles,
    existing ?? (await resend.listTopics()),
  );
  const ids = { ...found };
  for (const { slug, title } of missing) {
    ids[slug] = (
      await resend.createTopic({
        name: topicName(title),
        description: articleTopicDescription(slug),
        default_subscription: "opt_out",
        visibility: "public",
      })
    ).id;
  }
  if (missing.length === 0) return ids;
  // A concurrent creator may have made a duplicate; settle on the earliest topic.
  const settled = matchArticleTopics(articles, await resend.listTopics()).found;
  return { ...ids, ...settled };
}
