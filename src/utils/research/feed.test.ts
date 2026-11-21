import { describe, expect, test } from "bun:test";
import type { ResearchMeta } from "@/types/research";
import { feedItems, markdownToPlainText } from "./feed";

const meta = (over: Partial<ResearchMeta>): ResearchMeta => ({
  slug: "a",
  title: "A",
  description: "",
  published: "2026-01-01",
  updated: "2026-01-01",
  lastVerified: "2026-01-01",
  cursor: "0".repeat(40),
  minorEdits: [],
  versions: [
    { n: 1, date: "2026-01-01", summary: "First published.", pr: null },
  ],
  ...over,
});

describe("feedItems", () => {
  const metas = [
    meta({
      slug: "alpha",
      title: "Alpha",
      versions: [
        { n: 1, date: "2026-03-01", summary: "First published.", pr: null },
        { n: 2, date: "2026-05-10", summary: "Second.", pr: 4 },
        { n: 3, date: "2026-05-10", summary: "Third.", pr: 5 },
      ],
    }),
    meta({
      slug: "beta",
      title: "Beta",
      versions: [
        { n: 1, date: "2026-04-01", summary: "First published.", pr: null },
        { n: 2, date: "2026-05-10", summary: "Beta two.", pr: 7 },
      ],
    }),
  ];

  test("one item per version, newest first, ties by title then version", () => {
    expect(feedItems(metas).map((i) => i.title)).toEqual([
      "Alpha (version 3)",
      "Alpha (version 2)",
      "Beta (version 2)",
      "Beta (version 1)",
      "Alpha (version 1)",
    ]);
  });

  test("v1 links to the article, later versions to their changes page", () => {
    const links = Object.fromEntries(
      feedItems(metas).map((i) => [i.title, i.link]),
    );
    expect(links["Alpha (version 1)"]).toBe("/research/alpha/");
    expect(links["Beta (version 2)"]).toBe("/research/beta/changes/v2/");
  });

  test("pubDate is the version date at UTC midnight", () => {
    const [first] = feedItems(metas);
    expect(first.pubDate.toISOString()).toBe("2026-05-10T00:00:00.000Z");
  });

  test("description is the summary as plain text", () => {
    const [item] = feedItems([
      meta({
        versions: [
          {
            n: 1,
            date: "2026-01-01",
            summary:
              "## Findings revised\n- Recovery takes **2 to 3** feedings ([survey](https://example.org/s)).\n\n\n\n## Not verified\n* none",
            pr: null,
          },
        ],
      }),
    ]);
    expect(item.description).toBe(
      "Findings revised\n- Recovery takes 2 to 3 feedings (survey).\n\nNot verified\n- none",
    );
  });
});

describe("markdownToPlainText", () => {
  test("strips emphasis, code and images, keeps snake_case words", () => {
    expect(
      markdownToPlainText(
        "Use *only* `bun test` with __care__ ![chart](c.png) on snake_case_name",
      ),
    ).toBe("Use only bun test with care chart on snake_case_name");
  });

  test("keeps parentheses inside link URLs", () => {
    expect(
      markdownToPlainText(
        "See [the paper](https://en.wikipedia.org/wiki/Elo_(rating)) now",
      ),
    ).toBe("See the paper now");
  });

  test("keeps dunder names", () => {
    expect(markdownToPlainText("Edit __init__.py")).toBe("Edit __init__.py");
  });
});
