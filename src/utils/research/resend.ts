type Subscription = "opt_in" | "opt_out";
type TopicSubscription = { id: string; subscription: Subscription };

export interface ResendClient {
  sendEmail(msg: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey?: string;
  }): Promise<void>;
  getContact(email: string): Promise<{
    id: string;
    unsubscribed: boolean;
    properties: Record<string, string>;
  } | null>;
  createContact(c: {
    email: string;
    unsubscribed?: boolean;
    segments?: string[];
    topics?: TopicSubscription[];
    properties?: Record<string, string>;
  }): Promise<{ id: string }>;
  updateContact(
    email: string,
    patch: { unsubscribed?: boolean; properties?: Record<string, string> },
  ): Promise<void>;
  addToSegment(email: string, segmentId: string): Promise<void>;
  listContactTopics(email: string): Promise<TopicSubscription[]>;
  updateContactTopics(
    email: string,
    topics: TopicSubscription[],
  ): Promise<void>;
  listSegmentContacts(
    segmentId: string,
  ): Promise<{ email: string; unsubscribed: boolean }[]>;
  listTopics(): Promise<
    { id: string; name: string; description: string; createdAt?: string }[]
  >;
  createTopic(t: {
    name: string;
    description: string;
    default_subscription: "opt_out";
    visibility: "public";
  }): Promise<{ id: string }>;
  updateTopic(id: string, patch: { name: string }): Promise<void>;
  listBroadcasts(): Promise<{ id: string; name: string; status: string }[]>;
  createBroadcast(b: {
    segment_id: string;
    topic_id: string;
    from: string;
    subject: string;
    html: string;
    text: string;
    name: string;
    idempotencyKey?: string;
  }): Promise<{ id: string }>;
  sendBroadcast(id: string): Promise<void>;
}

export class ResendError extends Error {
  constructor(
    readonly status: number,
    readonly errorName: string,
    method: string,
    path: string,
    readonly detail = "",
  ) {
    super(
      `Resend ${method} ${path} failed: ${status} ${errorName} ${detail}`.trim(),
    );
  }
}

const mentionsExisting = (err: ResendError) =>
  /already|exist/i.test(`${err.errorName} ${err.detail}`);

export const isContactConflict = (err: unknown) =>
  err instanceof ResendError &&
  (err.status === 409 || (err.status === 422 && mentionsExisting(err)));

export const isAlreadyMember = (err: unknown) =>
  err instanceof ResendError &&
  err.status >= 400 &&
  err.status < 500 &&
  err.errorName !== "resource_locked" &&
  mentionsExisting(err);

const BASE_URL = "https://api.resend.com";
const TIMEOUT_MS = 5000;
const MAX_ATTEMPTS = 3;
const MIN_INTERVAL_MS = 200;
const MAX_RETRY_AFTER_SECONDS = 10;
const PAGE_LIMIT = 100;

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const articleTopicDescription = (slug: string) =>
  `nlsmdn.com/research/${slug}`;

export const retryDelayMs = (res: Response, attempt: number) => {
  const retryAfter = Number(res.headers.get("retry-after"));
  if (res.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter, MAX_RETRY_AFTER_SECONDS) * 1000;
  }
  return 1000 * attempt;
};

const isRetryable = (status: number, retry5xx: boolean) =>
  status === 429 || (retry5xx && status >= 500);

const errorBody = async (res: Response) => {
  try {
    const body = await res.json();
    return {
      name: typeof body?.name === "string" ? body.name : "",
      message: typeof body?.message === "string" ? body.message : "",
    };
  } catch {
    return { name: "", message: "" };
  }
};

const flattenProperties = (raw: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries(
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {},
    )
      .map(([key, prop]): [string, unknown] => [
        key,
        prop && typeof prop === "object" && "value" in prop
          ? (prop as { value: unknown }).value
          : prop,
      ])
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );

const withPage = (path: string, after: string | undefined) => {
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (after) params.set("after", after);
  return `${path}?${params}`;
};

export function createResendClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = defaultSleep,
): ResendClient {
  let slot: Promise<void> = Promise.resolve();
  const pace = () => {
    const mine = slot;
    slot = mine.then(() => sleep(MIN_INTERVAL_MS));
    return mine;
  };

  const request = async <T>(
    method: string,
    path: string,
    body?: unknown,
    opts: {
      allow404?: boolean;
      idempotencyKey?: string;
      retry5xx?: boolean;
    } = {},
  ): Promise<T | null> => {
    for (let attempt = 1; ; attempt++) {
      await pace();
      const res = await fetchImpl(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "nlsmdn-research/1.0",
          ...(opts.idempotencyKey
            ? { "Idempotency-Key": opts.idempotencyKey }
            : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const text = await res.text();
        return (text ? JSON.parse(text) : {}) as T;
      }
      if (opts.allow404 && res.status === 404) return null;
      if (
        isRetryable(res.status, opts.retry5xx ?? true) &&
        attempt < MAX_ATTEMPTS
      ) {
        await sleep(retryDelayMs(res, attempt));
        continue;
      }
      const { name, message } = await errorBody(res);
      throw new ResendError(res.status, name, method, path, message);
    }
  };

  const call = async <T>(
    method: string,
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ) => (await request<T>(method, path, body, { idempotencyKey })) as T;

  const listAll = async <T extends { id: string }>(path: string) => {
    const items: T[] = [];
    let after: string | undefined;
    for (;;) {
      const page = await call<{ data: T[]; has_more?: boolean }>(
        "GET",
        withPage(path, after),
      );
      items.push(...page.data);
      if (!page.has_more || page.data.length === 0) return items;
      after = page.data[page.data.length - 1].id;
    }
  };

  const contactPath = (email: string) =>
    `/contacts/${encodeURIComponent(email)}`;

  return {
    async sendEmail({ idempotencyKey, ...msg }) {
      await call("POST", "/emails", msg, idempotencyKey);
    },
    async getContact(email) {
      const contact = await request<{
        id: string;
        unsubscribed: boolean;
        properties?: unknown;
      }>("GET", contactPath(email), undefined, { allow404: true });
      if (!contact) return null;
      return {
        id: contact.id,
        unsubscribed: contact.unsubscribed === true,
        properties: flattenProperties(contact.properties),
      };
    },
    async createContact({ segments, ...rest }) {
      const { id } = await call<{ id: string }>("POST", "/contacts", {
        ...rest,
        ...(segments ? { segments: segments.map((id) => ({ id })) } : {}),
      });
      return { id };
    },
    async updateContact(email, patch) {
      await call("PATCH", contactPath(email), patch);
    },
    async addToSegment(email, segmentId) {
      await call(
        "POST",
        `${contactPath(email)}/segments/${encodeURIComponent(segmentId)}`,
      );
    },
    async listContactTopics(email) {
      const topics = await listAll<TopicSubscription>(
        `${contactPath(email)}/topics`,
      );
      return topics.map(({ id, subscription }) => ({ id, subscription }));
    },
    async updateContactTopics(email, topics) {
      await call("PATCH", `${contactPath(email)}/topics`, topics);
    },
    async listSegmentContacts(segmentId) {
      const contacts = await listAll<{
        id: string;
        email: string;
        unsubscribed: boolean;
      }>(`/segments/${encodeURIComponent(segmentId)}/contacts`);
      return contacts.map(({ email, unsubscribed }) => ({
        email,
        unsubscribed: unsubscribed === true,
      }));
    },
    async listTopics() {
      const topics = await listAll<{
        id: string;
        name: string;
        description?: string | null;
        created_at?: string | null;
      }>("/topics");
      return topics.map(({ id, name, description, created_at }) => ({
        id,
        name,
        description: description ?? "",
        ...(created_at ? { createdAt: created_at } : {}),
      }));
    },
    async createTopic(t) {
      const { id } = await call<{ id: string }>("POST", "/topics", t);
      return { id };
    },
    async updateTopic(id, patch) {
      await call("PATCH", `/topics/${encodeURIComponent(id)}`, patch);
    },
    async listBroadcasts() {
      const broadcasts = await listAll<{
        id: string;
        name?: string | null;
        status: string;
      }>("/broadcasts");
      return broadcasts.map(({ id, name, status }) => ({
        id,
        name: name ?? "",
        status,
      }));
    },
    async createBroadcast({ idempotencyKey, ...b }) {
      const { id } = await call<{ id: string }>(
        "POST",
        "/broadcasts",
        b,
        idempotencyKey ?? b.name,
      );
      return { id };
    },
    async sendBroadcast(id) {
      await request(
        "POST",
        `/broadcasts/${encodeURIComponent(id)}/send`,
        {},
        {
          retry5xx: false,
        },
      );
    },
  };
}
