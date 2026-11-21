import type { APIRoute } from "astro";
import { CONFIRM_ERROR_PATH, handleConfirm } from "@/utils/research/signup";
import {
  nowSeconds,
  signupArticles,
  signupConfig,
  signupResendClient,
} from "@/utils/researchSignup";

export const prerender = false;

const redirect = (location: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store" },
  });

export const POST: APIRoute = async ({ request }) => {
  let t = "";
  try {
    const value = (await request.formData()).get("t");
    t = typeof value === "string" ? value : "";
  } catch {
    return redirect(CONFIRM_ERROR_PATH);
  }

  try {
    const result = await handleConfirm(t, {
      config: signupConfig(),
      articles: await signupArticles(),
      resend: signupResendClient(),
      nowSeconds: nowSeconds(),
    });
    if (result.location) return redirect(result.location);
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Research confirm error:", err);
    return redirect(CONFIRM_ERROR_PATH);
  }
};
