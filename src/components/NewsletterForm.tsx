import { useState } from "react";

export default function NewsletterForm() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(
    e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let message = "Something went wrong.";
        try {
          const data = await res.json();
          if (data?.error) message = data.error;
        } catch {
          // non-JSON body (e.g. platform error page); keep default
        }
        throw new Error(message);
      }

      setStatus("success");
      form.reset();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="text-sm text-foreground/75">
        Thanks for subscribing! You'll hear from me when I publish new posts.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-foreground/75">
        Subscribe to get new posts in your inbox.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          disabled={status === "loading"}
          className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-50"
        >
          {status === "loading" ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-500">{errorMsg}</p>}
    </form>
  );
}
