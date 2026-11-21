import { describe, expect, test } from "bun:test";
import { renderResearchMarkdown } from "./markdown";

describe("renderResearchMarkdown", () => {
  test("renders markdown summaries with links and lists", async () => {
    expect(
      await renderResearchMarkdown(
        "- changed [the table](/research/x#scores)\n- see <https://example.com>",
      ),
    ).toBe(
      '<ul>\n<li>changed <a href="/research/x#scores">the table</a></li>\n<li>see <a href="https://example.com">https://example.com</a></li>\n</ul>',
    );
  });

  test("drops raw HTML and images", async () => {
    const html = await renderResearchMarkdown(
      [
        'Refresh <img src="https://t.example/p.gif" onerror="alert(1)"> done',
        "",
        "<script>alert(2)</script>",
        "",
        '<iframe src="https://evil.example"></iframe>',
        "",
        "<style>body{display:none}</style>",
        "",
        "![pixel](https://t.example/p.gif) kept text",
      ].join("\n"),
    );
    expect(html).toBe("<p>Refresh  done</p>\n<p> kept text</p>");
  });

  test("removes javascript: and other non-web link targets", async () => {
    expect(
      await renderResearchMarkdown(
        "[a](javascript:alert(1)) [b](JAVASCRIPT:x) [c](data:text/html,x) [d](mailto:a@b.co)",
      ),
    ).toBe('<p><a>a</a> <a>b</a> <a>c</a> <a href="mailto:a@b.co">d</a></p>');
  });
});
