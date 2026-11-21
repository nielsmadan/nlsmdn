import { describe, expect, test } from "bun:test";
import { planConfirmation } from "./subscription";

const ids = {
  allTopicId: "all",
  blogTopicId: "blog",
  articleTopicIds: { a: "topic-a", b: "topic-b" },
};

describe("planConfirmation", () => {
  test("scope all for a new contact opts in to everything research and out of Blog posts", () => {
    const plan = planConfirmation(
      "all",
      { exists: false, unsubscribed: false, topics: [] },
      ids,
      [],
    );
    expect(plan).toEqual({
      create: true,
      setUnsubscribedFalse: true,
      topics: [
        { id: "all", subscription: "opt_in" },
        { id: "topic-a", subscription: "opt_in" },
        { id: "topic-b", subscription: "opt_in" },
        { id: "blog", subscription: "opt_out" },
      ],
      scopes: ["all"],
    });
  });

  test("a slug for a subscribed newsletter contact opts in to that topic only", () => {
    const plan = planConfirmation(
      "b",
      {
        exists: true,
        unsubscribed: false,
        topics: [{ id: "blog", subscription: "opt_in" }],
      },
      ids,
      ["a"],
    );
    expect(plan).toEqual({
      create: false,
      setUnsubscribedFalse: false,
      topics: [{ id: "topic-b", subscription: "opt_in" }],
      scopes: ["a", "b"],
    });
  });

  test("a slug for a globally unsubscribed contact resubscribes without Blog posts", () => {
    const plan = planConfirmation(
      "a",
      {
        exists: true,
        unsubscribed: true,
        topics: [{ id: "blog", subscription: "opt_in" }],
      },
      ids,
      ["a"],
    );
    expect(plan).toEqual({
      create: false,
      setUnsubscribedFalse: true,
      topics: [
        { id: "topic-a", subscription: "opt_in" },
        { id: "blog", subscription: "opt_out" },
      ],
      scopes: ["a"],
    });
  });

  test("leaves out topics already at the wanted subscription", () => {
    const plan = planConfirmation(
      "a",
      {
        exists: true,
        unsubscribed: false,
        topics: [{ id: "topic-a", subscription: "opt_in" }],
      },
      ids,
      [],
    );
    expect(plan.topics).toEqual([]);
  });
});
