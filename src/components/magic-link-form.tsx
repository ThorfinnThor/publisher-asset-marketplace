"use client";

import { useState, type FormEvent } from "react";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "The sign-in email could not be sent.");
      setStatus("sent");
      setMessage("Check your inbox. The one-time sign-in link expires in 15 minutes.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The sign-in email could not be sent.");
    }
  }

  if (status === "sent") {
    return (
      <div className="magic-link-status" role="status">
        <strong>Email sent</strong>
        <span>{message}</span>
        <button className="text-link" onClick={() => setStatus("idle")} type="button">
          Use another email
        </button>
      </div>
    );
  }

  return (
    <form className="magic-link-form" onSubmit={submit}>
      <label htmlFor="magic-link-email">Or continue with email</label>
      <div className="magic-link-form__controls">
        <input
          autoComplete="email"
          id="magic-link-email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
        <button className="button button--secondary" disabled={status === "sending"} type="submit">
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </div>
      {status === "error" ? (
        <span className="magic-link-form__error" role="alert">
          {message}
        </span>
      ) : null}
    </form>
  );
}
