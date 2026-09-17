import { describe, expect, it } from "vitest";

import {
  parseWorldBankCatalogPage,
  reviewWorldBankIndicatorMetadata,
  selectWorldBankCatalogCandidates,
} from "../src/lib/ingest/worldbank-catalog";
import { rebuildSelectedAssetSearchTrigramsSql } from "../src/lib/search/search-index";

describe("World Bank catalogue", () => {
  it("parses catalogue entries and removes ambiguous indicator ids", () => {
    const parsed = parseWorldBankCatalogPage([
      { page: 1, pages: 1, total: 3 },
      [
        { id: "SP.POP.TOTL", name: "Population", source: { id: "2", value: "WDI" } },
        { id: "SHARED", name: "First", source: { id: "2", value: "WDI" } },
        { id: "shared", name: "Second", source: { id: "12", value: "Education" } },
      ],
    ]);
    expect(
      selectWorldBankCatalogCandidates(parsed.entries, 10).map((entry) => entry.indicator),
    ).toEqual(["SP.POP.TOTL"]);
  });

  it("prioritizes sources whose indicator metadata exposes explicit licenses", () => {
    const entries = [
      {
        indicator: "EDU.ONE",
        title: "Education indicator",
        sourceId: "12",
        sourceName: "Education Statistics",
      },
      {
        indicator: "ASPIRE.ONE",
        title: "Social protection indicator",
        sourceId: "29",
        sourceName: "ASPIRE",
      },
      {
        indicator: "WDI.ONE",
        title: "Development indicator",
        sourceId: "2",
        sourceName: "World Development Indicators",
      },
    ];

    expect(selectWorldBankCatalogCandidates(entries, 3).map((entry) => entry.indicator)).toEqual([
      "WDI.ONE",
      "ASPIRE.ONE",
      "EDU.ONE",
    ]);
  });

  it("accepts only explicit HTTPS CC BY-4.0 metadata without rights conflicts", () => {
    const metadata = {
      source: [
        {
          concept: [
            {
              variable: [
                {
                  id: "SP.POP.TOTL",
                  metatype: [
                    { id: "License_Type", value: "CC BY-4.0" },
                    {
                      id: "License_URL",
                      value: "https://datacatalog.worldbank.org/int/public-licenses#cc-by",
                    },
                    { id: "Limitationsandexceptions", value: "Estimates may be revised." },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(reviewWorldBankIndicatorMetadata("SP.POP.TOTL", metadata)).toMatchObject({
      licenseRaw: "CC BY-4.0",
    });

    metadata.source[0]!.concept[0]!.variable[0]!.metatype[2]!.value =
      "Permission required for redistribution.";
    expect(reviewWorldBankIndicatorMetadata("SP.POP.TOTL", metadata)).toBeNull();
  });

  it("does not borrow a license from another variable in the metadata response", () => {
    const metadata = {
      source: [
        {
          concept: [
            {
              variable: [
                {
                  id: "SP.POP.TOTL",
                  metatype: [{ id: "License_Type", value: "All rights reserved" }],
                },
                {
                  id: "OTHER.INDICATOR",
                  metatype: [
                    { id: "License_Type", value: "CC BY-4.0" },
                    {
                      id: "License_URL",
                      value: "https://datacatalog.worldbank.org/int/public-licenses#cc-by",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(reviewWorldBankIndicatorMetadata("SP.POP.TOTL", metadata)).toBeNull();
  });

  it("builds a bounded search-index refresh for only the imported assets", () => {
    const sql = rebuildSelectedAssetSearchTrigramsSql(["asset_worldbank_one", "asset_'two"]);

    expect(sql).toContain(
      "DELETE FROM asset_search_trigrams WHERE asset_id IN ('asset_worldbank_one', 'asset_''two')",
    );
    expect(sql).toContain("WHERE id IN ('asset_worldbank_one', 'asset_''two')");
    expect(sql).not.toContain("DELETE FROM asset_search_trigrams;");
  });
});
