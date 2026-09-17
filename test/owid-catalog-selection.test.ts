import { describe, expect, it } from "vitest";

import { owidAssetsToCsv, selectMissingOwidAssets } from "../src/lib/ingest/owid-catalog-selection";
import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";

describe("OWID catalogue selection", () => {
  const catalogue = normalizeOwidInput(
    'asset_url,title\n"https://ourworldindata.org/grapher/one","One"\n"https://ourworldindata.org/grapher/two","Two, quoted"\n',
    "csv",
  ).accepted;

  it("selects only catalogue slugs not already stored", () => {
    expect(selectMissingOwidAssets(catalogue, new Set(["one"])).map((asset) => asset.slug)).toEqual(
      ["two"],
    );
  });

  it("writes a clean CSV accepted by the normalizer", () => {
    const csv = owidAssetsToCsv(selectMissingOwidAssets(catalogue, new Set(["one"])));
    const normalized = normalizeOwidInput(csv, "csv");

    expect(normalized.invalid).toEqual([]);
    expect(normalized.accepted).toMatchObject([{ slug: "two", title: "Two, quoted" }]);
  });
});
