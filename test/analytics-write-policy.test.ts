import { describe, expect, it } from "vitest";

import {
  d1EmbedAggregatesEnabled,
  d1SearchAnalyticsEnabled,
} from "../src/lib/analytics/write-policy";

describe("analytics D1 write policy", () => {
  it("keeps high-volume D1 analytics writes disabled by default", () => {
    expect(d1SearchAnalyticsEnabled({})).toBe(false);
    expect(d1EmbedAggregatesEnabled({})).toBe(false);
  });

  it("requires an exact lowercase opt-in", () => {
    expect(d1SearchAnalyticsEnabled({ D1_SEARCH_ANALYTICS_ENABLED: "TRUE" })).toBe(false);
    expect(d1EmbedAggregatesEnabled({ D1_EMBED_AGGREGATES_ENABLED: "1" })).toBe(false);
    expect(d1SearchAnalyticsEnabled({ D1_SEARCH_ANALYTICS_ENABLED: "true" })).toBe(true);
    expect(d1EmbedAggregatesEnabled({ D1_EMBED_AGGREGATES_ENABLED: "true" })).toBe(true);
  });
});
