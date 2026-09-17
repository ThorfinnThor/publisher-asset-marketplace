import { describe, expect, it } from "vitest";

import { classifyOwidPendingAsset } from "../src/lib/ingest/owid-catalog-reconcile";

const asset = {
  id: "asset_owid_example",
  slug: "example",
  canonical_url: "https://ourworldindata.org/grapher/example",
};

describe("OWID pending catalogue reconciliation", () => {
  it("hides unpublished assets removed from the current catalogue", () => {
    expect(classifyOwidPendingAsset(asset, new Set(), null)).toMatchObject({
      action: "hide",
      reason: "catalog_removed",
    });
  });

  it("hides redirected aliases without following them", () => {
    expect(
      classifyOwidPendingAsset(asset, new Set([asset.slug]), {
        kind: "redirected",
        status: 301,
        location: "https://ourworldindata.org/explorers/example",
      }),
    ).toMatchObject({ action: "hide", reason: "canonical_redirected" });
  });

  it("retains source-available and transiently failed assets for review", () => {
    expect(
      classifyOwidPendingAsset(asset, new Set([asset.slug]), {
        kind: "available",
        status: 200,
      }),
    ).toMatchObject({ action: "retain", reason: "source_available" });
    expect(
      classifyOwidPendingAsset(asset, new Set([asset.slug]), {
        kind: "failed",
        detail: "timeout",
      }),
    ).toMatchObject({ action: "retain", reason: "probe_failed" });
  });
});
