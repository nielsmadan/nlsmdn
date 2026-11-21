import type { APIRoute } from "astro";
import {
  COOLDOWN_COOKIE,
  handleSubscribe,
  SERVER_ERROR,
} from "@/utils/research/signup";
import { verifyTurnstile } from "@/utils/research/turnstile";
import {
  nowSeconds,
  signupArticles,
  signupConfig,
  signupResendClient,
} from "@/utils/researchSignup";

export const prerender = false;

const clientIp = (read: () => string) => {
  try {
    return read();
  } catch {
    return undefined;
  }
};

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    form = new FormData();
  }

  let result: Awaited<ReturnType<typeof handleSubscribe>>;
  try {
    result = await handleSubscribe(form, {
      config: signupConfig(),
      articles: await signupArticles(),
      resend: signupResendClient(),
      verifyTurnstile: (token, secret, ip) =>
        verifyTurnstile(token, secret, ip),
      cooldownCookie: cookies.get(COOLDOWN_COOKIE)?.value,
      ip: clientIp(() => context.clientAddress),
      nowSeconds: nowSeconds(),
    });
  } catch (err) {
    console.error("Research subscribe error:", err);
    result = { status: 500, body: { error: SERVER_ERROR } };
  }

  const headers = new Headers({ "Content-Type": "application/json" });
  if (result.setCookie) headers.append("Set-Cookie", result.setCookie);
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers,
  });
};
