import { describe, expect, test } from "bun:test";
import {
  isUsableSecret,
  openToken,
  sealToken,
  type TokenPayload,
} from "./token";

const secretOf = (bytes: number, fill = 7) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes).fill(fill)));
const secret = secretOf(32);
const otherSecret = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
const payload: TokenPayload = {
  e: "reader@example.com",
  s: "coding-benchmarks",
  r: 1_000,
  x: 1_000 + 48 * 3600,
};

describe("token", () => {
  test("round trips a payload before expiry", async () => {
    const token = await sealToken(payload, secret);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await openToken(token, secret, 2_000)).toEqual(payload);
  });

  test("returns null once expired", async () => {
    const token = await sealToken(payload, secret);
    expect(await openToken(token, secret, payload.x)).toBeNull();
  });

  test("returns null for tampered ciphertext", async () => {
    const token = await sealToken(payload, secret);
    const last = token.at(-2) === "A" ? "B" : "A";
    const tampered = `${token.slice(0, -2)}${last}${token.at(-1)}`;
    expect(await openToken(tampered, secret, 2_000)).toBeNull();
  });

  test("returns null for a different key", async () => {
    const token = await sealToken(payload, secret);
    expect(await openToken(token, otherSecret, 2_000)).toBeNull();
  });

  test("accepts secrets longer than 32 bytes", async () => {
    for (const bytes of [33, 48, 64]) {
      const longSecret = secretOf(bytes);
      const token = await sealToken(payload, longSecret);
      expect(await openToken(token, longSecret, 2_000)).toEqual(payload);
    }
  });

  test("rejects secrets shorter than 32 bytes", async () => {
    const shortSecret = secretOf(16);
    expect(isUsableSecret(shortSecret)).toBe(false);
    expect(isUsableSecret("not base64!")).toBe(false);
    expect(isUsableSecret(secret)).toBe(true);
    const err = await sealToken(payload, shortSecret).catch((e: Error) => e);
    expect((err as Error).message).toContain("at least 32 bytes");
    const token = await sealToken(payload, secret);
    expect(await openToken(token, shortSecret, 2_000)).toBeNull();
  });
});
