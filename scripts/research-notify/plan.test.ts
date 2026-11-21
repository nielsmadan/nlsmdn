import { describe, expect, test } from "bun:test";
import type { ResearchMeta } from "@/types/research";
import { planBroadcasts, wasAnnounced } from "./plan";

const version = (n: number, date: string, summary = `Summary ${n}.`) => ({
  n,
  date,
  summary,
  pr: n === 1 ? null : 100 + n,
});

const meta = (
  slug: string,
  versions: ResearchMeta["versions"],
): ResearchMeta => ({
  slug,
  title: `Title of ${slug}`,
  description: `About ${slug}.`,
  published: versions[0].date,
  updated: versions.at(-1)?.date ?? versions[0].date,
  lastVerified: versions.at(-1)?.date ?? versions[0].date,
  cursor: "abc",
  minorEdits: [],
  versions,
});

const cfg = { siteUrl: "https://nlsmdn.com/", notifyFrom: "2026-11-01" };
const render = (md: string) => `<p>${md}</p>`;

const threeVersions = meta("bench", [
  version(1, "2026-08-04"),
  version(2, "2026-09-15"),
  version(3, "2026-11-10", "## What changed\n- Fixed a number."),
]);
const fresh = meta("fresh", [version(1, "2026-11-20", "First published.")]);

describe("planBroadcasts", () => {
  test("a version after notifyFrom gives one broadcast for the latest version", () => {
    const { send, resendDrafts } = planBroadcasts(
      [threeVersions],
      [],
      cfg,
      render,
    );
    expect(resendDrafts).toEqual([]);
    expect(send).toHaveLength(1);
    const [b] = send;
    expect(b.slug).toBe("bench");
    expect(b.n).toBe(3);
    expect(b.name).toBe("research:bench:v3:2026-08-04");
    expect(b.subject).toBe("Updated: Title of bench (version 3)");
    expect(b.topicDescription).toBe("nlsmdn.com/research/bench");
    expect(b.liveUrl).toBe("https://nlsmdn.com/research/bench/changes/v3/");
    expect(b.isFirst).toBe(false);
    expect(b.html).toContain(
      'href="https://nlsmdn.com/research/bench/changes/v3/"',
    );
    expect(b.html).toContain('href="https://nlsmdn.com/research/bench/"');
    expect(b.html).toContain("<p>## What changed\n- Fixed a number.</p>");
    expect(b.text).toContain(
      "See what changed: https://nlsmdn.com/research/bench/changes/v3/",
    );
    expect(b.text).toContain(
      "Read the note: https://nlsmdn.com/research/bench/",
    );
  });

  test("v1 is a first announcement linking the article", () => {
    const [b] = planBroadcasts([fresh], [], cfg, render).send;
    expect(b.isFirst).toBe(true);
    expect(b.subject).toBe("New research: Title of fresh");
    expect(b.name).toBe("research:fresh:v1:2026-11-20");
    expect(b.liveUrl).toBe("https://nlsmdn.com/research/fresh/changes/v1/");
    expect(b.text).toContain(
      "Read the note: https://nlsmdn.com/research/fresh/",
    );
    expect(b.text).toContain("About fresh.");
  });

  test("a latest version before notifyFrom gives nothing", () => {
    const old = meta("old", [version(1, "2026-10-31")]);
    expect(planBroadcasts([old], [], cfg, render).send).toEqual([]);
  });

  test("an empty notifyFrom gives nothing", () => {
    expect(
      planBroadcasts(
        [threeVersions, fresh],
        [],
        { ...cfg, notifyFrom: "" },
        render,
      ),
    ).toEqual({ send: [], resendDrafts: [] });
  });

  test("a sent name is skipped and a draft name is resent", () => {
    const { send, resendDrafts } = planBroadcasts(
      [threeVersions, fresh],
      [
        { id: "b1", name: "research:bench:v3:2026-08-04", status: "sent" },
        { id: "b2", name: "research:fresh:v1:2026-11-20", status: "draft" },
      ],
      cfg,
      render,
    );
    expect(send).toEqual([]);
    expect(resendDrafts).toEqual([
      { id: "b2", name: "research:fresh:v1:2026-11-20" },
    ]);
  });

  test("a republish with a new published date gets a new name", () => {
    const { send } = planBroadcasts(
      [fresh],
      [{ id: "b1", name: "research:fresh:v1:2026-08-01", status: "sent" }],
      cfg,
      render,
    );
    expect(send.map((b) => b.name)).toEqual(["research:fresh:v1:2026-11-20"]);
  });

  test("both bodies carry the unsubscribe placeholder", () => {
    const [b] = planBroadcasts([threeVersions], [], cfg, render).send;
    expect(b.html).toContain('href="{{{RESEND_UNSUBSCRIBE_URL}}}"');
    expect(b.text).toContain("{{{RESEND_UNSUBSCRIBE_URL}}}");
  });

  test("root-relative links in the summary become absolute", () => {
    const linked = meta("linked", [
      version(1, "2026-11-20", "See [overview](/research/overview#costs)."),
    ]);
    const md = (text: string) =>
      text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
    const [b] = planBroadcasts([linked], [], cfg, md).send;
    expect(b.html).toContain(
      '<a href="https://nlsmdn.com/research/overview#costs">overview</a>',
    );
  });

  test("a queued, sending or scheduled name is skipped", () => {
    const { send, resendDrafts } = planBroadcasts(
      [threeVersions, fresh, meta("later", [version(1, "2026-11-21")])],
      [
        { id: "b1", name: "research:bench:v3:2026-08-04", status: "queued" },
        { id: "b2", name: "research:fresh:v1:2026-11-20", status: "sending" },
        { id: "b3", name: "research:later:v1:2026-11-21", status: "scheduled" },
      ],
      cfg,
      render,
    );
    expect({ send, resendDrafts }).toEqual({ send: [], resendDrafts: [] });
  });

  test("a name with both a draft and a sent broadcast is not resent", () => {
    const { send, resendDrafts } = planBroadcasts(
      [fresh],
      [
        { id: "d1", name: "research:fresh:v1:2026-11-20", status: "draft" },
        { id: "b1", name: "research:fresh:v1:2026-11-20", status: "sent" },
      ],
      cfg,
      render,
    );
    expect({ send, resendDrafts }).toEqual({ send: [], resendDrafts: [] });
  });

  test("the title is escaped in the html body", () => {
    const risky = { ...fresh, title: "A <b> & C" };
    const [b] = planBroadcasts([risky], [], cfg, render).send;
    expect(b.html).toContain("A &lt;b&gt; &amp; C");
    expect(b.subject).toBe("New research: A <b> & C");
  });
});

describe("wasAnnounced", () => {
  const article = { slug: "bench", published: "2026-11-02" };

  test("a non-draft broadcast of any version with the same published date counts", () => {
    expect(
      wasAnnounced(article, [
        { name: "research:bench:v1:2026-11-02", status: "sent" },
      ]),
    ).toBe(true);
    expect(
      wasAnnounced(article, [
        { name: "research:bench:v4:2026-11-02", status: "queued" },
      ]),
    ).toBe(true);
  });

  test("drafts, other published dates and other slugs do not count", () => {
    expect(
      wasAnnounced(article, [
        { name: "research:bench:v1:2026-11-02", status: "draft" },
        { name: "research:bench:v1:2026-10-01", status: "sent" },
        { name: "research:bench-2:v1:2026-11-02", status: "sent" },
      ]),
    ).toBe(false);
  });
});
