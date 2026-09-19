import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/design-system", () => ({
  ChartPreview: () => createElement("div", null, "Interface sample"),
}));

vi.mock("@/components/worldbank-data-chart", () => ({
  WorldBankDataChart: () => createElement("div", null, "Live World Bank preview"),
}));

import { AssetPreview } from "../src/components/asset-preview";

describe("asset preview fallback", () => {
  it("routes World Bank assets to the live data preview", () => {
    const html = renderToStaticMarkup(
      createElement(AssetPreview, {
        compact: true,
        metadataJson: JSON.stringify({
          source: "worldbank",
          indicator: "SP.POP.TOTL",
          rows: [{ date: "2025", country: { value: "Germany" }, value: 84_000_000 }],
        }),
        previewUrl: null,
        title: "Population, total",
        variant: "bars",
      }),
    );

    expect(html).toContain("Live World Bank preview");
    expect(html).not.toContain("Interface sample");
  });

  it("shows a clear source-data state instead of an empty panel", () => {
    const html = renderToStaticMarkup(
      createElement(AssetPreview, {
        compact: true,
        metadataJson: JSON.stringify({
          source: "eurostat",
          dataset_code: "demo_pjan",
          dimensions: [{ id: "time", label: "Time" }],
          observations: [{ labels: { time: "2025" }, value: null }],
        }),
        previewUrl: null,
        title: "Population on 1 January",
        variant: "bars",
      }),
    );

    expect(html).toContain("Preview unavailable");
    expect(html).toContain("No non-empty source observations");
    expect(html).not.toContain("Interface sample");
  });

  it("keeps the interface sample for assets without source metadata", () => {
    const html = renderToStaticMarkup(
      createElement(AssetPreview, {
        compact: true,
        metadataJson: null,
        previewUrl: null,
        title: "Creator calculator",
        variant: "line",
      }),
    );

    expect(html).toContain("Interface sample");
  });
});
