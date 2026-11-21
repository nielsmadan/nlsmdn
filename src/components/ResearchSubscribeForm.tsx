import { useEffect, useRef, useState } from "react";
import { RESEARCH } from "@/research.config";

type Props = {
  scope: string;
  siteKey: string;
};

type Turnstile = {
  render: (el: HTMLElement, opts: { sitekey: string }) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<Turnstile> | null = null;

const loadTurnstile = () => {
  scriptPromise ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("Turnstile did not load"));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile did not load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
};

const NOT_CONFIGURED = "Sign-up is not configured yet.";

export default function ResearchSubscribeForm({ scope, siteKey }: Props) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const widgetRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const isArticle = scope !== "all";

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return;
    const el = widgetRef.current;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (!cancelled)
          widgetId.current = turnstile.render(el, { sitekey: siteKey });
      })
      .catch(() => {
        setErrorMsg("The spam check could not load. Please reload the page.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  async function handleSubmit(
    e: React.SyntheticEvent<HTMLFormElement, SubmitEvent>,
  ) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/research/subscribe", {
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
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    }
  }

  if (!siteKey) {
    return <p className="text-sm text-foreground/75">{NOT_CONFIGURED}</p>;
  }

  if (status === "success") {
    return (
      <p className="text-sm text-foreground/75">Check your inbox to confirm.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-foreground/75">
        {isArticle
          ? "Get an email when this note gets a new version."
          : "Get an email when a research note is published or gets a new version."}
      </p>
      {isArticle ? (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <legend className="sr-only">Subscribe to</legend>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="scope" value={scope} defaultChecked />
            This note
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="scope" value="all" />
            All research notes
          </label>
        </fieldset>
      ) : (
        <input type="hidden" name="scope" value="all" />
      )}
      <div className="flex gap-2">
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          aria-label="Email address"
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
      <div ref={widgetRef} />
      <p className="text-xs text-foreground/60">{RESEARCH.consentText}</p>
      {status === "error" && <p className="text-xs text-red-500">{errorMsg}</p>}
    </form>
  );
}
