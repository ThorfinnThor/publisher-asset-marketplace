"use client";

import { useState } from "react";

import { CopyIcon } from "./design-system";

type CopyEmbedButtonProps = {
  assetSlug: string;
  embedMarkup: string;
  disabled?: boolean;
  compact?: boolean;
};

type CopyState = "ready" | "copying" | "copied" | "failed";

export function CopyEmbedButton({
  assetSlug,
  embedMarkup,
  disabled = false,
  compact = false,
}: CopyEmbedButtonProps) {
  const [state, setState] = useState<CopyState>("ready");
  const className = compact ? "button button--secondary button--small" : "button button--secondary";

  async function copyEmbed() {
    if (disabled || state === "copying") return;
    setState("copying");
    try {
      await navigator.clipboard.writeText(embedMarkup);
      setState("copied");
      void recordEmbedCopy(assetSlug);
      window.setTimeout(() => setState("ready"), 2_000);
    } catch {
      setState("failed");
    }
  }

  return (
    <button
      aria-live="polite"
      className={className}
      disabled={disabled || state === "copying"}
      onClick={copyEmbed}
      title={disabled ? "Embed permission is not approved" : undefined}
      type="button"
    >
      <CopyIcon /> {copyLabel(state)}
    </button>
  );
}

function copyLabel(state: CopyState): string {
  if (state === "copying") return "Copying…";
  if (state === "copied") return "Copied";
  if (state === "failed") return "Copy failed";
  return "Copy embed";
}

async function recordEmbedCopy(assetSlug: string): Promise<void> {
  const sessionId = getAnonymousSessionId();
  if (!sessionId) return;
  try {
    await fetch(`/api/assets/${encodeURIComponent(assetSlug)}/embed-copy`, {
      method: "POST",
      headers: { "x-anonymous-session-id": sessionId },
      keepalive: true,
    });
  } catch {
    // Copying remains successful even when analytics is temporarily unavailable.
  }
}

function getAnonymousSessionId(): string | null {
  try {
    const key = "publisher_asset_anonymous_session";
    const existing = window.localStorage.getItem(key);
    if (existing && /^[A-Za-z0-9_-]{8,128}$/.test(existing)) return existing;
    const generated = crypto.randomUUID();
    window.localStorage.setItem(key, generated);
    return generated;
  } catch {
    return null;
  }
}
