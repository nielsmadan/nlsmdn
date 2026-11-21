import { describe, expect, test } from "bun:test";
import type { ResearchMeta } from "@/types/research";
import {
  getPublicText,
  includeResearchSamples,
  researchGlob,
  researchMetaId,
  researchTextId,
  selectArticle,
  sortArticles,
  versionLine,
} from "./articles";

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

const versions = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    n: i + 1,
    date: "2026-01-01",
    summary: "",
    pr: i === 0 ? null : i,
  }));

describe("sortArticles", () => {
  test("orders by updated desc, then title", () => {
    const sorted = sortArticles([
      meta({ slug: "old", title: "Alpha", updated: "2026-03-01" }),
      meta({ slug: "zeta", title: "Zeta", updated: "2026-05-01" }),
      meta({ slug: "beta", title: "Beta", updated: "2026-05-01" }),
    ]);
    expect(sorted.map((m) => m.slug)).toEqual(["beta", "zeta", "old"]);
  });

  test("returns a new array", () => {
    const input = [
      meta({ slug: "x", updated: "2026-01-01" }),
      meta({ slug: "y", updated: "2026-02-01" }),
    ];
    sortArticles(input);
    expect(input.map((m) => m.slug)).toEqual(["x", "y"]);
  });
});

describe("selectArticle and getPublicText", () => {
  const texts = [
    { id: "a/v2" },
    { id: "a/v1" },
    { id: "a/v10" },
    { id: "a/v3" },
    { id: "a/v4" },
    { id: "a/v5" },
    { id: "a/v6" },
    { id: "a/v7" },
    { id: "a/v8" },
    { id: "a/v9" },
    { id: "b/v1" },
  ];

  test("orders versions by n and picks the latest when there is no current", () => {
    const article = selectArticle(meta({ versions: versions(10) }), texts);
    expect(article.versions.map((t) => t.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `a/v${i + 1}`),
    );
    expect(article.current).toBeNull();
    expect(getPublicText(article)).toEqual({ id: "a/v10" });
  });

  test("prefers current over the latest version", () => {
    const article = selectArticle(meta({ versions: versions(2) }), [
      ...texts,
      { id: "a/current" },
    ]);
    expect(article.current).toEqual({ id: "a/current" });
    expect(getPublicText(article)).toEqual({ id: "a/current" });
  });

  test("throws when a version file is missing", () => {
    expect(() =>
      selectArticle(meta({ slug: "b", versions: versions(2) }), texts),
    ).toThrow("Research b: v2.md is missing");
  });
});

describe("sample inclusion", () => {
  test("only RESEARCH_SAMPLES=1 includes samples", () => {
    expect(includeResearchSamples("1")).toBe(true);
    expect(includeResearchSamples(undefined)).toBe(false);
    expect(includeResearchSamples("")).toBe(false);
    expect(includeResearchSamples("0")).toBe(false);
    expect(includeResearchSamples("true")).toBe(false);
  });

  test("glob excludes underscore dirs unless samples are included", () => {
    const matches = (patterns: string[], path: string) =>
      patterns.some((p) => !p.startsWith("!") && new Bun.Glob(p).match(path)) &&
      !patterns.some(
        (p) => p.startsWith("!") && new Bun.Glob(p.slice(1)).match(path),
      );
    const paths = ["coding-benchmarks/meta.json", "_sample/meta.json"];
    expect(
      paths.filter((p) => matches(researchGlob("*/meta.json", false), p)),
    ).toEqual(["coding-benchmarks/meta.json"]);
    expect(
      paths.filter((p) => matches(researchGlob("*/meta.json", true), p)),
    ).toEqual(paths);
  });
});

describe("ids", () => {
  test("text id is dir and file stem, meta id is the dir", () => {
    expect(researchTextId("coding-benchmarks/v2.md")).toBe(
      "coding-benchmarks/v2",
    );
    expect(researchTextId("_sample/current.md")).toBe("_sample/current");
    expect(researchMetaId("coding-benchmarks/meta.json")).toBe(
      "coding-benchmarks",
    );
  });
});

describe("versionLine", () => {
  const sample = meta({
    slug: "s",
    published: "2026-08-04",
    updated: "2026-11-02",
    lastVerified: "2026-11-02",
    versions: versions(3),
  });
  const render = (parts: ReturnType<typeof versionLine>) =>
    parts.map((p) => (p.href ? `[${p.text}](${p.href})` : p.text)).join(" · ");

  test("base line links to the changes page", () => {
    expect(render(versionLine(sample, { hasCurrent: false }))).toBe(
      "Version 3 · Updated 2 Nov, 2026 · [What changed](/research/s/changes/)",
    );
  });

  test("adds last verified only when later than updated", () => {
    expect(
      render(
        versionLine(
          { ...sample, lastVerified: "2026-11-16" },
          { hasCurrent: false },
        ),
      ),
    ).toBe(
      "Version 3 · Updated 2 Nov, 2026 · [What changed](/research/s/changes/) · Last verified 16 Nov, 2026",
    );
  });

  test("adds minor edits linking to the current diff when current exists", () => {
    expect(versionLine(sample, { hasCurrent: true }).at(-1)).toEqual({
      text: "minor edits since version 3",
      href: "/research/s/changes/current/",
    });
  });

  test("first published shows only when asked and past version 1", () => {
    expect(
      versionLine(sample, { hasCurrent: false, showFirstPublished: true }).at(
        -1,
      ),
    ).toEqual({ text: "First published 4 Aug, 2026" });
    const v1 = meta({ slug: "s", versions: versions(1) });
    expect(
      render(versionLine(v1, { hasCurrent: false, showFirstPublished: true })),
    ).toBe(
      "Version 1 · Updated 1 Jan, 2026 · [What changed](/research/s/changes/)",
    );
  });
});
