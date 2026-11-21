export interface TokenPayload {
  e: string;
  s: string;
  r: number;
  x: number;
}

export const TOKEN_TTL_SECONDS = 48 * 60 * 60;

export const fromBase64 = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (s: string) =>
  fromBase64(s.replace(/-/g, "+").replace(/_/g, "/"));

export const MIN_SECRET_BYTES = 32;

export const isUsableSecret = (secretB64: string | undefined) => {
  if (!secretB64) return false;
  try {
    return fromBase64(secretB64).length >= MIN_SECRET_BYTES;
  } catch {
    return false;
  }
};

const importKey = async (secretB64: string) => {
  if (!isUsableSecret(secretB64)) {
    throw new Error(
      `RESEARCH_TOKEN_SECRET must be base64 of at least ${MIN_SECRET_BYTES} bytes`,
    );
  }
  return crypto.subtle.importKey(
    "raw",
    await crypto.subtle.digest("SHA-256", fromBase64(secretB64)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
};

const isPayload = (p: unknown): p is TokenPayload => {
  const o = p as Record<string, unknown> | null;
  return (
    typeof o === "object" &&
    o !== null &&
    typeof o.e === "string" &&
    typeof o.s === "string" &&
    typeof o.r === "number" &&
    typeof o.x === "number"
  );
};

export async function sealToken(
  p: TokenPayload,
  secretB64: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await importKey(secretB64),
    new TextEncoder().encode(JSON.stringify(p)),
  );
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), iv.length);
  return toBase64Url(out);
}

export async function openToken(
  token: string,
  secretB64: string,
  nowSeconds: number,
): Promise<TokenPayload | null> {
  try {
    const bytes = fromBase64Url(token);
    if (bytes.length <= 12) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, 12) },
      await importKey(secretB64),
      bytes.slice(12),
    );
    const payload: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    return isPayload(payload) && payload.x > nowSeconds ? payload : null;
  } catch {
    return null;
  }
}
