import { describe, expect, it } from "vitest";

import {
  PUBLIC_EDITORIAL_ARTICLES,
  editorialArticleWordCount,
  formatEditorialMetric,
  getPublicEditorialArticle,
} from "../src/lib/editorial/public-articles";

describe("public editorial collection", () => {
  it("publishes exactly the four reviewed articles with unique routes", () => {
    expect(PUBLIC_EDITORIAL_ARTICLES).toHaveLength(4);
    const slugs = PUBLIC_EDITORIAL_ARTICLES.map(({ draft }) => draft.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(getPublicEditorialArticle(slug)?.draft.slug).toBe(slug);
    expect(getPublicEditorialArticle("not-an-article")).toBeNull();
  });

  it("keeps every published article substantial and source-led", () => {
    for (const article of PUBLIC_EDITORIAL_ARTICLES) {
      expect(editorialArticleWordCount(article.draft), article.draft.slug).toBeGreaterThanOrEqual(
        500,
      );
      expect(article.draft.citations.length, article.draft.slug).toBeGreaterThanOrEqual(2);
      expect(article.draft.citations.every((citation) => citation.url.startsWith("https://"))).toBe(
        true,
      );
      expect(article.draft.asset_slugs.length).toBeGreaterThan(0);
      expect(Date.parse(article.datePublished)).not.toBeNaN();
      expect(Date.parse(article.dateModified)).not.toBeNaN();
    }
  });

  it("resolves every table cell to an approved analysis metric", () => {
    for (const article of PUBLIC_EDITORIAL_ARTICLES) {
      for (const block of article.draft.blocks) {
        if (block.type !== "data_table") continue;
        for (const row of block.rows) {
          expect(row.metric_refs, `${article.draft.slug}:${row.label}`).toHaveLength(
            block.columns.length - 1,
          );
          for (const metricId of row.metric_refs) {
            const metric = article.metrics.get(metricId);
            expect(metric, `${article.draft.slug}:${metricId}`).toBeDefined();
            expect(metric && formatEditorialMetric(metric)).not.toBe("—");
          }
        }
      }
    }
  });

  it("publishes the wildfire source-version caveat beside the newest comparison", () => {
    const article = getPublicEditorialArticle("world-burned-area-across-four-land-cover-types");
    const caveat = article?.draft.blocks.find((block) => block.id === "source-version-note");
    expect(caveat?.type).toBe("limitation");
    expect(caveat && "text" in caveat ? caveat.text : "").toContain("not synchronized");
  });
});
