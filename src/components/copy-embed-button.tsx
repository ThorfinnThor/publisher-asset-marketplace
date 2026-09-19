"use client";

import { useState } from "react";

import { recordAssetAction } from "./analytics-client";
import { CopyIcon } from "./design-system";

type CopyEmbedButtonProps = {
  assetSlug: string;
  embedMarkup: string;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
};

export type CopyActionButtonProps = {
  assetSlug: string;
  copyText: string;
  action: "embed" | "citation";
  idleLabel?: string;
  disabled?: boolean;
  compact?: boolean;
};

type CopyState = "ready" | "copying" | "copied" | "failed";

export function CopyEmbedButton({
  assetSlug,
  embedMarkup,
  label = "Copy embed",
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
      idleLabel={label}
    />
  );
}

export function CopyActionButton({
  assetSlug,
  copyText,
  action,
  idleLabel,
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
      void recordAssetAction(assetSlug, action);
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
      <CopyIcon /> {copyLabel(state, action, idleLabel)}
    </button>
  );
}

function copyLabel(state: CopyState, action: "embed" | "citation", idleLabel?: string): string {
  if (state === "copying") return "Copying…";
  if (state === "copied") return "Copied";
  if (state === "failed") return "Copy failed";
  return idleLabel ?? (action === "embed" ? "Copy embed" : "Copy citation");
}
