import { describe, expect, it } from "vitest";

import {
  AssetEditorialOverlaySchema,
  configuredAssetEditorialOverlays,
  resolveAssetEditorialOverlay,
} from "../src/lib/assets/editorial/asset-editorial-overlay";
import type { PublishedAssetDetail } from "../src/lib/assets/get-asset";

type OverlayAsset = Pick<
  PublishedAssetDetail,
  "canonical_url" | "id" | "rights_status" | "slug" | "source_id" | "source_updated_at"
>;

const solarAsset: OverlayAsset = {
  id: "asset_owid_solar-pv-prices",
  slug: "solar-pv-prices",
  source_id: "source_owid",
  canonical_url: "https://ourworldindata.org/grapher/solar-pv-prices",
  source_updated_at: "2026-07-28",
  rights_status: "safe",
};

describe("asset editorial overlays", () => {
  it("loads the three reviewed pilot overlays with unique asset IDs", () => {
    const overlays = configuredAssetEditorialOverlays();

    expect(overlays).toHaveLength(3);
    expect(new Set(overlays.map((overlay) => overlay.asset_id)).size).toBe(overlays.length);
    expect(overlays.every((overlay) => overlay.review_state === "approved")).toBe(true);
  });

  it.each([
    [
      "missing unit",
      (overlay: Record<string, unknown>) => {
        const coverage = overlay.observation_coverage as Record<string, unknown>;
        delete coverage.unit;
      },
    ],
    [
      "missing period",
      (overlay: Record<string, unknown>) => {
        const coverage = overlay.observation_coverage as Record<string, unknown>;
        delete coverage.period;
      },
    ],
    [
      "missing limitations",
      (overlay: Record<string, unknown>) => {
        delete overlay.limitations;
      },
    ],
    [
      "an invalid internal link",
      (overlay: Record<string, unknown>) => {
        overlay.related_links = [
          {
            path: "https://example.com/not-internal",
            label: "Invalid external link",
            context: "This deliberately fails the repository overlay contract validation.",
          },
        ];
      },
    ],
    [
      "an unapproved review state",
      (overlay: Record<string, unknown>) => {
        overlay.review_state = "draft";
      },
    ],
  ])("rejects %s", (_label, mutate) => {
    const source = configuredAssetEditorialOverlays()[0];
    if (!source) throw new Error("expected a configured overlay");
    const candidate = structuredClone(source) as Record<string, unknown>;
    mutate(candidate);

    expect(AssetEditorialOverlaySchema.safeParse(candidate).success).toBe(false);
  });

  it("returns the approved overlay only when its asset and source contract are fresh", () => {
    const result = resolveAssetEditorialOverlay(solarAsset);

    expect(result.status).toBe("approved_fresh");
    if (result.status !== "approved_fresh") throw new Error("expected approved overlay");
    expect(result.overlay.direct_answer).toContain("about 99.8%");
    expect(result.overlay.observation_coverage.period).toBe("1975–2024");
  });

  it("treats equivalent timezone spellings as the same Eurostat update", () => {
    const result = resolveAssetEditorialOverlay({
      id: "asset_eurostat_nrg_ind_ren",
      slug: "eurostat-nrg_ind_ren",
      source_id: "source_eurostat",
      canonical_url:
        "https://ec.europa.eu/eurostat/databrowser/view/nrg_ind_ren/default/table?lang=en",
      source_updated_at: "2026-09-15T23:00:00+02:00",
      rights_status: "safe",
    });

    expect(result.status).toBe("approved_fresh");
  });

  it("leaves assets without a configured overlay unchanged", () => {
    const result = resolveAssetEditorialOverlay({
      ...solarAsset,
      id: "asset_owid_another-chart",
      slug: "another-chart",
    });

    expect(result).toEqual({ status: "absent", overlay: null });
  });

  it("fails closed when the source update changes", () => {
    const result = resolveAssetEditorialOverlay({
      ...solarAsset,
      source_updated_at: "2026-07-29",
    });

    expect(result).toEqual({ status: "stale", overlay: null });
  });

  it.each([
    ["restricted rights", { rights_status: "restricted" as const }],
    ["changed slug", { slug: "solar-price-chart" }],
    ["changed source", { source_id: "source_worldbank" }],
    ["changed canonical URL", { canonical_url: "https://example.com/solar" }],
  ])("suppresses the overlay for %s", (_label, override) => {
    const result = resolveAssetEditorialOverlay({ ...solarAsset, ...override });

    expect(result).toEqual({ status: "suppressed", overlay: null });
  });
});
