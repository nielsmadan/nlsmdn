import type { APIRoute } from "astro";
import { RESEARCH } from "@/research.config";
import { handleNewsletterSubscribe } from "@/utils/newsletter";
import { signupConfig, signupResendClient } from "@/utils/researchSignup";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { resendApiKey } = signupConfig();
  const formData = await request.formData().catch(() => null);
  const { status, body } = await handleNewsletterSubscribe(
    formData?.get("email"),
    {
      apiKey: resendApiKey,
      segmentId: RESEARCH.segmentId,
      blogTopicId: RESEARCH.blogTopicId,
      resend: signupResendClient(),
    },
  );
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};
