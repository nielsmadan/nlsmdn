import { describe, expect, test } from "bun:test";
import { handleNewsletterSubscribe, type NewsletterDeps } from "./newsletter";
import { type ResendClient, ResendError } from "./research/resend";

const setup = (
  over: Partial<ResendClient> = {},
  deps: Partial<NewsletterDeps> = {},
) => {
  const calls: [string, ...unknown[]][] = [];
  const record =
    (name: string, result?: unknown) =>
    async (...args: unknown[]) => {
      calls.push([name, ...args]);
      return result;
    };
  const resend = {
    getContact: record("getContact", null),
    createContact: record("createContact", { id: "c1" }),
    addToSegment: record("addToSegment"),
    listContactTopics: record("listContactTopics", []),
    updateContactTopics: record("updateContactTopics"),
    updateContact: record("updateContact"),
    ...over,
  } as unknown as ResendClient;
  return {
    calls,
    deps: {
      apiKey: "key",
      segmentId: "seg",
      blogTopicId: "blog",
      resend,
      log: () => {},
      ...deps,
    },
  };
};

describe("handleNewsletterSubscribe", () => {
  test("creates a new contact with the segment and Blog posts topic", async () => {
    const { calls, deps } = setup();
    const res = await handleNewsletterSubscribe("a@b.co", deps);
    expect(res).toEqual({ status: 200, body: { message: "Subscribed!" } });
    expect(calls).toEqual([
      ["getContact", "a@b.co"],
      [
        "createContact",
        {
          email: "a@b.co",
          segments: ["seg"],
          topics: [{ id: "blog", subscription: "opt_in" }],
        },
      ],
    ]);
  });

  test("adds an existing contact to the segment and opts it in without touching unsubscribed", async () => {
    const { calls, deps } = setup({
      getContact: async () => ({
        id: "c1",
        unsubscribed: true,
        properties: {},
      }),
    });
    const res = await handleNewsletterSubscribe("a@b.co", deps);
    expect(res).toEqual({
      status: 409,
      body: {
        error:
          "This address unsubscribed earlier, so it won't receive emails. Get in touch via the About page to resubscribe.",
      },
    });
    expect(calls).toEqual([
      ["listContactTopics", "a@b.co"],
      ["addToSegment", "a@b.co", "seg"],
      [
        "updateContactTopics",
        "a@b.co",
        [{ id: "blog", subscription: "opt_in" }],
      ],
    ]);
  });

  test("a create conflict falls back to the existing-contact path", async () => {
    const { calls, deps } = setup({
      createContact: async () => {
        throw new ResendError(409, "", "POST", "/contacts", "already exists");
      },
    });
    const res = await handleNewsletterSubscribe("a@b.co", deps);
    expect(res.status).toBe(200);
    expect(calls.map(([name]) => name)).toEqual([
      "getContact",
      "getContact",
      "listContactTopics",
      "addToSegment",
      "updateContactTopics",
    ]);
  });

  test("an invalid email returns 400", async () => {
    const { calls, deps } = setup();
    const res = await handleNewsletterSubscribe("nope", deps);
    expect(res).toEqual({
      status: 400,
      body: { error: "Please enter a valid email address." },
    });
    expect(calls).toEqual([]);
  });

  test("a missing key returns 503", async () => {
    expect(
      await handleNewsletterSubscribe("a@b.co", setup({}, { apiKey: "" }).deps),
    ).toEqual({
      status: 503,
      body: { error: "Sign-up is not configured yet." },
    });
  });

  test("without a blog topic a new contact is created in the segment only", async () => {
    const { calls, deps } = setup({}, { blogTopicId: "" });
    const res = await handleNewsletterSubscribe("a@b.co", deps);
    expect(res).toEqual({ status: 200, body: { message: "Subscribed!" } });
    expect(calls).toEqual([
      ["getContact", "a@b.co"],
      ["createContact", { email: "a@b.co", segments: ["seg"] }],
    ]);
  });

  test("without a blog topic an existing contact is added to the segment only", async () => {
    const { calls, deps } = setup(
      {
        getContact: async () => ({
          id: "c1",
          unsubscribed: false,
          properties: {},
        }),
      },
      { blogTopicId: "" },
    );
    const res = await handleNewsletterSubscribe("a@b.co", deps);
    expect(res).toEqual({ status: 200, body: { message: "Subscribed!" } });
    expect(calls).toEqual([["addToSegment", "a@b.co", "seg"]]);
  });

  test("an explicit Blog posts opt-out is kept and answered with 409", async () => {
    const { calls, deps } = setup({
      getContact: async () => ({
        id: "c1",
        unsubscribed: false,
        properties: {},
      }),
      listContactTopics: async (email: string) => {
        calls.push(["listContactTopics", email]);
        return [{ id: "blog", subscription: "opt_out" as const }];
      },
    });
    const res = await handleNewsletterSubscribe("a@b.co", deps);
    expect(res).toEqual({
      status: 409,
      body: {
        error:
          "This address opted out of blog post emails. Use the preferences link in any nlsmdn email to opt back in.",
      },
    });
    expect(calls).toEqual([["listContactTopics", "a@b.co"]]);
  });

  test("an existing subscribed contact gets the plain success message", async () => {
    const { deps } = setup({
      getContact: async () => ({
        id: "c1",
        unsubscribed: false,
        properties: {},
      }),
    });
    expect(await handleNewsletterSubscribe("a@b.co", deps)).toEqual({
      status: 200,
      body: { message: "Subscribed!" },
    });
  });

  test("an already-member error from addToSegment is swallowed", async () => {
    const { calls, deps } = setup({
      getContact: async () => ({
        id: "c1",
        unsubscribed: false,
        properties: {},
      }),
      addToSegment: async () => {
        throw new ResendError(422, "x", "POST", "/seg", "already exists");
      },
    });
    const res = await handleNewsletterSubscribe("a@b.co", deps);
    expect(res.status).toBe(200);
    expect(calls.map(([name]) => name)).toEqual([
      "listContactTopics",
      "updateContactTopics",
    ]);
  });

  const failing = (over: Partial<ResendClient>) => setup(over).deps;
  const generic = {
    status: 500,
    body: { error: "Something went wrong. Please try again." },
  };

  test("createContact 400 and 422 map to 400", async () => {
    for (const status of [400, 422]) {
      const deps = failing({
        createContact: async () => {
          throw new ResendError(status, "x", "POST", "/contacts");
        },
      });
      expect(await handleNewsletterSubscribe("a@b.co", deps)).toEqual({
        status: 400,
        body: { error: "Please check your email and try again." },
      });
    }
  });

  test("other Resend errors map to 500", async () => {
    for (const status of [401, 403, 404, 429, 503]) {
      const deps = failing({
        getContact: async () => {
          throw new ResendError(status, "x", "GET", "/contacts/a");
        },
      });
      expect(await handleNewsletterSubscribe("a@b.co", deps)).toEqual(generic);
    }
  });

  test("a createContact 5xx maps to 500", async () => {
    const deps = failing({
      createContact: async () => {
        throw new ResendError(500, "x", "POST", "/contacts");
      },
    });
    expect(await handleNewsletterSubscribe("a@b.co", deps)).toEqual(generic);
  });

  test("a network error maps to 500", async () => {
    const deps = failing({
      getContact: async () => {
        throw new TypeError("fetch failed");
      },
    });
    expect(await handleNewsletterSubscribe("a@b.co", deps)).toEqual(generic);
  });
});
