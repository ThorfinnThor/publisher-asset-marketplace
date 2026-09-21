import { describe, expect, it } from "vitest";

import { freshnessDate, parseSearchPageParams, sourceOptions } from "../src/lib/search/search-page";

const now = new Date("2026-09-14T12:00:00.000Z");

describe("search page filters", () => {
  it("maps URL params into the D1 search request", () => {
    const parsed = parseSearchPageParams(
      {
        q: "solar prices",
        type: ["chart", "invalid"],
        source: "source_owid",
        rights: ["safe", "restricted", "unknown"],
        commercial: "allowed",
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
        commercial_use: true,
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

  it("supports the integrated public data sources as filter options", () => {
    expect(sourceOptions.map((option) => option.value)).toEqual([
      "source_owid",
      "source_worldbank",
      "source_eurostat",
    ]);

    const parsed = parseSearchPageParams({ q: "", source: "source_eurostat" }, now);
    expect(parsed.selectedSource).toBe("source_eurostat");
    expect(parsed.request.filters).toEqual({ source_ids: ["source_eurostat"] });
  });

  it("accepts newly configured sources provided by the database", () => {
    const parsed = parseSearchPageParams({ q: "growth", source: "source_new" }, now, [
      { value: "source_new", label: "New source", count: 7 },
    ]);
    expect(parsed.request.filters).toEqual({ source_ids: ["source_new"] });
  });

  it("calculates freshness windows in UTC", () => {
    expect(freshnessDate("1095", now)).toBe("2023-09-15T12:00:00.000Z");
    expect(freshnessDate("any", now)).toBeUndefined();
  });
});
