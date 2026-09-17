import { describe, expect, it } from "vitest";

import {
  creatorAssetDeletionLookupSql,
  marketplacePreviewObjectKey,
  prepareCreatorAssetDeletionStatements,
} from "../src/lib/assets/delete-creator-asset";

describe("creator asset deletion", () => {
  it("scopes lookup and deletion to the authenticated creator", () => {
    expect(creatorAssetDeletionLookupSql).toContain("slug = ? AND creator_id = ?");
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        return {
          bind: (...values: unknown[]) => {
            const statement = { sql, values };
            prepared.push(statement);
            return statement;
          },
        };
      },
    } as unknown as D1Database;

    prepareCreatorAssetDeletionStatements(db, "asset-1", "github:123");

    expect(prepared).toEqual([
      {
        sql: "DELETE FROM submissions WHERE creator_id = ? AND asset_id = ?",
        values: ["github:123", "asset-1"],
      },
      {
        sql: "DELETE FROM assets WHERE id = ? AND creator_id = ?",
        values: ["asset-1", "github:123"],
      },
    ]);
  });

  it("only identifies marketplace-hosted preview objects on the current origin", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(
      marketplacePreviewObjectKey(
        `https://market.example/api/submission-previews/${id}`,
        "https://market.example",
      ),
    ).toBe(`submission-previews/${id}`);
    expect(
      marketplacePreviewObjectKey(
        `https://other.example/api/submission-previews/${id}`,
        "https://market.example",
      ),
    ).toBeNull();
    expect(
      marketplacePreviewObjectKey("https://market.example/image.png", "https://market.example"),
    ).toBeNull();
  });
});
