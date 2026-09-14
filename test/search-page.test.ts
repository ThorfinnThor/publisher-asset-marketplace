import { describe, expect, it } from "vitest";

import { freshnessDate, parseSearchPageParams } from "../src/lib/search/search-page";

const now = new Date("2026-09-14T12:00:00.000Z");

describe("search page filters", () => {
  it("maps URL params into the D1 search request", () => {
    const parsed = parseSearchPageParams(
      {
        q: "solar prices",
        type: ["chart", "invalid"],
        source: "source_owid",
        rights: ["safe", "restricted", "unknown"],
        freshness: "365",
      },
      now,
    );

    expect(parsed.query).toBe("solar prices");
    expect(parsed.request).toEqual({
      query: "solar prices",
      filters: {
        asset_types: ["chart"],
        source_ids: ["source_owid"],
        rights_statuses: ["safe", "restricted"],
        updated_since: "2025-09-14T12:00:00.000Z",
      },
      limit: 24,
    });
  });

  it("falls back to safe defaults for unknown filter values", () => {
    const parsed = parseSearchPageParams(
      { q: ["  internet  ", "ignored"], freshness: "not-a-window" },
      now,
    );

    expect(parsed.query).toBe("internet");
    expect(parsed.selectedFreshness).toBe("any");
    expect(parsed.request.filters).toEqual({});
  });

  it("calculates freshness windows in UTC", () => {
    expect(freshnessDate("1095", now)).toBe("2023-09-15T12:00:00.000Z");
    expect(freshnessDate("any", now)).toBeUndefined();
  });
});
