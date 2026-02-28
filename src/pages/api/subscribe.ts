import { RESEND_API_KEY } from "astro:env/server";
import type { APIRoute } from "astro";
import { Resend } from "resend";

export const prerender = false;

const resend = new Resend(RESEND_API_KEY);
const AUDIENCE_ID = "30295bea-a99f-4b47-a275-751eb467de8e";

export const POST: APIRoute = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email");

  if (!email || typeof email !== "string") {
    return new Response(JSON.stringify({ error: "Email is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await resend.contacts.create({
    audienceId: AUDIENCE_ID,
    email,
  });

  if (error) {
    console.error("Resend subscribe error:", error);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(JSON.stringify({ message: "Subscribed!" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
