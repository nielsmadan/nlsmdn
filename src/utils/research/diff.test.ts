import { describe, expect, test } from "bun:test";
import {
  collapseUnchanged,
  type DiffBlock,
  diffDocuments,
  displayUrl,
  inlineText,
  splitBlocks,
} from "./diff";

const doc = `Intro paragraph with **bold** and *emphasis*.

## Methods

| Method | Days |
| --- | --- |
| Fridge | 10 |

- First bullet
- Second bullet

\`\`\`sh
echo hi

echo there
\`\`\`
`;

const same = (text: string): DiffBlock => ({
  kind: "same",
  level: "text",
  segments: [{ op: "eq", text }],
});

describe("splitBlocks", () => {
  test("splits headings, paragraphs, rows, list items and fenced code", () => {
    expect(splitBlocks(doc)).toEqual([
      {
        level: "text",
        text: "Intro paragraph with bold and emphasis.",
        urls: [],
      },
      { level: "heading", text: "Methods", urls: [] },
      { level: "row", text: "Method | Days", urls: [] },
      { level: "row", text: "Fridge | 10", urls: [] },
      { level: "text", text: "• First bullet", urls: [] },
      { level: "text", text: "• Second bullet", urls: [] },
      { level: "code", text: "echo hi\n\necho there", urls: [] },
    ]);
  });

  test("joins paragraph lines and list continuation lines", () => {
    expect(splitBlocks("one\ntwo\n\n1. item\n   more")).toEqual([
      { level: "text", text: "one two", urls: [] },
      { level: "text", text: "1. item more", urls: [] },
    ]);
  });
});

describe("inlineText", () => {
  test("strips emphasis and code markers", () => {
    expect(inlineText("**a** __b__ *c* _d_ ~~e~~ `f*g*`").text).toBe(
      "a b c d e f*g*",
    );
  });

  test("keeps snake_case words intact", () => {
    expect(inlineText("use snake_case_name here").text).toBe(
      "use snake_case_name here",
    );
  });

  test("renders links as their text and collects their URLs", () => {
    expect(inlineText("See [the guide](https://example.com/a) now")).toEqual({
      text: "See the guide now",
      urls: ["https://example.com/a"],
    });
  });
});

describe("diffDocuments", () => {
  test("identical input gives only same blocks", () => {
    const blocks = diffDocuments(doc, doc);
    expect(blocks).toHaveLength(7);
    expect(blocks.every((b) => b.kind === "same")).toBe(true);
  });

  test("one changed word gives one changed block with the exact words", () => {
    const blocks = diffDocuments(
      "The starter needs two feedings.",
      "The starter needs three feedings.",
    );
    expect(blocks).toEqual([
      {
        kind: "changed",
        level: "text",
        segments: [
          { op: "eq", text: "The starter needs " },
          { op: "del", text: "two" },
          { op: "ins", text: "three" },
          { op: "eq", text: " feedings." },
        ],
      },
    ]);
  });

  test("an added table row gives an added row", () => {
    const blocks = diffDocuments(
      "| A | B |\n| --- | --- |\n| x | 1 |",
      "| A | B |\n| --- | --- |\n| x | 1 |\n| y | 2 |",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["same", "same", "added"]);
    expect(blocks[2]).toEqual({
      kind: "added",
      level: "row",
      segments: [{ op: "ins", text: "y | 2" }],
    });
  });

  test("a removed list item gives a removed block", () => {
    const blocks = diffDocuments(
      "- grey liquid means hungry\n- acetone smell fades\n\n## Sources",
      "- grey liquid means hungry\n\n## Sources",
    );
    expect(blocks).toEqual([
      same("• grey liquid means hungry"),
      {
        kind: "removed",
        level: "text",
        segments: [{ op: "del", text: "• acetone smell fades" }],
      },
      {
        kind: "same",
        level: "heading",
        segments: [{ op: "eq", text: "Sources" }],
      },
    ]);
  });

  test("a link URL-only change gives changed with URL segments", () => {
    const blocks = diffDocuments(
      "The [drying guide](https://example.com/lab/drying) explains it.",
      "The [drying guide](https://example.com/lab/drying-v2) explains it.",
    );
    expect(blocks).toEqual([
      {
        kind: "changed",
        level: "text",
        segments: [
          { op: "eq", text: "The drying guide explains it." },
          { op: "del", text: "example.com/lab/drying", url: true },
          { op: "ins", text: "example.com/lab/drying-v2", url: true },
        ],
      },
    ]);
  });

  test("an emphasis-only change compares equal", () => {
    expect(diffDocuments("A *key* point.", "A **key** point.")).toEqual([
      same("A key point."),
    ]);
  });

  test("an unrelated new block next to a removed one stays added", () => {
    const blocks = diffDocuments(
      "- acetone smell fades\n\n## Sources",
      "## Reviving a dried starter\n\n## Sources",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["removed", "added", "same"]);
  });
});

describe("pairing", () => {
  test("same-level blocks below the similarity threshold stay removed and added", () => {
    const blocks = diffDocuments(
      "The starter smells of acetone.\n\n## Sources",
      "Hydration should stay near one hundred percent.\n\n## Sources",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["removed", "added", "same"]);
  });

  test("same-level blocks above the threshold pair as changed", () => {
    const blocks = diffDocuments(
      "The starter smells of acetone when hungry.\n\n## Sources",
      "The starter smells of vinegar when hungry.\n\n## Sources",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["changed", "same"]);
  });

  test("blocks of different levels never pair even when similar", () => {
    const blocks = diffDocuments(
      "| starter smells of acetone |",
      "starter smells of acetone",
    );
    expect(blocks.map((b) => b.kind)).toEqual(["removed", "added"]);
  });

  test("a huge replaced run skips pairing", () => {
    const lines = (word: string) =>
      Array.from({ length: 60 }, (_, i) => `${word} shared words line ${i}`);
    const blocks = diffDocuments(
      lines("old").join("\n\n"),
      lines("new").join("\n\n"),
    );
    expect(blocks.filter((b) => b.kind === "changed")).toEqual([]);
    expect(blocks).toHaveLength(120);
  });
});

describe("inline markdown", () => {
  test("code spans stay literal and are not parsed as links", () => {
    expect(inlineText("use `[x](y)` literally")).toEqual({
      text: "use [x](y) literally",
      urls: [],
    });
  });

  test("a nested-bracket label keeps its text and extracts the URL", () => {
    expect(inlineText("See [[1]](https://x.com/a)")).toEqual({
      text: "See [1]",
      urls: ["https://x.com/a"],
    });
  });

  test("a linked image reduces to its alt text", () => {
    expect(
      inlineText("[![badge](https://img.com/b.svg)](https://site.com/)"),
    ).toEqual({
      text: "badge",
      urls: ["https://site.com/", "https://img.com/b.svg"],
    });
  });

  test("reference links reduce to their label and definitions are dropped", () => {
    expect(inlineText("read [docs][d] now").text).toBe("read docs now");
    expect(
      splitBlocks("[d]: https://x.com\n\ntext").map((b) => b.text),
    ).toEqual(["text"]);
  });

  test("HTML entities are decoded", () => {
    expect(inlineText("R&amp;D &lt;3 &#39;x&#x27;").text).toBe("R&D <3 'x'");
  });
});

describe("displayUrl", () => {
  test("keeps host and path", () => {
    expect(displayUrl("https://example.com/a/b?x=1#y")).toBe("example.com/a/b");
  });

  test("shows the full URL when only the query differs", () => {
    const blocks = diffDocuments(
      "[a](https://e.com/p?v=1)",
      "[a](https://e.com/p?v=2)",
    );
    expect(blocks[0].segments.filter((s) => s.url)).toEqual([
      { op: "del", text: "https://e.com/p?v=1", url: true },
      { op: "ins", text: "https://e.com/p?v=2", url: true },
    ]);
  });
});

describe("collapseUnchanged", () => {
  const changed: DiffBlock = {
    kind: "changed",
    level: "text",
    segments: [{ op: "ins", text: "x" }],
  };
  const sames = (n: number) =>
    Array.from({ length: n }, (_, i) => same(`s${i}`));

  test("keeps a run of 2 x context + 1 between changes", () => {
    const blocks = [changed, ...sames(3), changed];
    expect(collapseUnchanged(blocks)).toEqual(blocks);
  });

  test("collapses the middle of a longer run, keeping context on both sides", () => {
    const run = sames(4);
    expect(collapseUnchanged([changed, ...run, changed])).toEqual([
      changed,
      run[0],
      { kind: "collapsed", count: 2, blocks: [run[1], run[2]] },
      run[3],
      changed,
    ]);
  });

  test("leading and trailing runs keep context only next to the change", () => {
    const lead = sames(4);
    const trail = sames(4);
    expect(collapseUnchanged([...lead, changed, ...trail])).toEqual([
      { kind: "collapsed", count: 3, blocks: lead.slice(0, 3) },
      lead[3],
      changed,
      trail[0],
      { kind: "collapsed", count: 3, blocks: trail.slice(1) },
    ]);
  });

  test("a wider context raises the threshold", () => {
    const blocks = [changed, ...sames(5), changed];
    expect(collapseUnchanged(blocks, 2)).toEqual(blocks);
  });
});
