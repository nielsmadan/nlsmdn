import { RESEND_API_KEY } from "astro:env/server";
import type { APIRoute } from "astro";

export const prerender = false;

const AUDIENCE_ID = "30295bea-a99f-4b47-a275-751eb467de8e";
const RESEND_URL = `https://api.resend.com/audiences/${AUDIENCE_ID}/contacts`;

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isValidEmail = (s: string) =>
  s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!email || typeof email !== "string" || !isValidEmail(email)) {
    return json(400, { error: "Please enter a valid email address." });
  }

  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("Resend subscribe network error:", err);
    return json(500, { error: "Something went wrong. Please try again." });
  }

  if (res.ok) {
    return json(200, { message: "Subscribed!" });
  }

  const body = await res.text().catch(() => "");
  let errorName = "";
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.name === "string") errorName = parsed.name;
  } catch {
    // body wasn't JSON; status alone is enough for diagnosis
  }
  console.error("Resend subscribe error:", res.status, errorName);

  if (res.status >= 400 && res.status < 500) {
    if (/exist|duplicate/i.test(body)) {
      return json(200, { message: "Subscribed!" });
    }
    return json(400, { error: "Please check your email and try again." });
  }
  return json(500, { error: "Something went wrong. Please try again." });
};
