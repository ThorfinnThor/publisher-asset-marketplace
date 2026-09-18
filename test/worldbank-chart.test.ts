import { describe, expect, it } from "vitest";

import {
  parseWorldBankApiPoints,
  parseWorldBankIndicator,
  parseWorldBankMetadataPoints,
  parseWorldBankPreviewPoints,
} from "../src/lib/assets/worldbank-chart";

describe("World Bank chart data", () => {
  it("extracts and validates the indicator", () => {
    expect(
      parseWorldBankIndicator(
        JSON.stringify({ source: "worldbank", indicator: "fb.bnk.capa.zs" }),
        "https://data.worldbank.org/indicator/ignored",
      ),
    ).toBe("FB.BNK.CAPA.ZS");
    expect(parseWorldBankIndicator(null, "https://data.worldbank.org/indicator/SP.POP.TOTL")).toBe(
      "SP.POP.TOTL",
    );
    expect(parseWorldBankIndicator(null, "https://example.com/indicator/SP.POP.TOTL")).toBeNull();
  });

  it("selects real preferred-country observations from the API response", () => {
    const points = parseWorldBankApiPoints([
      { page: 1 },
      [
        countryRow("France", "FRA", "2025", 4),
        countryRow("Germany", "DEU", "2024", 8.5),
        countryRow("United States", "USA", "2025", 11),
        countryRow("Germany", "DEU", "2023", 7),
        countryRow("Empty", "EMP", "2025", null),
      ],
    ]);
    expect(points).toEqual([
      { country: "United States", iso3: "USA", date: "2025", value: 11 },
      { country: "Germany", iso3: "DEU", date: "2024", value: 8.5 },
      { country: "France", iso3: "FRA", date: "2025", value: 4 },
    ]);
  });

  it("uses stored World Bank rows as an immediate real-data fallback", () => {
    const points = parseWorldBankMetadataPoints(
      JSON.stringify({
        source: "worldbank",
        rows: [countryRow("Japan", "JPN", "2025", 42)],
      }),
    );
    expect(points).toEqual([{ country: "Japan", iso3: "JPN", date: "2025", value: 42 }]);
  });

  it("validates the bounded same-origin preview response", () => {
    expect(
      parseWorldBankPreviewPoints({
        points: [
          { country: "Germany", iso3: "deu", date: "2025", value: 8.2 },
          { country: "Invalid", iso3: "XX", date: "2025", value: 1 },
        ],
      }),
    ).toEqual([{ country: "Germany", iso3: "DEU", date: "2025", value: 8.2 }]);
  });
});

function countryRow(country: string, iso3: string, date: string, value: number | null) {
  return { country: { value: country }, countryiso3code: iso3, date, value };
}
