"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteCreatorAssetButtonProps = {
  csrfToken: string;
  slug: string;
  title: string;
};

export function DeleteCreatorAssetButton({
  csrfToken,
  slug,
  title,
}: DeleteCreatorAssetButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "deleting" | "deleted" | "error">("idle");

  async function deleteAsset() {
    const confirmed = window.confirm(
      `Delete “${title}”? This permanently removes the listing, its analytics history and its marketplace-hosted preview. This cannot be undone.`,
    );
    if (!confirmed) return;

    setState("deleting");
    try {
      const response = await fetch(`/api/creator/assets/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csrf_token: csrfToken }),
      });
      if (!response.ok) {
        setState("error");
        return;
      }
      setState("deleted");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="creator-asset-card__delete" aria-live="polite">
      <button
        className="button button--danger button--small"
        disabled={state === "deleting" || state === "deleted"}
        onClick={deleteAsset}
        type="button"
      >
        {state === "deleting" ? "Deleting…" : state === "deleted" ? "Deleted" : "Delete asset"}
      </button>
      {state === "error" ? <span>The asset could not be deleted. Try again.</span> : null}
    </div>
  );
}
