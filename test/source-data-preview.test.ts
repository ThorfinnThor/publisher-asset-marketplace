import { describe, expect, it } from "vitest";

import { parseSourcePreview } from "../src/lib/assets/source-data-preview";

describe("source data previews", () => {
  it("parses reviewed Eurostat observations", () => {
    const preview = parseSourcePreview(
      JSON.stringify({
        source: "eurostat",
        dataset_code: "tps00001",
        dimensions: [{ id: "time", label: "Time" }],
        observations: [
          { labels: { time: "2020" }, coordinates: { time: "2020" }, value: 1234, status: "p" },
        ],
      }),
    );
    expect(preview).toMatchObject({ source: "eurostat", label: "tps00001" });
    expect(preview?.rows[0]).toMatchObject({ cells: ["2020"], value: "1,234", flag: "p" });
  });

  it("parses World Bank rows for a citation-only preview", () => {
    const preview = parseSourcePreview(
      JSON.stringify({
        source: "worldbank",
        indicator: "SP.POP.TOTL",
        rows: [{ date: "2025", country: { value: "Germany" }, value: 84_000_000 }],
      }),
    );
    expect(preview).toMatchObject({ source: "worldbank", label: "SP.POP.TOTL" });
    expect(preview?.rows[0]).toMatchObject({
      cells: ["2025", "Germany"],
      value: "84,000,000",
    });
  });

  it("fails closed for unrelated metadata", () => {
    expect(parseSourcePreview(JSON.stringify({ source: "owid" }))).toBeNull();
    expect(parseSourcePreview(null)).toBeNull();
  });
});
