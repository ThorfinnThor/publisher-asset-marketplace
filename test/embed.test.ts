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
      '<iframe src="https://ourworldindata.org/grapher/solar-pv-prices?embed=1" title="Solar prices &quot;overview&quot;" loading="lazy"></iframe>',
    );
    expect(parseEmbedRights(null)).toEqual({});
  });
});
