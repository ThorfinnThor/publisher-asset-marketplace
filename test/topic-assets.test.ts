import { describe, expect, it } from "vitest";

import { TOPIC_ASSET_SLUGS, topicAssetSlugs, topicForAsset } from "@/lib/topic-assets";
import { TOPICS } from "@/lib/topics";

describe("curated topic assets", () => {
  it("only maps defined topics", () => {
    const topicSlugs = new Set(TOPICS.map((topic) => topic.slug));
    for (const slug of Object.keys(TOPIC_ASSET_SLUGS)) expect(topicSlugs.has(slug)).toBe(true);
  });

  it("assigns each asset to exactly one topic", () => {
    const all = Object.values(TOPIC_ASSET_SLUGS).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("resolves an asset back to its topic hub", () => {
    expect(topicForAsset("solar-pv-prices")?.slug).toBe("energy-and-climate");
    expect(topicForAsset("unknown-asset")).toBeUndefined();
    expect(topicAssetSlugs("energy-and-climate")).toContain("solar-pv-prices");
    expect(topicAssetSlugs("water-and-sanitation")).toEqual([]);
  });
});
