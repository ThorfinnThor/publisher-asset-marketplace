import { describe, expect, it } from "vitest";

import { GET } from "@/app/llms.txt/route";
import { PUBLIC_EDITORIAL_ARTICLES } from "@/lib/editorial/public-articles";
import { TOPICS } from "@/lib/topics";

describe("llms.txt", () => {
  it("serves a concise Markdown guide with all curated topic and insight pages", async () => {
    const response = GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toMatch(/^# Cite Supply\n\n> /);
    expect(body).toContain("## Core pages");
    expect(body).toContain("## Topic guides");
    expect(body).toContain("## Published data insights");
    expect(body).toContain("https://citesupply.com/sitemap.xml");

    for (const topic of TOPICS) {
      expect(body).toContain(`https://citesupply.com/topics/${topic.slug}`);
    }
    for (const article of PUBLIC_EDITORIAL_ARTICLES) {
      expect(body).toContain(`https://citesupply.com/insights/${article.draft.slug}`);
    }
  });

  it("documents rights interpretation instead of claiming blanket permission", async () => {
    const body = await GET().text();
    expect(body).toContain("Check each asset page before reuse");
    expect(body).toContain("does not imply that Cite Supply owns");
  });
});
