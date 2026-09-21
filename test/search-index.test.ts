import { describe, expect, it } from "vitest";

import {
  rebuildSelectedAssetSearchTrigramQueries,
  rebuildSelectedAssetSearchTrigrams,
} from "../src/lib/search/search-index";

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

  it("executes the selected delete and insert as one D1 batch", async () => {
    const batches: unknown[][] = [];
    const db = {
      prepare(sql: string) {
        return { bind: (...params: string[]) => ({ sql, params }) };
      },
      async batch(statements: unknown[]) {
        batches.push(statements);
        return [];
      },
    } as unknown as D1Database;

    await rebuildSelectedAssetSearchTrigrams(db, ["asset_one"]);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(2);
  });

  it("does not open a D1 batch when no asset ids are supplied", async () => {
    const db = { batch: () => Promise.reject(new Error("must not run")) } as unknown as D1Database;
    await expect(rebuildSelectedAssetSearchTrigrams(db, [])).resolves.toBeUndefined();
  });
});
