import { describe, expect, it } from "vitest";

import { normalizeOwidInput } from "../src/lib/ingest/normalize-input";

describe("normalizeOwidInput", () => {
  it("normalizes URLs, strips query parameters, and deduplicates slugs", () => {
    const report = normalizeOwidInput(
      [
        "https://ourworldindata.org/grapher/life-expectancy?tab=chart",
        "life-expectancy",
        "https://www.ourworldindata.org/grapher/population/",
      ].join("\n"),
      "txt",
    );

    expect(report.accepted).toEqual([
      {
        line: 1,
        input: "https://ourworldindata.org/grapher/life-expectancy?tab=chart",
        slug: "life-expectancy",
        canonicalUrl: "https://ourworldindata.org/grapher/life-expectancy",
      },
      {
        line: 3,
        input: "https://www.ourworldindata.org/grapher/population/",
        slug: "population",
        canonicalUrl: "https://ourworldindata.org/grapher/population",
      },
    ]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.invalid).toHaveLength(0);
  });

  it("rejects non-HTTPS, foreign hosts, malformed paths, and invalid slugs", () => {
    const report = normalizeOwidInput(
      [
        "http://ourworldindata.org/grapher/population",
        "https://example.com/grapher/population",
        "https://ourworldindata.org/explorers/population",
        "bad slug",
      ].join("\n"),
      "txt",
    );

    expect(report.accepted).toHaveLength(0);
    expect(report.invalid.map((item) => item.reason)).toEqual([
      "URL must use HTTPS",
      "URL must use the ourworldindata.org host",
      "URL must match /grapher/<slug>",
      "slug contains unsupported characters",
    ]);
  });

  it("reads the spreadsheet-derived CSV header without treating rights text as approval", () => {
    const report = normalizeOwidInput(
      [
        "ID,Title,Asset URL,Legal Status",
        '1,"Population, total",https://ourworldindata.org/grapher/population,GREEN',
      ].join("\n"),
      "csv",
    );

    expect(report.accepted).toEqual([
      {
        line: 2,
        input: "https://ourworldindata.org/grapher/population",
        title: "Population, total",
        slug: "population",
        canonicalUrl: "https://ourworldindata.org/grapher/population",
      },
    ]);
  });

  it("accepts JSON strings and objects", () => {
    const report = normalizeOwidInput(
      JSON.stringify([
        "population",
        {
          asset_url: "https://ourworldindata.org/grapher/life-expectancy",
          title: "Life expectancy",
        },
      ]),
      "json",
    );

    expect(report.accepted.map((item) => item.slug)).toEqual(["population", "life-expectancy"]);
  });

  it("accepts an OWID slug ending in a hyphen", () => {
    const report = normalizeOwidInput(
      "https://ourworldindata.org/grapher/mean-income-or-consumption-per-day-2017-vs-2021-international-",
      "txt",
    );

    expect(report.invalid).toHaveLength(0);
    expect(report.accepted[0]?.slug).toBe(
      "mean-income-or-consumption-per-day-2017-vs-2021-international-",
    );
  });
});
