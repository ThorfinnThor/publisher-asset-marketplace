import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ all: vi.fn() }));

vi.mock("@/lib/db/client", () => ({
  getDatabase: () => ({
    prepare: () => ({ all: mocks.all }),
  }),
}));

import { PUBLIC_EDITORIAL_ARTICLES } from "../src/lib/editorial/public-articles";
import { GET } from "../src/app/sitemap.xml/route";

describe("selective sitemap", () => {
  beforeEach(() => {
    mocks.all.mockReset();
    mocks.all.mockResolvedValue({ results: [] });
  });

  it("includes the insights hub and all four approved articles", async () => {
    const response = await GET();
    const xml = await response.text();
    expect(response.headers.get("content-type")).toContain("application/xml");
    expect(xml).toContain("<loc>https://citesupply.com/insights</loc>");
    for (const article of PUBLIC_EDITORIAL_ARTICLES) {
      expect(xml).toContain(`<loc>https://citesupply.com/insights/${article.draft.slug}</loc>`);
    }
  });

  it("continues to exclude non-indexable database assets", async () => {
    await GET();
    expect(mocks.all).toHaveBeenCalledOnce();
  });
});
