import { describe, expect, it } from "vitest";

import {
  isIframeEmbedRequest,
  marketplaceEmbedSlug,
  publisherOriginFromRequest,
  trackedSourceEmbedSlug,
} from "../src/lib/analytics/embed-usage";

describe("embed usage analytics", () => {
  it("recognizes tracked and marketplace embed paths without accepting extra segments", () => {
    expect(trackedSourceEmbedSlug("/e/solar-pv-prices")).toBe("solar-pv-prices");
    expect(trackedSourceEmbedSlug("/e/solar-pv-prices/")).toBe("solar-pv-prices");
    expect(trackedSourceEmbedSlug("/e/solar-pv-prices/extra")).toBeNull();

    expect(marketplaceEmbedSlug("/embed/worldbank-fb.bnk.capa.zs")).toBe(
      "worldbank-fb.bnk.capa.zs",
    );
    expect(marketplaceEmbedSlug("/embed/eurostat-tps00001")).toBe("eurostat-tps00001");
    expect(marketplaceEmbedSlug("/embed/creator-unreviewed")).toBeNull();
  });

  it("counts only explicit iframe GET requests", () => {
    expect(
      isIframeEmbedRequest(
        new Request("https://citesupply.com/e/solar", {
          headers: { "sec-fetch-dest": "iframe" },
        }),
      ),
    ).toBe(true);
    expect(isIframeEmbedRequest(new Request("https://citesupply.com/e/solar"))).toBe(false);
    expect(
      isIframeEmbedRequest(
        new Request("https://citesupply.com/e/solar", {
          method: "HEAD",
          headers: { "sec-fetch-dest": "iframe" },
        }),
      ),
    ).toBe(false);
  });

  it("reduces external referrers to an origin and suppresses Cite Supply self-referrers", () => {
    const external = new Request("https://citesupply.com/e/solar", {
      headers: {
        referer: "https://publisher.example/article/energy?utm_source=test",
        "sec-fetch-dest": "iframe",
      },
    });
    expect(publisherOriginFromRequest(external)).toBe("https://publisher.example");

    const internal = new Request("https://citesupply.com/e/solar", {
      headers: { referer: "https://citesupply.com/asset/solar" },
    });
    expect(publisherOriginFromRequest(internal)).toBeNull();

    const missing = new Request("https://citesupply.com/e/solar");
    expect(publisherOriginFromRequest(missing)).toBeNull();
  });
});
