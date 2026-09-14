"use client";

import { useState } from "react";

import { CopyIcon } from "./design-system";

type CopyEmbedButtonProps = {
  assetSlug: string;
  embedMarkup: string;
  disabled?: boolean;
  compact?: boolean;
};

export type CopyActionButtonProps = {
  assetSlug: string;
  copyText: string;
  action: "embed" | "citation";
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
  return (
    <CopyActionButton
      action="embed"
      assetSlug={assetSlug}
      compact={compact}
      copyText={embedMarkup}
      disabled={disabled}
    />
  );
}

export function CopyActionButton({
  assetSlug,
  copyText,
  action,
  disabled = false,
  compact = false,
}: CopyActionButtonProps) {
  const [state, setState] = useState<CopyState>("ready");
  const className = compact ? "button button--secondary button--small" : "button button--secondary";

  async function copyAction() {
    if (disabled || state === "copying") return;
    setState("copying");
    try {
      await navigator.clipboard.writeText(copyText);
      setState("copied");
      void recordAction(assetSlug, action);
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
      onClick={copyAction}
      title={
        disabled
          ? action === "embed"
            ? "Embed permission is not approved"
            : "No citation is stored"
          : undefined
      }
      type="button"
    >
      <CopyIcon /> {copyLabel(state, action)}
    </button>
  );
}

function copyLabel(state: CopyState, action: "embed" | "citation"): string {
  if (state === "copying") return "Copying…";
  if (state === "copied") return "Copied";
  if (state === "failed") return "Copy failed";
  return action === "embed" ? "Copy embed" : "Copy citation";
}

async function recordAction(assetSlug: string, action: "embed" | "citation"): Promise<void> {
  const sessionId = getAnonymousSessionId();
  if (!sessionId) return;
  try {
    await fetch(`/api/assets/${encodeURIComponent(assetSlug)}/${action}-copy`, {
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
