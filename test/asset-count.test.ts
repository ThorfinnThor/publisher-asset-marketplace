import { describe, expect, it } from "vitest";

import { getPublishedAssetCount, publishedAssetCountSql } from "../src/lib/assets/count";

describe("published asset count", () => {
  it("counts only public published assets", () => {
    expect(publishedAssetCountSql).toContain("status = 'published'");
    expect(publishedAssetCountSql).toContain("rights_status IN ('safe', 'restricted')");
  });

  it("normalizes D1 count values", async () => {
    const db = {
      prepare(sql: string) {
        expect(sql).toBe(publishedAssetCountSql);
        return {
          first: async () => ({ count: "4200" }),
        };
      },
    } as unknown as D1Database;

    await expect(getPublishedAssetCount(db)).resolves.toBe(4200);
  });

  it("returns zero for an unavailable or invalid count", async () => {
    const db = {
      prepare() {
        return {
          first: async () => ({ count: null }),
        };
      },
    } as unknown as D1Database;

    await expect(getPublishedAssetCount(db)).resolves.toBe(0);
  });
});
