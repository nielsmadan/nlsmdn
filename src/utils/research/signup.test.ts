import { describe, expect, test } from "bun:test";
import { type ResendClient, ResendError } from "./resend";
import {
  COOLDOWN_COOKIE,
  confirmationIdempotencyKey,
  cooldownValue,
  handleConfirm,
  handleSubscribe,
  type SignupConfig,
} from "./signup";
import { openToken, sealToken } from "./token";

const secret = btoa(String.fromCharCode(...new Uint8Array(32).fill(3)));
const NOW = 1_800_000_000;

const config: SignupConfig = {
  resendApiKey: "re_test",
  tokenSecret: secret,
  turnstileSecret: "ts",
  segmentId: "seg",
  allTopicId: "all-topic",
  blogTopicId: "blog-topic",
  from: "Niels Madan <research@nlsmdn.com>",
  siteUrl: "https://nlsmdn.com/",
  consentTextVersion: "2026-11-21",
};

const articles = [
  { slug: "coding-benchmarks", title: "Coding benchmarks" },
  { slug: "other", title: "Other note" },
];

type Recorded = { method: string; args: unknown[] };

type Contact = Awaited<ReturnType<ResendClient["getContact"]>>;

const stubResend = (state: {
  contact?: Contact;
  contactAfterCreate?: Contact;
  contactTopics?: { id: string; subscription: "opt_in" | "opt_out" }[];
  topics?: { id: string; name: string; description: string }[];
  failSend?: boolean;
  createError?: Error;
  segmentError?: Error;
}) => {
  const calls: Recorded[] = [];
  const record =
    <T>(method: string, result: T) =>
    async (...args: unknown[]) => {
      calls.push({ method, args });
      return result;
    };
  const failing =
    (method: string, err: Error | undefined) =>
    async (...args: unknown[]) => {
      calls.push({ method, args });
      if (err) throw err;
    };
  let created = false;
  const client: ResendClient = {
    sendEmail: async (...args) => {
      calls.push({ method: "sendEmail", args });
      if (state.failSend) throw new Error("boom");
    },
    getContact: async (...args) => {
      calls.push({ method: "getContact", args });
      return (created ? state.contactAfterCreate : state.contact) ?? null;
    },
    createContact: async (...args) => {
      calls.push({ method: "createContact", args });
      created = true;
      if (state.createError) throw state.createError;
      return { id: "new" };
    },
    updateContact: record("updateContact", undefined),
    addToSegment: failing("addToSegment", state.segmentError),
    listContactTopics: record("listContactTopics", state.contactTopics ?? []),
    updateContactTopics: record("updateContactTopics", undefined),
    listSegmentContacts: record("listSegmentContacts", []),
    listTopics: record("listTopics", state.topics ?? []),
    createTopic: record("createTopic", { id: "created-topic" }),
    updateTopic: record("updateTopic", undefined),
    listBroadcasts: record("listBroadcasts", []),
    createBroadcast: record("createBroadcast", { id: "b" }),
    sendBroadcast: record("sendBroadcast", undefined),
  };
  return { client, calls };
};

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

const validForm = {
  email: "reader@example.com",
  scope: "coding-benchmarks",
  "cf-turnstile-response": "turnstile-token",
};

const subscribeDeps = (
  over: Partial<Parameters<typeof handleSubscribe>[1]> = {},
) => {
  const { client, calls } = stubResend({});
  return {
    calls,
    deps: {
      config,
      articles,
      resend: client,
      verifyTurnstile: async () => true,
      cooldownCookie: undefined,
      ip: "1.2.3.4",
      nowSeconds: NOW,
      log: () => {},
      ...over,
    },
  };
};

describe("handleSubscribe", () => {
  test("returns 400 for an invalid email", async () => {
    const { deps, calls } = subscribeDeps();
    const res = await handleSubscribe(
      form({ ...validForm, email: "nope" }),
      deps,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Please enter a valid email address.");
    expect(calls).toHaveLength(0);
  });

  test("returns 400 for an unknown scope", async () => {
    const { deps } = subscribeDeps();
    const res = await handleSubscribe(
      form({ ...validForm, scope: "nope" }),
      deps,
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 when Turnstile fails", async () => {
    const { deps, calls } = subscribeDeps({
      verifyTurnstile: async () => false,
    });
    const res = await handleSubscribe(form(validForm), deps);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("The spam check failed. Please try again.");
    expect(calls).toHaveLength(0);
  });

  test("returns 503 when a secret or topic id is missing", async () => {
    for (const missing of [
      { resendApiKey: undefined },
      { tokenSecret: "" },
      { turnstileSecret: undefined },
      { blogTopicId: "" },
    ]) {
      const { deps } = subscribeDeps({ config: { ...config, ...missing } });
      const res = await handleSubscribe(form(validForm), deps);
      expect(res).toEqual({
        status: 503,
        body: { error: "Sign-up is not configured yet." },
      });
    }
  });

  test("sends one confirmation email with a working token and sets the cooldown cookie", async () => {
    const { deps, calls } = subscribeDeps();
    const res = await handleSubscribe(form(validForm), deps);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Check your inbox to confirm.");
    expect(res.setCookie).toMatch(
      new RegExp(
        `^${COOLDOWN_COOKIE}=${NOW}\\.[0-9a-f]{64}; Path=/api/research; Max-Age=600; HttpOnly; Secure; SameSite=Lax$`,
      ),
    );
    expect(calls).toHaveLength(1);
    const mail = calls[0].args[0] as Record<string, string>;
    expect(mail.to).toBe("reader@example.com");
    expect(mail.from).toBe(config.from);
    expect(mail.subject).toBe("Confirm your subscription to nlsmdn research");
    expect(mail.idempotencyKey).toBe(
      await confirmationIdempotencyKey("reader@example.com", NOW),
    );
    expect(mail.text).toContain('the research note "Coding benchmarks"');
    const token = mail.text.match(/research\/confirm\?t=([A-Za-z0-9_-]+)/)?.[1];
    expect(mail.html).toContain(
      `https://nlsmdn.com/research/confirm?t=${token}`,
    );
    expect(await openToken(token as string, secret, NOW)).toEqual({
      e: "reader@example.com",
      s: "coding-benchmarks",
      r: NOW,
      x: NOW + 48 * 3600,
    });
  });

  test("returns 200 without sending when the cooldown cookie matches", async () => {
    const cookie = await cooldownValue(
      "Reader@example.com",
      "coding-benchmarks",
      NOW - 60,
      secret,
    );
    const { deps, calls } = subscribeDeps({ cooldownCookie: cookie });
    const res = await handleSubscribe(form(validForm), deps);
    expect(res).toEqual({
      status: 200,
      body: { message: "Check your inbox to confirm." },
    });
    expect(calls).toHaveLength(0);
  });

  test("sends again when the cooldown cookie is for another address", async () => {
    const cookie = await cooldownValue(
      "someone@example.com",
      "coding-benchmarks",
      NOW - 60,
      secret,
    );
    const { deps, calls } = subscribeDeps({ cooldownCookie: cookie });
    await handleSubscribe(form(validForm), deps);
    expect(calls.map((c) => c.method)).toEqual(["sendEmail"]);
  });

  test("sends again when the cooldown cookie is for another scope", async () => {
    const cookie = await cooldownValue(
      "reader@example.com",
      "all",
      NOW - 60,
      secret,
    );
    const { deps, calls } = subscribeDeps({ cooldownCookie: cookie });
    await handleSubscribe(form(validForm), deps);
    expect(calls.map((c) => c.method)).toEqual(["sendEmail"]);
  });

  test("sends again once the cooldown cookie has expired or is from the future", async () => {
    for (const time of [NOW - 600, NOW + 60]) {
      const cookie = await cooldownValue(
        "reader@example.com",
        "coding-benchmarks",
        time,
        secret,
      );
      const { deps, calls } = subscribeDeps({ cooldownCookie: cookie });
      const res = await handleSubscribe(form(validForm), deps);
      expect(res.setCookie).toContain(`${COOLDOWN_COOKIE}=${NOW}.`);
      expect(calls.map((c) => c.method)).toEqual(["sendEmail"]);
    }
  });

  test("works with a 48-byte secret and treats a 16-byte one as unconfigured", async () => {
    const longSecret = btoa(String.fromCharCode(...new Uint8Array(48).fill(5)));
    const longConfig = { ...config, tokenSecret: longSecret };
    const first = subscribeDeps({ config: longConfig });
    const res = await handleSubscribe(form(validForm), first.deps);
    expect(res.status).toBe(200);
    const mail = first.calls[0].args[0] as Record<string, string>;
    const t = mail.text.match(/confirm\?t=([A-Za-z0-9_-]+)/)?.[1] as string;
    expect((await openToken(t, longSecret, NOW))?.e).toBe("reader@example.com");
    const cookie = res.setCookie?.split(";")[0].split("=")[1];
    const again = subscribeDeps({ config: longConfig, cooldownCookie: cookie });
    await handleSubscribe(form(validForm), again.deps);
    expect(again.calls).toHaveLength(0);

    const shortSecret = btoa(
      String.fromCharCode(...new Uint8Array(16).fill(5)),
    );
    const short = subscribeDeps({
      config: { ...config, tokenSecret: shortSecret },
    });
    expect((await handleSubscribe(form(validForm), short.deps)).status).toBe(
      503,
    );
  });

  test("returns 500 when sending fails", async () => {
    const { client } = stubResend({ failSend: true });
    const { deps } = subscribeDeps({ resend: client });
    const res = await handleSubscribe(form(validForm), deps);
    expect(res.status).toBe(500);
    expect(res.setCookie).toBeUndefined();
  });
});

const token = (scope: string, x = NOW + 3600) =>
  sealToken({ e: "reader@example.com", s: scope, r: NOW - 600, x }, secret);

describe("handleConfirm", () => {
  test("creates a new contact with the plan and the consent properties", async () => {
    const { client, calls } = stubResend({
      topics: [
        {
          id: "cb-topic",
          name: "Coding benchmarks",
          description: "nlsmdn.com/research/coding-benchmarks",
        },
      ],
    });
    const res = await handleConfirm(await token("all"), {
      config,
      articles,
      resend: client,
      nowSeconds: NOW,
      log: () => {},
    });
    expect(res).toEqual({
      status: 303,
      location: "/research/subscribed?scope=all",
    });
    expect(calls.map((c) => c.method)).toEqual([
      "getContact",
      "listTopics",
      "createTopic",
      "listTopics",
      "createContact",
    ]);
    expect(calls[2].args[0]).toEqual({
      name: "Other note",
      description: "nlsmdn.com/research/other",
      default_subscription: "opt_out",
      visibility: "public",
    });
    expect(calls.find((c) => c.method === "createContact")?.args[0]).toEqual({
      email: "reader@example.com",
      unsubscribed: false,
      segments: ["seg"],
      topics: [
        { id: "all-topic", subscription: "opt_in" },
        { id: "cb-topic", subscription: "opt_in" },
        { id: "created-topic", subscription: "opt_in" },
        { id: "blog-topic", subscription: "opt_out" },
      ],
      properties: {
        research_consent_at: new Date(NOW * 1000).toISOString(),
        research_consent_scope: "all",
        research_consent_requested_at: new Date(
          (NOW - 600) * 1000,
        ).toISOString(),
        research_consent_text: "2026-11-21",
      },
    });
  });

  test("updates an existing newsletter contact and extends its consent scope", async () => {
    const { client, calls } = stubResend({
      contact: {
        id: "c1",
        unsubscribed: false,
        properties: { research_consent_scope: "other" },
      },
      contactTopics: [{ id: "blog-topic", subscription: "opt_in" }],
      topics: [
        {
          id: "cb-topic",
          name: "Coding benchmarks",
          description: "nlsmdn.com/research/coding-benchmarks",
        },
      ],
    });
    const res = await handleConfirm(await token("coding-benchmarks"), {
      config,
      articles,
      resend: client,
      nowSeconds: NOW,
      log: () => {},
    });
    expect(res.location).toBe("/research/subscribed?scope=coding-benchmarks");
    expect(calls.map((c) => c.method)).toEqual([
      "getContact",
      "listContactTopics",
      "listTopics",
      "addToSegment",
      "updateContactTopics",
      "updateContact",
    ]);
    expect(calls[3].args).toEqual(["reader@example.com", "seg"]);
    expect(calls[4].args).toEqual([
      "reader@example.com",
      [{ id: "cb-topic", subscription: "opt_in" }],
    ]);
    expect(calls[5].args).toEqual([
      "reader@example.com",
      {
        properties: {
          research_consent_at: new Date(NOW * 1000).toISOString(),
          research_consent_scope: "other,coding-benchmarks",
          research_consent_requested_at: new Date(
            (NOW - 600) * 1000,
          ).toISOString(),
          research_consent_text: "2026-11-21",
        },
      },
    ]);
  });

  test("redirects to the error page for an invalid or expired token", async () => {
    const { client, calls } = stubResend({});
    const deps = { config, articles, resend: client, nowSeconds: NOW };
    expect(await handleConfirm("garbage", deps)).toEqual({
      status: 303,
      location: "/research/confirm?error=1",
    });
    expect(await handleConfirm(await token("all", NOW - 1), deps)).toEqual({
      status: 303,
      location: "/research/confirm?error=1",
    });
    expect(calls).toHaveLength(0);
  });

  test("returns 503 when unconfigured", async () => {
    const { client } = stubResend({});
    const res = await handleConfirm(await token("all"), {
      config: { ...config, resendApiKey: undefined },
      articles,
      resend: client,
      nowSeconds: NOW,
    });
    expect(res.status).toBe(503);
  });

  const consent = (scopeList: string) => ({
    research_consent_at: new Date(NOW * 1000).toISOString(),
    research_consent_scope: scopeList,
    research_consent_requested_at: new Date((NOW - 600) * 1000).toISOString(),
    research_consent_text: "2026-11-21",
  });

  const cbTopic = {
    id: "cb-topic",
    name: "Coding benchmarks",
    description: "nlsmdn.com/research/coding-benchmarks",
  };

  const confirmWith = async (
    state: Parameters<typeof stubResend>[0],
    scope = "coding-benchmarks",
  ) => {
    const { client, calls } = stubResend(state);
    const res = await handleConfirm(await token(scope), {
      config,
      articles,
      resend: client,
      nowSeconds: NOW,
      log: () => {},
    });
    return { res, calls };
  };

  test("resubscribes a globally unsubscribed contact, opting out of Blog posts before flipping unsubscribed", async () => {
    const { res, calls } = await confirmWith({
      contact: { id: "c1", unsubscribed: true, properties: {} },
      contactTopics: [{ id: "blog-topic", subscription: "opt_in" }],
      topics: [cbTopic],
    });
    expect(res.location).toBe("/research/subscribed?scope=coding-benchmarks");
    expect(calls.slice(3)).toEqual([
      { method: "addToSegment", args: ["reader@example.com", "seg"] },
      {
        method: "updateContactTopics",
        args: [
          "reader@example.com",
          [
            { id: "cb-topic", subscription: "opt_in" },
            { id: "blog-topic", subscription: "opt_out" },
          ],
        ],
      },
      {
        method: "updateContact",
        args: [
          "reader@example.com",
          { unsubscribed: false, properties: consent("coding-benchmarks") },
        ],
      },
    ]);
  });

  test("redirects to the error page for a token whose article was removed", async () => {
    const { client, calls } = stubResend({});
    const res = await handleConfirm(await token("removed-note"), {
      config,
      articles,
      resend: client,
      nowSeconds: NOW,
    });
    expect(res).toEqual({ status: 303, location: "/research/confirm?error=1" });
    expect(calls).toHaveLength(0);
  });

  for (const [label, createError] of [
    ["a 409", new ResendError(409, "conflict", "POST", "/contacts")],
    [
      "a 422 saying the contact exists",
      new ResendError(
        422,
        "validation_error",
        "POST",
        "/contacts",
        "Contact already exists",
      ),
    ],
  ] as const) {
    test(`falls back to updating the contact when create returns ${label}`, async () => {
      const { res, calls } = await confirmWith({
        createError,
        contactAfterCreate: { id: "c1", unsubscribed: false, properties: {} },
        contactTopics: [{ id: "blog-topic", subscription: "opt_in" }],
        topics: [cbTopic],
      });
      expect(res.location).toBe("/research/subscribed?scope=coding-benchmarks");
      expect(calls.map((c) => c.method)).toEqual([
        "getContact",
        "listTopics",
        "createContact",
        "getContact",
        "listContactTopics",
        "addToSegment",
        "updateContactTopics",
        "updateContact",
      ]);
      expect(calls[6].args).toEqual([
        "reader@example.com",
        [{ id: "cb-topic", subscription: "opt_in" }],
      ]);
      expect(calls[7].args).toEqual([
        "reader@example.com",
        { properties: consent("coding-benchmarks") },
      ]);
    });
  }

  test("shows the error page when create fails for another reason", async () => {
    const { res, calls } = await confirmWith({
      createError: new ResendError(
        422,
        "validation_error",
        "POST",
        "/contacts",
        "Invalid property",
      ),
      topics: [cbTopic],
    });
    expect(res.location).toBe("/research/confirm?error=1");
    expect(calls.map((c) => c.method).at(-1)).toBe("createContact");
  });

  test("treats an already-member segment error as success", async () => {
    const { res, calls } = await confirmWith({
      contact: { id: "c1", unsubscribed: false, properties: {} },
      topics: [cbTopic],
      segmentError: new ResendError(
        400,
        "validation_error",
        "POST",
        "/contacts/x/segments/seg",
        "Contact is already in this segment",
      ),
    });
    expect(res.location).toBe("/research/subscribed?scope=coding-benchmarks");
    expect(calls.map((c) => c.method).slice(-2)).toEqual([
      "updateContactTopics",
      "updateContact",
    ]);
  });

  test("shows the error page for any other segment error", async () => {
    const { res, calls } = await confirmWith({
      contact: { id: "c1", unsubscribed: false, properties: {} },
      topics: [cbTopic],
      segmentError: new ResendError(
        403,
        "restricted_api_key",
        "POST",
        "/contacts/x/segments/seg",
        "This API key is restricted",
      ),
    });
    expect(res.location).toBe("/research/confirm?error=1");
    expect(calls.map((c) => c.method).at(-1)).toBe("addToSegment");
  });
});
