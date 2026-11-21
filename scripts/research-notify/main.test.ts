import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ResearchMeta } from "@/types/research";
import { type ResendClient, ResendError } from "@/utils/research/resend";
import {
  describeError,
  type NotifyDeps,
  propagationTopics,
  readEnv,
  readMetas,
  runNotify,
} from "./main";

type TopicSub = { id: string; subscription: "opt_in" | "opt_out" };

const SHA = "a".repeat(40);
const ALL = "topic-all";
const benchTopic = {
  id: "topic-bench",
  name: "Title of bench",
  description: "nlsmdn.com/research/bench",
};

const meta = (
  slug: string,
  versions: number[],
  date: string,
): ResearchMeta => ({
  slug,
  title: `Title of ${slug}`,
  description: `About ${slug}.`,
  published: "2026-11-02",
  updated: date,
  lastVerified: date,
  cursor: "abc",
  minorEdits: [],
  versions: versions.map((n) => ({
    n,
    date: n === versions.length ? date : "2026-11-02",
    summary: n === 1 ? "First published." : `Change ${n}.`,
    pr: n === 1 ? null : n,
  })),
});

const stubResend = (data: {
  topics?: { id: string; name: string; description: string }[];
  broadcasts?: { id: string; name: string; status: string }[];
  contacts?: { email: string; unsubscribed: boolean }[];
  contactTopics?: Record<string, TopicSub[]>;
  failCreateBroadcast?: boolean;
  createError?: ResendError;
  draftOnCreateFailure?: string;
  failSendBroadcast?: boolean;
  failPropagation?: boolean;
  createdTopicId?: string;
}) => {
  const broadcasts = [...(data.broadcasts ?? [])];
  const writes: { method: string; args: unknown[] }[] = [];
  const write =
    <T>(method: string, result: T) =>
    async (...args: unknown[]) => {
      writes.push({ method, args });
      return result;
    };
  const client: ResendClient = {
    sendEmail: write("sendEmail", undefined),
    getContact: async () => null,
    createContact: write("createContact", { id: "c" }),
    updateContact: write("updateContact", undefined),
    addToSegment: write("addToSegment", undefined),
    listContactTopics: async (email) => data.contactTopics?.[email] ?? [],
    updateContactTopics: write("updateContactTopics", undefined),
    listSegmentContacts: async () => {
      if (data.failPropagation) {
        throw new ResendError(500, "internal_server_error", "GET", "/x");
      }
      return data.contacts ?? [];
    },
    listTopics: async () => data.topics ?? [],
    createTopic: async (t) => {
      writes.push({ method: "createTopic", args: [t] });
      return {
        id: data.createdTopicId ?? `topic-${t.description.split("/").at(-1)}`,
      };
    },
    updateTopic: write("updateTopic", undefined),
    listBroadcasts: async () => broadcasts,
    createBroadcast: async (b) => {
      writes.push({ method: "createBroadcast", args: [b] });
      if (data.draftOnCreateFailure) {
        broadcasts.push({
          id: data.draftOnCreateFailure,
          name: b.name,
          status: "draft",
        });
      }
      if (data.failCreateBroadcast || data.createError) {
        throw (
          data.createError ??
          new ResendError(422, "validation_error", "POST", "/broadcasts")
        );
      }
      return { id: "new-broadcast" };
    },
    sendBroadcast: async (id) => {
      writes.push({ method: "sendBroadcast", args: [id] });
      if (data.failSendBroadcast) {
        throw new ResendError(502, "", "POST", `/broadcasts/${id}/send`);
      }
    },
  };
  return { client, writes };
};

const stubFetch = (opts: { tip?: string; liveStatus?: number }) => {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(url);
    if (url.startsWith("https://api.github.com/")) {
      return new Response(opts.tip ?? SHA);
    }
    return new Response("ok", { status: opts.liveStatus ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, urls };
};

const setup = (
  overrides: Partial<NotifyDeps> & {
    resendData?: Parameters<typeof stubResend>[0];
    fetchOpts?: Parameters<typeof stubFetch>[0];
  } = {},
) => {
  const { client, writes } = stubResend(overrides.resendData ?? {});
  const { impl, urls } = stubFetch(overrides.fetchOpts ?? {});
  const lines: string[] = [];
  const sleeps: number[] = [];
  const deps: NotifyDeps = {
    metas: [meta("bench", [1, 2, 3], "2026-11-20")],
    env: {
      dryRun: false,
      apiKey: "re_test",
      ghToken: "gh_test",
      notifySha: SHA,
      repo: "nielsmadan/nlsmdn",
    },
    config: {
      siteUrl: "https://nlsmdn.com/",
      notifyFrom: "2026-11-01",
      segmentId: "segment",
      allTopicId: ALL,
      from: "Niels <research@nlsmdn.com>",
    },
    resend: client,
    fetch: impl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    renderMarkdown: async (md) => `<p>${md}</p>`,
    log: (line) => lines.push(line),
    ...overrides,
  };
  return { deps, writes, urls, lines, sleeps };
};

describe("runNotify", () => {
  test("live run creates the missing topic and sends the broadcast", async () => {
    const { deps, writes, lines } = setup();
    expect(await runNotify(deps)).toBe(0);
    expect(writes.map((w) => w.method)).toEqual([
      "createTopic",
      "createBroadcast",
      "sendBroadcast",
    ]);
    expect(writes[1].args[0]).toEqual({
      segment_id: "segment",
      topic_id: "topic-bench",
      from: "Niels <research@nlsmdn.com>",
      name: "research:bench:v3:2026-11-02",
      subject: "Updated: Title of bench (version 3)",
      html: expect.any(String),
      text: expect.any(String),
    });
    expect(writes[2].args).toEqual(["new-broadcast"]);
    expect(lines).toContain("sent research:bench:v3:2026-11-02");
  });

  test("dry run makes no write calls", async () => {
    const { deps, writes, lines } = setup({
      metas: [
        meta("bench", [1, 2, 3], "2026-11-20"),
        meta("new", [1], "2026-11-20"),
      ],
      env: {
        dryRun: true,
        apiKey: "re_test",
        ghToken: "",
        notifySha: "",
        repo: "nielsmadan/nlsmdn",
      },
      resendData: {
        topics: [
          {
            id: "topic-bench",
            name: "Old title",
            description: "nlsmdn.com/research/bench",
          },
        ],
        contacts: [{ email: "a@example.com", unsubscribed: false }],
        contactTopics: {
          "a@example.com": [{ id: ALL, subscription: "opt_in" }],
        },
        broadcasts: [
          { id: "d1", name: "research:bench:v3:2026-11-02", status: "draft" },
        ],
      },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes).toEqual([]);
    expect(lines).toContain("topic new: would create");
    expect(lines).toContain('topic bench: would rename to "Title of bench"');
    expect(lines.some((l) => l.startsWith("would send draft d1"))).toBe(true);
    expect(
      lines.some((l) => l.startsWith("would create and send research:new:v1")),
    ).toBe(true);
  });

  test("dry run without a key plans from no existing broadcasts", async () => {
    const { deps, lines } = setup({
      env: {
        dryRun: true,
        apiKey: "",
        ghToken: "",
        notifySha: "",
        repo: "nielsmadan/nlsmdn",
      },
      resend: null,
    });
    expect(await runNotify(deps)).toBe(0);
    expect(lines).toContain(
      "no RESEND_API_KEY: topics and broadcasts not read",
    );
    expect(
      lines.some((l) =>
        l.startsWith("would create and send research:bench:v3"),
      ),
    ).toBe(true);
  });

  test("an empty notifyFrom sends nothing", async () => {
    const { deps, writes, lines } = setup({
      env: {
        dryRun: true,
        apiKey: "",
        ghToken: "",
        notifySha: "",
        repo: "nielsmadan/nlsmdn",
      },
      resend: null,
    });
    deps.config = { ...deps.config, notifyFrom: "" };
    expect(await runNotify(deps)).toBe(0);
    expect(writes).toEqual([]);
    expect(lines.at(-1)).toBe("nothing to send (notifyFrom not set)");
  });

  test("a dispatched SHA that is not the tip exits 0 without sending", async () => {
    const { deps, writes, lines, urls } = setup({
      fetchOpts: { tip: "b".repeat(40) },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes).toEqual([]);
    expect(urls).toEqual([
      "https://api.github.com/repos/nielsmadan/nlsmdn/commits/main",
    ]);
    expect(lines.at(-1)).toStartWith("not the tip of main");
  });

  test("live mode with missing config exits 1 before any call", async () => {
    const { deps, writes, urls, lines } = setup({
      env: {
        dryRun: false,
        apiKey: "",
        ghToken: "",
        notifySha: SHA,
        repo: "nielsmadan/nlsmdn",
      },
      resend: null,
    });
    expect(await runNotify(deps)).toBe(1);
    expect(writes).toEqual([]);
    expect(urls).toEqual([]);
    expect(lines.at(-1)).toBe("missing config: RESEND_API_KEY, GH_TOKEN");
  });

  test("propagation opts in only all-research contacts lacking the topic", async () => {
    const { deps, writes } = setup({
      metas: [meta("new", [1], "2026-11-20")],
      resendData: {
        topics: [
          {
            id: "topic-new",
            name: "Title of new",
            description: "nlsmdn.com/research/new",
          },
        ],
        contacts: [
          { email: "all@example.com", unsubscribed: false },
          { email: "has@example.com", unsubscribed: false },
          { email: "news@example.com", unsubscribed: false },
          { email: "gone@example.com", unsubscribed: true },
        ],
        contactTopics: {
          "all@example.com": [
            { id: ALL, subscription: "opt_in" },
            { id: "topic-new", subscription: "opt_out" },
          ],
          "has@example.com": [
            { id: ALL, subscription: "opt_in" },
            { id: "topic-new", subscription: "opt_in" },
          ],
          "news@example.com": [{ id: "blog", subscription: "opt_in" }],
          "gone@example.com": [{ id: ALL, subscription: "opt_in" }],
        },
      },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes.map((w) => [w.method, w.args])).toEqual([
      [
        "updateContactTopics",
        ["all@example.com", [{ id: "topic-new", subscription: "opt_in" }]],
      ],
      ["createBroadcast", [expect.objectContaining({ topic_id: "topic-new" })]],
      ["sendBroadcast", ["new-broadcast"]],
    ]);
  });

  test("propagation runs before the first announcement of a later version", async () => {
    const { deps, writes } = setup({
      resendData: {
        topics: [benchTopic],
        contacts: [{ email: "all@example.com", unsubscribed: false }],
        contactTopics: {
          "all@example.com": [{ id: ALL, subscription: "opt_in" }],
        },
        broadcasts: [
          { id: "d2", name: "research:bench:v2:2026-11-02", status: "draft" },
          { id: "old", name: "research:bench:v2:2026-10-01", status: "sent" },
        ],
      },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes.map((w) => [w.method, w.args[0]])).toEqual([
      ["updateContactTopics", "all@example.com"],
      ["createBroadcast", expect.objectContaining({ topic_id: "topic-bench" })],
      ["sendBroadcast", "new-broadcast"],
    ]);
  });

  test("an article announced before keeps per-article opt-outs", async () => {
    const { deps, writes, lines } = setup({
      resendData: {
        topics: [benchTopic],
        contacts: [{ email: "all@example.com", unsubscribed: false }],
        contactTopics: {
          "all@example.com": [
            { id: ALL, subscription: "opt_in" },
            { id: "topic-bench", subscription: "opt_out" },
          ],
        },
        broadcasts: [
          { id: "b2", name: "research:bench:v2:2026-11-02", status: "sent" },
        ],
      },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes.map((w) => [w.method, w.args[0]])).toEqual([
      ["createBroadcast", expect.objectContaining({ topic_id: "topic-bench" })],
      ["sendBroadcast", "new-broadcast"],
    ]);
    expect(lines).toContain("sent research:bench:v3:2026-11-02");
  });

  test("a propagation failure skips only the first announcements", async () => {
    const { deps, writes, lines } = setup({
      metas: [
        meta("bench", [1, 2, 3], "2026-11-20"),
        meta("new", [1], "2026-11-20"),
      ],
      resendData: {
        topics: [
          benchTopic,
          {
            id: "topic-new",
            name: "Title of new",
            description: "nlsmdn.com/research/new",
          },
        ],
        broadcasts: [
          { id: "b2", name: "research:bench:v2:2026-11-02", status: "sent" },
        ],
        failPropagation: true,
      },
    });
    expect(await runNotify(deps)).toBe(1);
    expect(lines).toContain(
      "skipped research:new:v1:2026-11-02: propagation failed",
    );
    expect(writes.map((w) => [w.method, w.args[0]])).toEqual([
      ["createBroadcast", expect.objectContaining({ topic_id: "topic-bench" })],
      ["sendBroadcast", "new-broadcast"],
    ]);
  });

  test("a propagation failure skips the broadcasts and exits 1", async () => {
    const { deps, writes, lines } = setup({
      resendData: { topics: [benchTopic], failPropagation: true },
    });
    expect(await runNotify(deps)).toBe(1);
    expect(writes).toEqual([]);
    expect(lines.at(-1)).toBe(
      "skipped research:bench:v3:2026-11-02: propagation failed",
    );
  });

  test("a missing topic id skips the item and exits 1", async () => {
    const { deps, writes, lines } = setup({
      resendData: { createdTopicId: "" },
    });
    expect(await runNotify(deps)).toBe(1);
    expect(writes.map((w) => w.method)).toEqual(["createTopic"]);
    expect(lines.at(-1)).toBe(
      "error: skipped research:bench:v3:2026-11-02, missing topic or segment id",
    );
  });

  test("a failed create reuses a same-name draft", async () => {
    const { deps, writes } = setup({
      resendData: {
        topics: [benchTopic],
        createError: new ResendError(502, "", "POST", "/broadcasts"),
        draftOnCreateFailure: "d9",
      },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes.map((w) => [w.method, w.args[0]])).toEqual([
      ["createBroadcast", expect.anything()],
      ["sendBroadcast", "d9"],
    ]);
  });

  test("a failed send is not retried and exits 1", async () => {
    const { deps, writes, lines } = setup({
      resendData: { topics: [benchTopic], failSendBroadcast: true },
    });
    expect(await runNotify(deps)).toBe(1);
    expect(writes.map((w) => w.method)).toEqual([
      "createBroadcast",
      "sendBroadcast",
    ]);
    expect(lines.at(-1)).toBe(
      "failed research:bench:v3:2026-11-02: Resend 502",
    );
  });

  test("a renamed article renames its topic", async () => {
    const { deps, writes } = setup({
      resendData: { topics: [{ ...benchTopic, name: "Old title" }] },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes[0]).toEqual({
      method: "updateTopic",
      args: ["topic-bench", { name: "Title of bench" }],
    });
  });

  test("a failing live check skips the send and exits 1", async () => {
    const { deps, writes, lines, urls, sleeps } = setup({
      fetchOpts: { liveStatus: 404 },
      resendData: { topics: [benchTopic] },
    });
    expect(await runNotify(deps)).toBe(1);
    expect(writes).toEqual([]);
    expect(
      urls.filter((u) => u === "https://nlsmdn.com/research/bench/changes/v3/"),
    ).toHaveLength(7);
    expect(sleeps).toEqual([10_000, 10_000, 10_000, 10_000, 10_000, 10_000]);
    expect(lines.at(-1)).toBe(
      "warning: skipped research:bench:v3:2026-11-02, https://nlsmdn.com/research/bench/changes/v3/ is not live",
    );
  });

  test("a draft with the planned name is sent instead of created", async () => {
    const { deps, writes } = setup({
      resendData: {
        broadcasts: [
          { id: "d1", name: "research:bench:v3:2026-11-02", status: "draft" },
        ],
      },
    });
    expect(await runNotify(deps)).toBe(0);
    expect(writes.map((w) => [w.method, w.args])).toEqual([
      ["createTopic", [expect.anything()]],
      ["sendBroadcast", ["d1"]],
    ]);
  });

  test("a failed broadcast exits 1", async () => {
    const { deps, lines } = setup({
      resendData: { failCreateBroadcast: true },
    });
    expect(await runNotify(deps)).toBe(1);
    expect(lines.at(-1)).toBe(
      "failed research:bench:v3:2026-11-02: Resend 422 validation_error",
    );
  });
});

describe("propagationTopics", () => {
  test("adds only the article topics the contact is not opted in to", () => {
    expect(
      propagationTopics(
        [
          { id: ALL, subscription: "opt_in" },
          { id: "t1", subscription: "opt_in" },
        ],
        ALL,
        ["t1", "t2"],
      ),
    ).toEqual([{ id: "t2", subscription: "opt_in" }]);
  });
});

describe("readMetas", () => {
  test("skips an article dir without meta.json with a warning", () => {
    const dir = mkdtempSync(join(tmpdir(), "research-notify-"));
    mkdirSync(join(dir, "kept"));
    writeFileSync(join(dir, "kept", "meta.json"), '{"slug":"kept"}');
    mkdirSync(join(dir, "leftover"));
    writeFileSync(join(dir, "leftover", "v1.md"), "x");
    const lines: string[] = [];
    expect(readMetas(dir, (l) => lines.push(l))).toEqual([
      { slug: "kept" } as unknown as ResearchMeta,
    ]);
    expect(lines).toEqual(["warning: skipped leftover, no meta.json"]);
  });
});

describe("readEnv", () => {
  test("DRY_RUN=1 or --dry-run selects a dry run", () => {
    expect(readEnv({ DRY_RUN: "1" }, []).dryRun).toBe(true);
    expect(readEnv({}, ["--dry-run"]).dryRun).toBe(true);
    expect(readEnv({ DRY_RUN: "" }, []).dryRun).toBe(false);
  });
});

describe("describeError", () => {
  test("redacts addresses from error messages", () => {
    expect(
      describeError(new Error("PATCH /contacts/a%40example.com/topics failed")),
    ).toBe("PATCH /contacts/<email>/topics failed");
  });
});
