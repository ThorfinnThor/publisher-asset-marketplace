import { describe, expect, it } from "vitest";

import {
  eurostatStatusLabels,
  flattenEditorialEurostat,
  parseEditorialCsv,
  parseOwidEditorialFacts,
} from "../src/lib/editorial/source-parsers";
import { isEditorialRightsEligible } from "../src/lib/editorial/rights-gate";

describe("editorial source parsers", () => {
  it("parses quoted commas, escaped quotes, and multiline CSV fields with source line numbers", () => {
    const parsed = parseEditorialCsv(
      'Entity,Code,Year,Value\n"A, \"\"quoted\"\"\nplace",AAA,2020,1\nB,BBB,2021,2\n',
    );

    expect(parsed.rows).toEqual([
      ["Entity", "Code", "Year", "Value"],
      ['A, "quoted"\nplace', "AAA", "2020", "1"],
      ["B", "BBB", "2021", "2"],
    ]);
    expect(parsed.lineNumbers).toEqual([1, 2, 4]);
  });

  it("rejects malformed CSV rows and unclosed quotes", () => {
    expect(() => parseEditorialCsv("a,b\n1,2,3\n")).toThrow("csv_row_width_mismatch");
    expect(() => parseEditorialCsv('a,b\n"unfinished,1\n')).toThrow("csv_unclosed_quote");
  });

  it("keeps OWID values, units, and missing markers tied to their original row", () => {
    const facts = parseOwidEditorialFacts("Entity,Code,Year,Value\nA,AAA,2020,42\nA,AAA,2021,\n", {
      expectedHeaders: ["Entity", "Code", "Year", "Value"],
      metadataColumnByCsvHeader: { Value: "value" },
      metadata: { columns: { value: { shortName: "metric", unit: "% of population" } } },
      briefId: "test",
    });

    expect(
      facts.map(({ value, unit, missing_value, source_row_reference }) => ({
        value,
        unit,
        missing_value,
        source_row_reference,
      })),
    ).toEqual([
      {
        value: 42,
        unit: "% of population",
        missing_value: false,
        source_row_reference: "csv-line:2;column:Value",
      },
      {
        value: null,
        unit: "% of population",
        missing_value: true,
        source_row_reference: "csv-line:3;column:Value",
      },
    ]);
  });

  it("expands sparse Eurostat JSON-stat cubes into explicit missing facts and retains flags", () => {
    const data = {
      id: ["freq", "nrg_bal", "unit", "geo", "time"],
      size: [1, 2, 1, 1, 2],
      dimension: {
        freq: { category: { index: { A: 0 }, label: { A: "Annual" } } },
        nrg_bal: {
          category: {
            index: { REN: 0, REN_TRA: 1 },
            label: { REN: "Total", REN_TRA: "Transport" },
          },
        },
        unit: { category: { index: { PC: 0 }, label: { PC: "Percentage" } } },
        geo: {
          category: {
            index: { EU27_2020: 0 },
            label: { EU27_2020: "European Union - 27 countries" },
          },
        },
        time: { category: { index: { 2024: 0, 2025: 1 }, label: { 2024: "2024", 2025: "2025" } } },
      },
      value: { "0": 25.2, "1": 26.2, "2": 11.2 },
      status: { "1": "p" },
      extension: { status: { label: { p: "provisional" } } },
    };
    const facts = flattenEditorialEurostat(data, {
      expectedDimensions: ["freq", "nrg_bal", "unit", "geo", "time"],
      allowedGeoCodes: ["EU27_2020"],
      briefId: "test",
    });

    expect(facts).toHaveLength(4);
    expect(
      facts.map((fact) => [fact.dimensions.nrg_bal, fact.period, fact.value, fact.missing_value]),
    ).toEqual([
      ["REN", "2024", 25.2, false],
      ["REN", "2025", 26.2, false],
      ["REN_TRA", "2024", 11.2, false],
      ["REN_TRA", "2025", null, true],
    ]);
    expect(facts[1]?.status_quality_flag).toBe("p");
    expect(eurostatStatusLabels(data)).toEqual({ p: "provisional" });
  });

  it("applies explicit Eurostat sector and period selections and fails on geography drift", () => {
    const data = {
      id: ["freq", "nrg_bal", "unit", "geo", "time"],
      size: [1, 2, 1, 1, 2],
      dimension: {
        freq: { category: { index: ["A"] } },
        nrg_bal: { category: { index: ["REN", "OTHER"] } },
        unit: { category: { index: ["PC"] } },
        geo: { category: { index: ["EU27_2020"] } },
        time: { category: { index: ["2024", "2025"] } },
      },
      value: [1, 2, 3, 4],
    };
    const config = {
      expectedDimensions: ["freq", "nrg_bal", "unit", "geo", "time"],
      allowedGeoCodes: ["EU27_2020"],
      briefId: "test",
      allowedDimensionValues: { nrg_bal: ["REN"] },
      excludedPeriods: ["2025"],
    };

    expect(flattenEditorialEurostat(data, config)).toHaveLength(1);
    expect(() => flattenEditorialEurostat(data, { ...config, allowedGeoCodes: ["DE"] })).toThrow(
      "eurostat_geo_scope_mismatch",
    );
    expect(() => flattenEditorialEurostat({ ...data, value: { "0": 1, "9": 9 } }, config)).toThrow(
      "eurostat_value_index_invalid",
    );
  });
});

describe("editorial rights gate", () => {
  const allowed = {
    published: true,
    commercial_use: ["Allowed"],
    modification: ["Allowed"],
    raw_data_redistribution: ["Allowed"],
    citation: ["Required"],
  };

  it("requires a published asset and unambiguous rights for every reuse dimension", () => {
    expect(isEditorialRightsEligible(allowed)).toBe(true);
    expect(isEditorialRightsEligible({ ...allowed, published: false })).toBe(false);
    expect(
      isEditorialRightsEligible({ ...allowed, raw_data_redistribution: ["Allowed", "Unknown"] }),
    ).toBe(false);
    expect(isEditorialRightsEligible({ ...allowed, modification: ["Not allowed"] })).toBe(false);
    expect(isEditorialRightsEligible({ ...allowed, citation: ["Unknown"] })).toBe(false);
    expect(isEditorialRightsEligible(undefined)).toBe(false);
  });
});
