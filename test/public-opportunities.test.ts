import { describe, expect, it } from "vitest";

import {
  demandBand,
  mapPublicOpportunities,
  publicOpportunitySql,
  supplyBand,
} from "../src/lib/analytics/public-opportunities";

describe("public opportunities", () => {
  it("uses conservative demand buckets", () => {
    expect(demandBand(5)).toBe("5–9 searches");
    expect(demandBand(25)).toBe("25–49 searches");
    expect(demandBand(100)).toBe("100+ searches");
  });

  it("describes low supply without exposing inventory counts", () => {
    expect(supplyBand(0, 0)).toBe("No publishable sources yet");
    expect(supplyBand(2, 0)).toBe("No embeddable sources yet");
    expect(supplyBand(1, 1)).toBe("Few publishable sources");
  });

  it("maps scored rows into public buckets and filters invalid rows", () => {
    expect(
      mapPublicOpportunities([
        {
          display_query: "saas churn",
          searches: "25",
          safe_asset_count: 1,
          embeddable_asset_count: 1,
          opportunity_score: 72,
        },
        {
          display_query: "alice@example.test",
          searches: 50,
          safe_asset_count: 0,
          embeddable_asset_count: 0,
          opportunity_score: 99,
        },
        {
          display_query: " ",
          searches: 5,
          safe_asset_count: 0,
          embeddable_asset_count: 0,
          opportunity_score: 50,
        },
      ]),
    ).toEqual([
      {
        query: "saas churn",
        demand_band: "25–49 searches",
        supply_band: "Few publishable sources",
      },
    ]);
  });

  it("limits the public query to scored low-supply opportunities", () => {
    expect(publicOpportunitySql).toContain("status = 'scored'");
    expect(publicOpportunitySql).toContain("safe_asset_count <= 2");
    expect(publicOpportunitySql).toContain("embeddable_asset_count <= 1");
    expect(publicOpportunitySql).toContain("LIMIT ?");
  });
});
