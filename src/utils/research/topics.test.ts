import { describe, expect, test } from "bun:test";
import type { ResendClient } from "./resend";
import { ensureArticleTopics, matchArticleTopics } from "./topics";

describe("matchArticleTopics", () => {
  test("finds topics by description and reports missing and renamed ones", () => {
    const result = matchArticleTopics(
      [
        { slug: "kept", title: "Kept title" },
        { slug: "retitled", title: "New title" },
        { slug: "absent", title: "Absent" },
      ],
      [
        {
          id: "t1",
          name: "Kept title",
          description: "nlsmdn.com/research/kept",
        },
        {
          id: "t2",
          name: "Old title",
          description: "nlsmdn.com/research/retitled",
        },
        { id: "t3", name: "Absent", description: "something else" },
      ],
    );
    expect(result).toEqual({
      found: { kept: "t1", retitled: "t2" },
      missing: [{ slug: "absent", title: "Absent" }],
      renamed: ["retitled"],
    });
  });

  test("of topics sharing a description, the earliest created wins, then the lowest id", () => {
    const description = "nlsmdn.com/research/dup";
    const pick = (topics: Parameters<typeof matchArticleTopics>[1]) =>
      matchArticleTopics([{ slug: "dup", title: "Dup" }], topics).found.dup;
    expect(
      pick([
        {
          id: "a",
          name: "Dup",
          description,
          createdAt: "2026-11-21T10:00:00Z",
        },
        {
          id: "b",
          name: "Dup",
          description,
          createdAt: "2026-11-20T10:00:00Z",
        },
      ]),
    ).toBe("b");
    expect(
      pick([
        { id: "t9", name: "Dup", description },
        { id: "t2", name: "Dup", description },
      ]),
    ).toBe("t2");
  });
});

describe("ensureArticleTopics", () => {
  test("after creating a topic, returns the earliest one when a concurrent duplicate exists", async () => {
    const description = "nlsmdn.com/research/race";
    let listed = 0;
    const resend = {
      listTopics: async () =>
        listed++ === 0
          ? []
          : [
              {
                id: "mine",
                name: "Race",
                description,
                createdAt: "2026-11-21T10:00:01Z",
              },
              {
                id: "theirs",
                name: "Race",
                description,
                createdAt: "2026-11-21T10:00:00Z",
              },
            ],
      createTopic: async () => ({ id: "mine" }),
    } as unknown as ResendClient;
    expect(
      await ensureArticleTopics(resend, [{ slug: "race", title: "Race" }]),
    ).toEqual({ race: "theirs" });
  });
});
