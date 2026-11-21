import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RESEARCH } from "@/research.config";
import type { ResearchMeta } from "@/types/research";
import {
  demoteHeadings,
  renderResearchMarkdown,
} from "@/utils/research/markdown";
import {
  createResendClient,
  type ResendClient,
  ResendError,
} from "@/utils/research/resend";
import {
  ensureArticleTopics,
  matchArticleTopics,
  topicName,
} from "@/utils/research/topics";
import {
  eligibleBroadcasts,
  type PlannedBroadcast,
  planBroadcasts,
  wasAnnounced,
} from "./plan";

type TopicSubscription = { id: string; subscription: "opt_in" | "opt_out" };

export interface NotifyEnv {
  dryRun: boolean;
  apiKey: string;
  ghToken: string;
  notifySha: string;
  repo: string;
}

export interface NotifyConfig {
  siteUrl: string;
  notifyFrom: string;
  segmentId: string;
  allTopicId: string;
  from: string;
}

export interface NotifyDeps {
  metas: ResearchMeta[];
  env: NotifyEnv;
  config: NotifyConfig;
  resend: ResendClient | null;
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  renderMarkdown: (md: string) => Promise<string>;
  log: (line: string) => void;
}

const LIVE_CHECK_RETRIES = 6;
const LIVE_CHECK_DELAY_MS = 10_000;
const HTTP_TIMEOUT_MS = 10_000;
const USER_AGENT = "nlsmdn-research-notify/1.0";

export const readEnv = (
  env: Record<string, string | undefined>,
  argv: string[],
): NotifyEnv => ({
  dryRun: argv.includes("--dry-run") || env.DRY_RUN === "1",
  apiKey: env.RESEND_API_KEY ?? "",
  ghToken: env.GH_TOKEN ?? "",
  notifySha: env.NOTIFY_SHA ?? "",
  repo: env.GITHUB_REPOSITORY || "nielsmadan/nlsmdn",
});

export const readMetas = (
  dir: string,
  log: (line: string) => void,
): ResearchMeta[] => {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
  const hasMeta = (name: string) => existsSync(join(dir, name, "meta.json"));
  for (const name of names.filter((n) => !hasMeta(n))) {
    log(`warning: skipped ${name}, no meta.json`);
  }
  return names
    .filter(hasMeta)
    .map((name) =>
      JSON.parse(readFileSync(join(dir, name, "meta.json"), "utf8")),
    );
};

export const missingConfig = (
  env: NotifyEnv,
  config: NotifyConfig,
  hasClient: boolean,
) =>
  [
    ["RESEND_API_KEY", env.apiKey && hasClient],
    ["GH_TOKEN", env.ghToken],
    ["NOTIFY_SHA", env.notifySha],
    ["RESEARCH.segmentId", config.segmentId],
    ["RESEARCH.allTopicId", config.allTopicId],
    ["RESEARCH.from", config.from],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name as string);

export const propagationTopics = (
  topics: TopicSubscription[],
  allTopicId: string,
  articleTopicIds: string[],
): TopicSubscription[] => {
  const optedIn = (id: string) =>
    topics.some((t) => t.id === id && t.subscription === "opt_in");
  return optedIn(allTopicId)
    ? articleTopicIds
        .filter((id) => !optedIn(id))
        .map((id) => ({ id, subscription: "opt_in" }))
    : [];
};

export const describeError = (err: unknown) =>
  (err instanceof ResendError
    ? `Resend ${err.status} ${err.errorName}`.trim()
    : err instanceof Error
      ? err.message
      : String(err)
  ).replace(/[^\s/@]+(@|%40)[^\s/?]+/g, "<email>");

export async function mainTip(
  fetchImpl: typeof fetch,
  repo: string,
  token: string,
): Promise<string> {
  const res = await fetchImpl(
    `https://api.github.com/repos/${repo}/commits/main`,
    {
      headers: {
        Accept: "application/vnd.github.sha",
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`GitHub commits/main returned ${res.status}`);
  return (await res.text()).trim();
}

export async function isLive(
  fetchImpl: typeof fetch,
  url: string,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  for (let attempt = 0; attempt <= LIVE_CHECK_RETRIES; attempt++) {
    if (attempt > 0) await sleep(LIVE_CHECK_DELAY_MS);
    try {
      const res = await fetchImpl(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      await res.body?.cancel();
      if (res.status === 200) return true;
    } catch {}
  }
  return false;
}

async function propagate(
  resend: ResendClient,
  config: NotifyConfig,
  articleTopicIds: string[],
): Promise<{ updated: number; scanned: number }> {
  const contacts = (await resend.listSegmentContacts(config.segmentId)).filter(
    (c) => !c.unsubscribed,
  );
  let updated = 0;
  for (const { email } of contacts) {
    const add = propagationTopics(
      await resend.listContactTopics(email),
      config.allTopicId,
      articleTopicIds,
    );
    if (add.length > 0) {
      await resend.updateContactTopics(email, add);
      updated++;
    }
  }
  return { updated, scanned: contacts.length };
}

async function createDraft(
  resend: ResendClient,
  config: NotifyConfig,
  b: PlannedBroadcast,
  topicId: string,
  log: (line: string) => void,
): Promise<string> {
  try {
    const { id } = await resend.createBroadcast({
      segment_id: config.segmentId,
      topic_id: topicId,
      from: config.from,
      subject: b.subject,
      html: b.html,
      text: b.text,
      name: b.name,
    });
    if (id) return id;
    throw new Error("Resend returned no broadcast id");
  } catch (err) {
    const draft = (await resend.listBroadcasts()).find(
      (e) => e.name === b.name && e.status === "draft",
    );
    if (!draft) throw err;
    log(
      `create ${b.name} failed (${describeError(err)}), using draft ${draft.id}`,
    );
    return draft.id;
  }
}

const describePlanned = (b: PlannedBroadcast, draftId?: string) =>
  `${draftId ? `send draft ${draftId}` : "create and send"} ${b.name}: "${b.subject}" to topic ${b.topicDescription}`;

export async function runNotify(deps: NotifyDeps): Promise<number> {
  const { env, config, resend, log } = deps;
  const live = !env.dryRun;
  log(
    `research-notify: ${live ? "live" : "dry run"}, ${deps.metas.length} article(s)`,
  );

  if (live) {
    const missing = missingConfig(env, config, resend !== null);
    if (missing.length > 0) {
      log(`missing config: ${missing.join(", ")}`);
      return 1;
    }
    const tip = await mainTip(deps.fetch, env.repo, env.ghToken);
    if (tip !== env.notifySha) {
      log(
        `not the tip of main (dispatched ${env.notifySha.slice(0, 7)}, main is ${tip.slice(0, 7)}), skipping`,
      );
      return 0;
    }
  }

  const articles = deps.metas.map(({ slug, title }) => ({ slug, title }));
  let topicIds: Record<string, string> = {};
  let failed = false;
  if (resend) {
    const existing = await resend.listTopics();
    const { found, missing, renamed } = matchArticleTopics(articles, existing);
    for (const slug of renamed) {
      const name = topicName(
        articles.find((a) => a.slug === slug)?.title ?? "",
      );
      if (!live) {
        log(`topic ${slug}: would rename to "${name}"`);
        continue;
      }
      try {
        await resend.updateTopic(found[slug], { name });
        log(`topic ${slug}: renamed to "${name}"`);
      } catch (err) {
        log(`topic ${slug}: rename failed: ${describeError(err)}`);
        failed = true;
      }
    }
    topicIds = live
      ? await ensureArticleTopics(resend, articles, existing)
      : found;
    for (const { slug } of missing) {
      log(`topic ${slug}: ${live ? "created" : "would create"}`);
    }
  } else {
    log("no RESEND_API_KEY: topics and broadcasts not read");
  }

  if (config.notifyFrom === "") {
    log("nothing to send (notifyFrom not set)");
    return failed ? 1 : 0;
  }

  const summaries = [
    ...new Set(deps.metas.map((m) => m.versions.at(-1)?.summary ?? "")),
  ];
  const rendered = new Map(
    await Promise.all(
      summaries.map(
        async (s) => [s, await deps.renderMarkdown(s)] as [string, string],
      ),
    ),
  );
  const render = (md: string) => rendered.get(md) ?? "";
  const broadcasts = resend ? await resend.listBroadcasts() : [];
  const byName = new Map(
    eligibleBroadcasts(deps.metas, config, render).map((b) => [b.name, b]),
  );
  const { send, resendDrafts } = planBroadcasts(
    deps.metas,
    broadcasts,
    config,
    render,
  );
  const firstAnnouncement = new Set(
    deps.metas.filter((m) => !wasAnnounced(m, broadcasts)).map((m) => m.slug),
  );
  const items = [
    ...resendDrafts.flatMap(({ id, name }) => {
      const b = byName.get(name);
      return b ? [{ b, draftId: id as string | undefined }] : [];
    }),
    ...send.map((b) => ({ b, draftId: undefined })),
  ];
  if (items.length === 0) {
    log("nothing to send");
    return failed ? 1 : 0;
  }

  if (!live) {
    for (const { b, draftId } of items) {
      log(`would ${describePlanned(b, draftId)}`);
      if (firstAnnouncement.has(b.slug)) {
        log(`  would first opt in all-research contacts lacking ${b.slug}`);
      }
      log(`  live check: ${b.liveUrl}`);
      log(b.text.replace(/^/gm, "  | "));
    }
    return 0;
  }

  const client = resend as ResendClient;
  const hasIds = (b: PlannedBroadcast) =>
    Boolean(topicIds[b.slug]) && Boolean(config.segmentId);
  for (const { b } of items.filter(({ b }) => !hasIds(b))) {
    log(`error: skipped ${b.name}, missing topic or segment id`);
    failed = true;
  }
  const ready = items.filter(({ b }) => hasIds(b));
  if (ready.length === 0) return 1;

  const propagateIds = [
    ...new Set(
      ready
        .filter(({ b }) => firstAnnouncement.has(b.slug))
        .map(({ b }) => topicIds[b.slug]),
    ),
  ];
  const propagationFailed = new Set<string>();
  if (propagateIds.length > 0) {
    try {
      const { updated, scanned } = await propagate(
        client,
        config,
        propagateIds,
      );
      log(`propagated topics to ${updated} of ${scanned} contact(s)`);
    } catch (err) {
      log(`propagation failed: ${describeError(err)}`);
      for (const { b } of ready.filter(({ b }) =>
        firstAnnouncement.has(b.slug),
      )) {
        log(`skipped ${b.name}: propagation failed`);
        propagationFailed.add(b.slug);
      }
      failed = true;
    }
  }

  for (const { b, draftId } of ready.filter(
    ({ b }) => !propagationFailed.has(b.slug),
  )) {
    if (!(await isLive(deps.fetch, b.liveUrl, deps.sleep))) {
      log(`warning: skipped ${b.name}, ${b.liveUrl} is not live`);
      failed = true;
      continue;
    }
    try {
      const id =
        draftId ??
        (await createDraft(client, config, b, topicIds[b.slug], log));
      await client.sendBroadcast(id);
      log(`sent ${b.name}${draftId ? " (draft)" : ""}`);
    } catch (err) {
      log(`failed ${b.name}: ${describeError(err)}`);
      failed = true;
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.main) {
  const env = readEnv(process.env, process.argv.slice(2));
  const log = (line: string) => console.log(line);
  try {
    const code = await runNotify({
      metas: readMetas(join(import.meta.dir, "../../src/data/research"), log),
      env,
      config: RESEARCH,
      resend: env.apiKey ? createResendClient(env.apiKey) : null,
      fetch,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      renderMarkdown: async (md) =>
        demoteHeadings(await renderResearchMarkdown(md), 1),
      log,
    });
    process.exit(code);
  } catch (err) {
    log(`research-notify failed: ${describeError(err)}`);
    process.exit(1);
  }
}
