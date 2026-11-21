import { describe, expect, test } from "bun:test";
import { verifyTurnstile } from "./turnstile";

const stubFetch = (response: Response | Error) => {
  const calls: { url: string; body: string }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
  return { impl, calls };
};

describe("verifyTurnstile", () => {
  test("posts secret, response and remoteip and returns success", async () => {
    const { impl, calls } = stubFetch(Response.json({ success: true }));
    expect(await verifyTurnstile("tok", "sec", "1.2.3.4", impl)).toBe(true);
    expect(calls[0].url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({
      secret: "sec",
      response: "tok",
      remoteip: "1.2.3.4",
    });
  });

  test("returns false when Cloudflare rejects the token", async () => {
    const { impl } = stubFetch(
      Response.json({
        success: false,
        "error-codes": ["invalid-input-response"],
      }),
    );
    expect(await verifyTurnstile("tok", "sec", undefined, impl)).toBe(false);
  });

  test("returns false on a network error", async () => {
    const { impl } = stubFetch(new Error("offline"));
    expect(await verifyTurnstile("tok", "sec", undefined, impl)).toBe(false);
  });

  test("returns false for an empty token without calling Cloudflare", async () => {
    const { impl, calls } = stubFetch(Response.json({ success: true }));
    expect(await verifyTurnstile("", "sec", undefined, impl)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
