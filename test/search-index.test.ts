import { describe, expect, it } from "vitest";

import { rebuildSelectedAssetSearchTrigramQueries } from "../src/lib/search/search-index";

describe("rebuildSelectedAssetSearchTrigramQueries", () => {
  it("returns parameterized delete and insert queries for selected assets", () => {
    const queries = rebuildSelectedAssetSearchTrigramQueries(["asset_one", "asset_two"]);

    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatchObject({ params: ["asset_one", "asset_two"] });
    expect(queries[0]?.sql).toContain("WHERE asset_id IN (?, ?)");
    expect(queries[1]).toMatchObject({ params: ["asset_one", "asset_two"] });
    expect(queries[1]?.sql).toContain("WHERE id IN (?, ?)");
  });

  it("does nothing when a batch imported no assets", () => {
    expect(rebuildSelectedAssetSearchTrigramQueries([])).toEqual([]);
  });
});
