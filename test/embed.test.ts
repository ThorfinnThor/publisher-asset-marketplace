import { describe, expect, it } from "vitest";

import {
  buildEmbedMarkup,
  canCopyEmbed,
  isSourceHostedEmbed,
  parseEmbedRights,
} from "../src/lib/assets/embed";

const safeAsset = {
  embed_url: "https://ourworldindata.org/grapher/solar-pv-prices?embed=1",
  rights_json: JSON.stringify({ embed_allowed: true }),
  rights_status: "safe" as const,
  source_base_url: "https://ourworldindata.org",
  title: 'Solar prices "overview"',
};

describe("C5 source-hosted embed", () => {
  it("only permits reviewed embeds on the configured source host", () => {
    expect(canCopyEmbed(safeAsset)).toBe(true);
    expect(canCopyEmbed({ ...safeAsset, embed_url: "https://evil.example/embed" })).toBe(false);
    expect(
      canCopyEmbed({ ...safeAsset, rights_json: JSON.stringify({ embed_allowed: false }) }),
    ).toBe(false);
  });

  it("does not accept insecure or unrelated embed hosts", () => {
    expect(isSourceHostedEmbed("http://ourworldindata.org/embed", safeAsset.source_base_url)).toBe(
      false,
    );
    expect(
      isSourceHostedEmbed(
        "https://ourworldindata.org.evil.example/embed",
        safeAsset.source_base_url,
      ),
    ).toBe(false);
  });

  it("builds escaped iframe markup for clipboard copy", () => {
    expect(buildEmbedMarkup(safeAsset)).toBe(
      '<iframe src="https://ourworldindata.org/grapher/solar-pv-prices?embed=1" title="Solar prices &quot;overview&quot;" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts"></iframe>',
    );
    expect(parseEmbedRights(null)).toEqual({});
  });

  it("permits a creator asset only against its reviewed embed origin", () => {
    const creatorAsset = {
      ...safeAsset,
      embed_url: "https://tools.example/embed/chart?id=1",
      embed_origin: "https://tools.example",
      source_base_url: null,
    };
    expect(canCopyEmbed(creatorAsset)).toBe(true);
    expect(
      canCopyEmbed({ ...creatorAsset, embed_url: "https://evil.example/embed/chart?id=1" }),
    ).toBe(false);
  });
});
