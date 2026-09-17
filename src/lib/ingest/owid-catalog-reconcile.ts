export type OwidPendingAsset = {
  id: string;
  slug: string;
  canonical_url: string;
};

export type OwidSourceProbe =
  | { kind: "available"; status: number }
  | { kind: "redirected"; status: number; location: string }
  | { kind: "removed"; status: number }
  | { kind: "failed"; detail: string };

export type OwidPendingDisposition =
  | {
      action: "hide";
      reason: "catalog_removed" | "canonical_redirected" | "source_removed";
      note: string;
    }
  | { action: "retain"; reason: "source_available" | "probe_failed"; note: string };

export function classifyOwidPendingAsset(
  asset: OwidPendingAsset,
  currentCatalogSlugs: ReadonlySet<string>,
  probe: OwidSourceProbe | null,
): OwidPendingDisposition {
  if (!currentCatalogSlugs.has(asset.slug)) {
    return {
      action: "hide",
      reason: "catalog_removed",
      note: "The unpublished asset is no longer present in the current public OWID catalogue.",
    };
  }
  if (!probe) {
    return {
      action: "retain",
      reason: "probe_failed",
      note: "No source probe result was available; the asset remains pending.",
    };
  }
  if (probe.kind === "redirected") {
    return {
      action: "hide",
      reason: "canonical_redirected",
      note: `The OWID chart URL redirects with HTTP ${probe.status} to ${probe.location}; the alias is not treated as an independently reviewable chart.`,
    };
  }
  if (probe.kind === "removed") {
    return {
      action: "hide",
      reason: "source_removed",
      note: `The OWID chart URL returned HTTP ${probe.status}.`,
    };
  }
  if (probe.kind === "failed") {
    return {
      action: "retain",
      reason: "probe_failed",
      note: `The source probe failed (${probe.detail}); the asset remains pending for retry.`,
    };
  }
  return {
    action: "retain",
    reason: "source_available",
    note: `The source returned HTTP ${probe.status}; the asset remains pending for rights review.`,
  };
}
