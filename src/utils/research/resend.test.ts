import { describe, expect, test } from "bun:test";
import {
  createResendClient,
  isAlreadyMember,
  isContactConflict,
  ResendError,
} from "./resend";

type Call = { url: string; method: string; body: unknown; headers: Headers };

const stubFetch = (responses: Response[]) => {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
      headers: new Headers(init.headers),
    });
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    return next;
  }) as unknown as typeof fetch;
  return { impl, calls };
};

const recordSleep = () => {
  const waits: number[] = [];
  const sleep = async (ms: number) => {
    waits.push(ms);
  };
  return { sleep, waits };
};

describe("createResendClient", () => {
  test("retries a 429 after the retry-after delay", async () => {
    const { impl, calls } = stubFetch([
      new Response(JSON.stringify({ name: "rate_limit_exceeded" }), {
        status: 429,
        headers: { "retry-after": "2" },
      }),
      Response.json({ id: "email-1" }),
    ]);
    const { sleep, waits } = recordSleep();
    const client = createResendClient("re_test", impl, sleep);
    await client.sendEmail({
      from: "a@nlsmdn.com",
      to: "b@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
    expect(calls).toHaveLength(2);
    expect(waits).toContain(2000);
    expect(calls[1].url).toBe("https://api.resend.com/emails");
    expect(calls[1].headers.get("authorization")).toBe("Bearer re_test");
    expect(calls[1].headers.get("user-agent")).toBe("nlsmdn-research/1.0");
  });

  test("gives up after three attempts on 5xx", async () => {
    const { impl, calls } = stubFetch([
      new Response("", { status: 502 }),
      new Response("", { status: 503 }),
      new Response("", { status: 500 }),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    const err = await client
      .updateTopic("t1", { name: "X" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResendError);
    expect((err as ResendError).status).toBe(500);
    expect(calls).toHaveLength(3);
  });

  test("sendBroadcast does not retry a 5xx", async () => {
    const { impl, calls } = stubFetch([new Response("", { status: 502 })]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    const err = await client.sendBroadcast("b1").catch((e: unknown) => e);
    expect((err as ResendError).status).toBe(502);
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.resend.com/broadcasts/b1/send",
    ]);
  });

  test("sendBroadcast retries a 429", async () => {
    const { impl, calls } = stubFetch([
      new Response("", { status: 429, headers: { "retry-after": "1" } }),
      Response.json({ id: "b1" }),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    await client.sendBroadcast("b1");
    expect(calls).toHaveLength(2);
  });

  test("updateTopic patches the topic name", async () => {
    const { impl, calls } = stubFetch([Response.json({ id: "t1" })]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    await client.updateTopic("t 1", { name: "New title" });
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe("https://api.resend.com/topics/t%201");
    expect(calls[0].body).toEqual({ name: "New title" });
  });

  test("updateContactTopics sends a bare array", async () => {
    const { impl, calls } = stubFetch([Response.json({ id: "c1" })]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    const topics = [{ id: "t1", subscription: "opt_in" as const }];
    await client.updateContactTopics("a+b@example.com", topics);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].url).toBe(
      "https://api.resend.com/contacts/a%2Bb%40example.com/topics",
    );
    expect(calls[0].body).toEqual(topics);
  });

  test("createContact sends segments as id objects", async () => {
    const { impl, calls } = stubFetch([Response.json({ id: "c1" })]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    expect(
      await client.createContact({ email: "a@example.com", segments: ["s1"] }),
    ).toEqual({ id: "c1" });
    expect(calls[0].body).toEqual({
      email: "a@example.com",
      segments: [{ id: "s1" }],
    });
  });

  test("getContact flattens property values and returns null on 404", async () => {
    const { impl } = stubFetch([
      Response.json({
        id: "c1",
        email: "a@example.com",
        unsubscribed: true,
        properties: {
          research_consent_scope: { value: "all", type: "string" },
        },
      }),
      new Response(JSON.stringify({ name: "not_found" }), { status: 404 }),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    expect(await client.getContact("a@example.com")).toEqual({
      id: "c1",
      unsubscribed: true,
      properties: { research_consent_scope: "all" },
    });
    expect(await client.getContact("missing@example.com")).toBeNull();
  });

  test("listContactTopics pages with limit and after", async () => {
    const { impl, calls } = stubFetch([
      Response.json({
        object: "list",
        has_more: true,
        data: [{ id: "t1", name: "A", subscription: "opt_in" }],
      }),
      Response.json({
        object: "list",
        has_more: false,
        data: [{ id: "t2", name: "B", subscription: "opt_out" }],
      }),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    expect(await client.listContactTopics("a@example.com")).toEqual([
      { id: "t1", subscription: "opt_in" },
      { id: "t2", subscription: "opt_out" },
    ]);
    expect(calls.map((c) => new URL(c.url).search)).toEqual([
      "?limit=100",
      "?limit=100&after=t1",
    ]);
  });

  test("listTopics carries created_at as createdAt", async () => {
    const { impl } = stubFetch([
      Response.json({
        data: [
          {
            id: "t1",
            name: "A",
            description: "d",
            created_at: "2026-11-20 10:00:00.000+00",
          },
          { id: "t2", name: "B", description: null },
        ],
      }),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    expect(await client.listTopics()).toEqual([
      {
        id: "t1",
        name: "A",
        description: "d",
        createdAt: "2026-11-20 10:00:00.000+00",
      },
      { id: "t2", name: "B", description: "" },
    ]);
  });

  test("holds the next request until the 200 ms pacing sleep ends", async () => {
    const { impl, calls } = stubFetch([
      Response.json({ id: "1" }),
      Response.json({ id: "2" }),
    ]);
    const pending: { ms: number; release: () => void }[] = [];
    const sleep = (ms: number) =>
      new Promise<void>((release) => {
        pending.push({ ms, release });
      });
    const client = createResendClient("re_test", impl, sleep);
    await client.sendBroadcast("a");
    const second = client.sendBroadcast("b");
    await Bun.sleep(5);
    expect(calls).toHaveLength(1);
    expect(pending.map((p) => p.ms)).toEqual([200]);
    pending[0].release();
    await second;
    expect(calls).toHaveLength(2);
  });

  test("caps a large retry-after at 10 seconds", async () => {
    const { impl } = stubFetch([
      new Response(JSON.stringify({ name: "daily_quota_exceeded" }), {
        status: 429,
        headers: { "retry-after": "3600" },
      }),
      Response.json({ id: "email-1" }),
    ]);
    const { sleep, waits } = recordSleep();
    const client = createResendClient("re_test", impl, sleep);
    await client.sendBroadcast("b1");
    expect(waits).toContain(10_000);
    expect(Math.max(...waits)).toBe(10_000);
  });

  test("sends the email idempotency key as a header, not in the body", async () => {
    const { impl, calls } = stubFetch([
      new Response("", { status: 502 }),
      Response.json({ id: "email-1" }),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    await client.sendEmail({
      from: "a@nlsmdn.com",
      to: "b@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "t",
      idempotencyKey: "research-confirm/abc/1",
    });
    expect(calls.map((c) => c.headers.get("idempotency-key"))).toEqual([
      "research-confirm/abc/1",
      "research-confirm/abc/1",
    ]);
    expect(calls[1].body).toEqual({
      from: "a@nlsmdn.com",
      to: "b@example.com",
      subject: "s",
      html: "<p>h</p>",
      text: "t",
    });
  });

  test("createBroadcast creates a draft and retries a 5xx", async () => {
    const { impl, calls } = stubFetch([
      new Response("", { status: 503 }),
      Response.json({ id: "b1" }),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    const broadcast = {
      segment_id: "seg",
      topic_id: "t1",
      from: "a@nlsmdn.com",
      subject: "New research: X",
      html: "<p>h</p>",
      text: "t",
      name: "research:x:v1:2026-11-21",
    };
    expect(await client.createBroadcast(broadcast)).toEqual({ id: "b1" });
    expect(calls).toHaveLength(2);
    expect(calls[1].url).toBe("https://api.resend.com/broadcasts");
    expect(calls[1].headers.get("idempotency-key")).toBe(
      "research:x:v1:2026-11-21",
    );
    expect(calls[1].body).toEqual(broadcast);
  });

  test("errors carry the Resend message and classify existing state", async () => {
    const { impl } = stubFetch([
      new Response(
        JSON.stringify({
          name: "validation_error",
          message: "Contact already exists",
        }),
        { status: 422 },
      ),
    ]);
    const client = createResendClient("re_test", impl, recordSleep().sleep);
    const err = await client
      .createContact({ email: "a@example.com" })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResendError);
    expect((err as ResendError).detail).toBe("Contact already exists");
    expect(isContactConflict(err)).toBe(true);
    expect(isAlreadyMember(err)).toBe(true);
    const other = new ResendError(422, "validation_error", "POST", "/x", "bad");
    expect(isContactConflict(other)).toBe(false);
    expect(isAlreadyMember(other)).toBe(false);
    const locked = new ResendError(
      409,
      "resource_locked",
      "POST",
      "/x",
      "Another request is already updating this resource.",
    );
    expect(isContactConflict(locked)).toBe(true);
    expect(isAlreadyMember(locked)).toBe(false);
  });
});
