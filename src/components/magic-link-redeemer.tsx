"use client";

import { useEffect, useRef, useState } from "react";

export function MagicLinkRedeemer() {
  const started = useRef(false);
  const [state, setState] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Verifying your one-time sign-in link…");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      setState("error");
      setMessage("This sign-in link is incomplete. Request a new email.");
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/auth/magic-link/verify", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          redirect?: string;
        } | null;
        if (!response.ok || !payload?.redirect) {
          throw new Error(payload?.error ?? "This sign-in link could not be verified.");
        }
        window.location.replace(payload.redirect);
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Sign-in could not be completed.");
      }
    })();
  }, []);

  return (
    <div className={`magic-link-redeemer magic-link-redeemer--${state}`} aria-live="polite">
      <strong>{state === "working" ? "Signing you in" : "Link unavailable"}</strong>
      <span>{message}</span>
      {state === "error" ? (
        <a className="button button--primary" href="/creator/dashboard">
          Request a new link
        </a>
      ) : null}
    </div>
  );
}
