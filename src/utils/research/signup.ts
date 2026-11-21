import {
  isAlreadyMember,
  isContactConflict,
  type ResendClient,
} from "./resend";
import { planConfirmation } from "./subscription";
import {
  fromBase64,
  isUsableSecret,
  openToken,
  sealToken,
  TOKEN_TTL_SECONDS,
} from "./token";
import { ensureArticleTopics } from "./topics";

export interface SignupConfig {
  resendApiKey: string | undefined;
  tokenSecret: string | undefined;
  turnstileSecret: string | undefined;
  segmentId: string;
  allTopicId: string;
  blogTopicId: string;
  from: string;
  siteUrl: string;
  consentTextVersion: string;
}

export interface SignupArticle {
  slug: string;
  title: string;
}

export interface SubscribeDeps {
  config: SignupConfig;
  articles: SignupArticle[];
  resend: ResendClient;
  verifyTurnstile: (
    token: string,
    secret: string,
    ip: string | undefined,
  ) => Promise<boolean>;
  cooldownCookie: string | undefined;
  ip: string | undefined;
  nowSeconds: number;
  log?: (...args: unknown[]) => void;
}

export interface ConfirmDeps {
  config: SignupConfig;
  articles: SignupArticle[];
  resend: ResendClient;
  nowSeconds: number;
  log?: (...args: unknown[]) => void;
}

export interface HandlerResult {
  status: number;
  body: { message?: string; error?: string };
  setCookie?: string;
}

export const COOLDOWN_COOKIE = "research_signup";
export const COOLDOWN_SECONDS = 600;
export const NOT_CONFIGURED = "Sign-up is not configured yet.";
export const CHECK_INBOX = "Check your inbox to confirm.";
export const CONFIRM_ERROR_PATH = "/research/confirm?error=1";

export const SERVER_ERROR = "Something went wrong. Please try again.";

export const isValidEmail = (s: string) =>
  s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const isConfigured = (c: SignupConfig, needTurnstile: boolean) =>
  Boolean(
    c.resendApiKey &&
      isUsableSecret(c.tokenSecret) &&
      c.allTopicId &&
      c.blogTopicId &&
      (!needTurnstile || c.turnstileSecret),
  );

export const isKnownScope = (scope: string, articles: SignupArticle[]) =>
  scope === "all" || articles.some((a) => a.slug === scope);

export const scopeLabel = (scope: string, articles: SignupArticle[]) => {
  if (scope === "all") return "all research notes on nlsmdn.com";
  const title = articles.find((a) => a.slug === scope)?.title ?? scope;
  return `the research note "${title}"`;
};

export const confirmUrl = (siteUrl: string, token: string) =>
  `${siteUrl}research/confirm?t=${token}`;

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const confirmationEmail = (label: string, link: string) => {
  const lines = [
    `Someone, hopefully you, asked to subscribe this address to ${label}.`,
    "The link is valid for 48 hours. If this was not you, ignore this email and nothing will happen.",
  ];
  return {
    subject: "Confirm your subscription to nlsmdn research",
    text: `${lines[0]}\n\nConfirm your subscription:\n${link}\n\n${lines[1]}\n`,
    html: [
      `<p>${escapeHtml(lines[0])}</p>`,
      `<p><a href="${escapeHtml(link)}">Confirm your subscription</a></p>`,
      `<p>${escapeHtml(lines[1])}</p>`,
    ].join("\n"),
  };
};

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

const hmacKey = (secretB64: string) =>
  crypto.subtle.importKey(
    "raw",
    fromBase64(secretB64),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

const emailHash = async (email: string) =>
  hex(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(email.toLowerCase()),
    ),
  );

const cooldownMessage = async (email: string, scope: string, time: number) =>
  new TextEncoder().encode(`${await emailHash(email)}.${scope}.${time}`);

export const confirmationIdempotencyKey = async (
  email: string,
  requestedAt: number,
) => `research-confirm/${await emailHash(email)}/${requestedAt}`;

export async function cooldownValue(
  email: string,
  scope: string,
  nowSeconds: number,
  secretB64: string,
): Promise<string> {
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secretB64),
    await cooldownMessage(email, scope, nowSeconds),
  );
  return `${nowSeconds}.${hex(sig)}`;
}

export async function isCoolingDown(
  cookie: string | undefined,
  email: string,
  scope: string,
  nowSeconds: number,
  secretB64: string,
): Promise<boolean> {
  const match = cookie?.match(/^(\d+)\.([0-9a-f]{64})$/);
  if (!match) return false;
  const time = Number(match[1]);
  const age = nowSeconds - time;
  if (age < 0 || age >= COOLDOWN_SECONDS) return false;
  const sig = Uint8Array.from(match[2].match(/../g) ?? [], (h) =>
    Number.parseInt(h, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    await hmacKey(secretB64),
    sig,
    await cooldownMessage(email, scope, time),
  );
}

export const cooldownCookieHeader = (value: string) =>
  `${COOLDOWN_COOKIE}=${value}; Path=/api/research; Max-Age=${COOLDOWN_SECONDS}; HttpOnly; Secure; SameSite=Lax`;

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export async function handleSubscribe(
  form: FormData,
  deps: SubscribeDeps,
): Promise<HandlerResult> {
  const { config, articles, nowSeconds } = deps;
  const log = deps.log ?? console.error;
  if (!isConfigured(config, true)) {
    return { status: 503, body: { error: NOT_CONFIGURED } };
  }
  const secret = config.tokenSecret as string;

  const email = field(form, "email");
  if (!isValidEmail(email)) {
    return {
      status: 400,
      body: { error: "Please enter a valid email address." },
    };
  }
  const scope = field(form, "scope");
  if (!isKnownScope(scope, articles)) {
    return {
      status: 400,
      body: { error: "Please choose what to subscribe to." },
    };
  }
  const human = await deps.verifyTurnstile(
    field(form, "cf-turnstile-response"),
    config.turnstileSecret as string,
    deps.ip,
  );
  if (!human) {
    return {
      status: 400,
      body: { error: "The spam check failed. Please try again." },
    };
  }
  if (
    await isCoolingDown(deps.cooldownCookie, email, scope, nowSeconds, secret)
  ) {
    return { status: 200, body: { message: CHECK_INBOX } };
  }

  try {
    const token = await sealToken(
      { e: email, s: scope, r: nowSeconds, x: nowSeconds + TOKEN_TTL_SECONDS },
      secret,
    );
    const mail = confirmationEmail(
      scopeLabel(scope, articles),
      confirmUrl(config.siteUrl, token),
    );
    await deps.resend.sendEmail({
      from: config.from,
      to: email,
      ...mail,
      idempotencyKey: await confirmationIdempotencyKey(email, nowSeconds),
    });
    return {
      status: 200,
      body: { message: CHECK_INBOX },
      setCookie: cooldownCookieHeader(
        await cooldownValue(email, scope, nowSeconds, secret),
      ),
    };
  } catch (err) {
    log("Research sign-up email failed:", err);
    return { status: 500, body: { error: SERVER_ERROR } };
  }
}

const toIso = (seconds: number) => new Date(seconds * 1000).toISOString();

type ContactSnapshot = {
  contact: Awaited<ReturnType<ResendClient["getContact"]>>;
  topics: Awaited<ReturnType<ResendClient["listContactTopics"]>>;
};

const readContact = async (
  resend: ResendClient,
  email: string,
): Promise<ContactSnapshot> => {
  const contact = await resend.getContact(email);
  const topics = contact ? await resend.listContactTopics(email) : [];
  return { contact, topics };
};

const createContactOrDetectExisting = async (
  resend: ResendClient,
  c: Parameters<ResendClient["createContact"]>[0],
) => {
  try {
    await resend.createContact(c);
    return true;
  } catch (err) {
    if (isContactConflict(err)) return false;
    throw err;
  }
};

const addToSegmentIfMissing = async (
  resend: ResendClient,
  email: string,
  segmentId: string,
) => {
  try {
    await resend.addToSegment(email, segmentId);
  } catch (err) {
    if (!isAlreadyMember(err)) throw err;
  }
};

export async function handleConfirm(
  t: string,
  deps: ConfirmDeps,
): Promise<{ status: number; location?: string; body?: { error: string } }> {
  const { config, articles, resend, nowSeconds } = deps;
  const log = deps.log ?? console.error;
  if (!isConfigured(config, false)) {
    return { status: 503, body: { error: NOT_CONFIGURED } };
  }
  const payload = await openToken(t, config.tokenSecret as string, nowSeconds);
  if (!payload || !isKnownScope(payload.s, articles)) {
    return { status: 303, location: CONFIRM_ERROR_PATH };
  }
  const { e: email, s: scope } = payload;
  const success = {
    status: 303,
    location: `/research/subscribed?scope=${encodeURIComponent(scope)}`,
  };

  try {
    const initial = await readContact(resend, email);
    const articleTopicIds = await ensureArticleTopics(
      resend,
      scope === "all" ? articles : articles.filter((a) => a.slug === scope),
    );
    const planFor = ({ contact, topics }: ContactSnapshot) => {
      const existingScopes = (contact?.properties.research_consent_scope ?? "")
        .split(",")
        .filter(Boolean);
      const plan = planConfirmation(
        scope,
        {
          exists: contact !== null,
          unsubscribed: contact?.unsubscribed ?? false,
          topics,
        },
        {
          allTopicId: config.allTopicId,
          blogTopicId: config.blogTopicId,
          articleTopicIds,
        },
        existingScopes,
      );
      const properties = {
        research_consent_at: toIso(nowSeconds),
        research_consent_scope: plan.scopes.join(","),
        research_consent_requested_at: toIso(payload.r),
        research_consent_text: config.consentTextVersion,
      };
      return { plan, properties };
    };

    let { plan, properties } = planFor(initial);
    if (plan.create) {
      const created = await createContactOrDetectExisting(resend, {
        email,
        unsubscribed: false,
        segments: [config.segmentId],
        topics: plan.topics,
        properties,
      });
      if (created) return success;
      const existing = await readContact(resend, email);
      if (!existing.contact) {
        throw new Error("Contact reported as existing but not found");
      }
      ({ plan, properties } = planFor(existing));
    }
    await addToSegmentIfMissing(resend, email, config.segmentId);
    if (plan.topics.length > 0) {
      await resend.updateContactTopics(email, plan.topics);
    }
    // Topics first, so a resubscribing contact is already off "Blog posts" when unsubscribed flips.
    await resend.updateContact(email, {
      ...(plan.setUnsubscribedFalse ? { unsubscribed: false } : {}),
      properties,
    });
    return success;
  } catch (err) {
    log("Research confirm failed:", err);
    return { status: 303, location: CONFIRM_ERROR_PATH };
  }
}
