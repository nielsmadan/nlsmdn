import {
  isAlreadyMember,
  isContactConflict,
  type ResendClient,
  ResendError,
} from "@/utils/research/resend";

export interface NewsletterDeps {
  apiKey: string | undefined;
  segmentId: string;
  blogTopicId: string;
  resend: ResendClient;
  log?: (...args: unknown[]) => void;
}

export interface NewsletterResult {
  status: number;
  body: { message: string } | { error: string };
}

const isValidEmail = (s: string) =>
  s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const SUBSCRIBED = { status: 200, body: { message: "Subscribed!" } };
const PREVIOUSLY_UNSUBSCRIBED = {
  status: 409,
  body: {
    error:
      "This address unsubscribed earlier, so it won't receive emails. Get in touch via the About page to resubscribe.",
  },
};

const BLOG_OPTED_OUT = {
  status: 409,
  body: {
    error:
      "This address opted out of blog post emails. Use the preferences link in any nlsmdn email to opt back in.",
  },
};

type Outcome = "subscribed" | "unsubscribed" | "opted_out";

const blogOptIn = (blogTopicId: string) => [
  { id: blogTopicId, subscription: "opt_in" as const },
];

const subscribeExisting = async (
  email: string,
  unsubscribed: boolean,
  { resend, segmentId, blogTopicId }: NewsletterDeps,
): Promise<Outcome> => {
  const optedOut =
    blogTopicId !== "" &&
    (await resend.listContactTopics(email)).some(
      (t) => t.id === blogTopicId && t.subscription === "opt_out",
    );
  if (!optedOut) {
    try {
      await resend.addToSegment(email, segmentId);
    } catch (err) {
      if (!isAlreadyMember(err)) throw err;
    }
    if (blogTopicId) {
      await resend.updateContactTopics(email, blogOptIn(blogTopicId));
    }
  }
  return unsubscribed ? "unsubscribed" : optedOut ? "opted_out" : "subscribed";
};

const subscribe = async (
  email: string,
  deps: NewsletterDeps,
): Promise<Outcome> => {
  const { resend, segmentId, blogTopicId } = deps;
  const existing = await resend.getContact(email);
  if (existing) return subscribeExisting(email, existing.unsubscribed, deps);
  try {
    await resend.createContact({
      email,
      segments: [segmentId],
      ...(blogTopicId ? { topics: blogOptIn(blogTopicId) } : {}),
    });
  } catch (err) {
    if (!isContactConflict(err)) throw err;
    const raced = await resend.getContact(email);
    return subscribeExisting(email, raced?.unsubscribed ?? false, deps);
  }
  return "subscribed";
};

const RESULTS: Record<Outcome, NewsletterResult> = {
  subscribed: SUBSCRIBED,
  unsubscribed: PREVIOUSLY_UNSUBSCRIBED,
  opted_out: BLOG_OPTED_OUT,
};

export async function handleNewsletterSubscribe(
  email: unknown,
  deps: NewsletterDeps,
): Promise<NewsletterResult> {
  if (!deps.apiKey) {
    return { status: 503, body: { error: "Sign-up is not configured yet." } };
  }
  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return {
      status: 400,
      body: { error: "Please enter a valid email address." },
    };
  }
  try {
    return RESULTS[await subscribe(email, deps)];
  } catch (err) {
    (deps.log ?? console.error)(
      "Resend subscribe error:",
      err instanceof ResendError ? `${err.status} ${err.errorName}` : err,
    );
    if (
      err instanceof ResendError &&
      (err.status === 400 || err.status === 422)
    ) {
      return {
        status: 400,
        body: { error: "Please check your email and try again." },
      };
    }
    return {
      status: 500,
      body: { error: "Something went wrong. Please try again." },
    };
  }
}
