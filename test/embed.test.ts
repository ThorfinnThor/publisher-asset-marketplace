import { describe, expect, it } from "vitest";

import {
  buildEmbedMarkup,
  canCopyEmbed,
  deriveSourceHostedEmbedUrl,
  hasReviewedCreatorAttribution,
  isSourceHostedEmbed,
  parseEmbedRights,
} from "../src/lib/assets/embed";

const safeAsset = {
  embed_url: "https://ourworldindata.org/grapher/solar-pv-prices?embed=1",
  rights_json: JSON.stringify({ embed_allowed: true, attribution_required: true }),
  rights_status: "safe" as const,
  source_id: "source_owid",
  source_base_url: "https://ourworldindata.org",
  attribution_name: "Our World in Data",
  attribution_url: "https://ourworldindata.org/",
  title: 'Solar prices "overview"',
};

describe("C5 source-hosted embed", () => {
  it("derives the standard OWID embed URL only from a Grapher canonical URL", () => {
    expect(
      deriveSourceHostedEmbedUrl(
        "source_owid",
        "https://ourworldindata.org/grapher/covid-contact-tracing",
        null,
      ),
    ).toBe("https://ourworldindata.org/grapher/covid-contact-tracing?embed=1");
    expect(
      deriveSourceHostedEmbedUrl(
        "source_owid",
        "https://example.com/grapher/covid-contact-tracing",
        null,
      ),
    ).toBeNull();
  });

  it("only permits reviewed embeds on the configured source host", () => {
    expect(canCopyEmbed(safeAsset)).toBe(true);
    expect(canCopyEmbed({ ...safeAsset, embed_url: "https://evil.example/embed" })).toBe(false);
    expect(
      canCopyEmbed({ ...safeAsset, rights_json: JSON.stringify({ embed_allowed: false }) }),
    ).toBe(false);
  });

  it("uses the allowlisted source origin when a source record is incomplete", () => {
    expect(
      canCopyEmbed({
        ...safeAsset,
        source_id: "source_owid",
        source_base_url: null,
      }),
    ).toBe(true);
  });

  it("does not let stale embed metadata override a source-hosted allowlist", () => {
    expect(
      canCopyEmbed({
        ...safeAsset,
        source_id: "source_owid",
        source_base_url: "https://ourworldindata.org",
        embed_origin: "https://publisher-asset-marketplace.shuu9599.workers.dev",
      }),
    ).toBe(true);
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
      '<iframe src="https://ourworldindata.org/grapher/solar-pv-prices?embed=1" title="Solar prices &quot;overview&quot;" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts" style="width:100%;height:720px;border:0;display:block"></iframe>',
    );
    expect(parseEmbedRights(null)).toEqual({});
  });

  it("permits a creator asset only against its reviewed embed origin", () => {
    const creatorAsset = {
      ...safeAsset,
      embed_url: "https://tools.example/embed/chart?id=1",
      embed_origin: "https://tools.example",
      source_id: null,
      source_base_url: null,
      attribution_name: "Example Tools",
      attribution_url: "https://tools.example/",
    };
    expect(canCopyEmbed(creatorAsset)).toBe(true);
    expect(
      canCopyEmbed({ ...creatorAsset, embed_url: "https://evil.example/embed/chart?id=1" }),
    ).toBe(false);
    const markup = buildEmbedMarkup(creatorAsset);
    expect(markup).toBe(
      '<figure><iframe src="https://tools.example/embed/chart?id=1" title="Solar prices &quot;overview&quot;" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts" style="width:100%;height:720px;border:0;display:block"></iframe><figcaption>Source: <a href="https://tools.example/">Example Tools</a></figcaption></figure>',
    );
    expect(markup).not.toContain(">Solar prices");
    expect(markup).not.toContain("target=");
    expect(markup).not.toContain("rel=");
  });

  it("permits a reviewed marketplace-rendered embed without granting source embed rights", () => {
    const eurostatAsset = {
      ...safeAsset,
      embed_url: "https://publisher-asset-marketplace.shuu9599.workers.dev/embed/eurostat-tps00001",
      embed_origin: "https://publisher-asset-marketplace.shuu9599.workers.dev",
      source_id: "source_eurostat",
      source_base_url: "https://ec.europa.eu/eurostat",
      rights_json: JSON.stringify({
        embed_allowed: false,
        marketplace_rendered_embed_allowed: true,
        embed_provenance: "marketplace_rendered",
        attribution_required: true,
      }),
    };
    expect(canCopyEmbed(eurostatAsset)).toBe(true);
    expect(buildEmbedMarkup(eurostatAsset)).toContain('sandbox=""');
    expect(buildEmbedMarkup(eurostatAsset)).not.toContain("allow-scripts");
    expect(
      canCopyEmbed({
        ...eurostatAsset,
        rights_json: JSON.stringify({
          embed_allowed: false,
          marketplace_rendered_embed_allowed: true,
          embed_provenance: "source_hosted",
        }),
      }),
    ).toBe(false);
  });

  it("fails closed without reviewed brand attribution and escapes visible anchor text", () => {
    const creatorAsset = {
      ...safeAsset,
      embed_url: "https://tools.example/embed/chart",
      embed_origin: "https://tools.example",
      source_id: null,
      source_base_url: null,
      attribution_name: "Example <Tools>",
      attribution_url: "https://tools.example/",
    };
    expect(hasReviewedCreatorAttribution(creatorAsset)).toBe(true);
    expect(buildEmbedMarkup(creatorAsset)).toContain("Example &lt;Tools&gt;");
    expect(buildEmbedMarkup({ ...creatorAsset, attribution_name: null })).toBe("");
    expect(buildEmbedMarkup({ ...creatorAsset, attribution_name: " Example Tools " })).toBe("");
    expect(buildEmbedMarkup({ ...creatorAsset, attribution_url: "javascript:alert(1)" })).toBe("");
  });
});
