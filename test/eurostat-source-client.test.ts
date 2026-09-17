import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEurostatSourceUrls,
  EurostatSourceClient,
  EurostatSourceClientError,
  parseEurostatCatalogue,
  selectEurostatCatalogueCandidates,
} from "../src/lib/ingest/eurostat-source-client";

async function fixture(code: string): Promise<string> {
  return readFile(resolve(`test/fixtures/eurostat/${code}.json`), "utf8");
}

describe("Eurostat source client", () => {
  it("builds URLs for valid Eurostat dataset codes", () => {
    expect(buildEurostatSourceUrls("TPS00001")).toMatchObject({
      canonicalUrl: "https://ec.europa.eu/eurostat/databrowser/view/tps00001/default/table?lang=en",
      apiUrl:
        "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tps00001?lang=en&geo=EU27_2020&sinceTimePeriod=2020",
      previewUrl: null,
      embedUrl: null,
    });
    expect(() => buildEurostatSourceUrls("ds-123")).toThrow("invalid Eurostat dataset code");
    expect(buildEurostatSourceUrls("unknown_dataset").apiUrl).toContain("unknown_dataset");
  });

  it("parses and conservatively filters the official catalogue TOC", () => {
    const catalogue = parseEurostatCatalogue(
      [
        '"title"\t"code"\t"type"\t"last update of data"\t"last table structure change"\t"data start"\t"data end"\t"values"',
        '"Title A"\t"table_a"\t"table"\t"17.09.2026"\t"17.09.2026"\t"2020"\t"2025"\t100',
        '"Comext item"\t"comext_a"\t"table"\t"17.09.2026"\t"17.09.2026"\t"2020"\t"2025"\t100',
        '"Folder"\t"folder"\t"folder"\t" "\t" "\t" "\t" "\t" "',
      ].join("\n"),
    );
    expect(catalogue).toHaveLength(3);
    expect(selectEurostatCatalogueCandidates(catalogue).map((entry) => entry.code)).toEqual([
      "table_a",
    ]);
  });

  it("parses JSON-stat dimensions and keeps Eurostat rights unknown", async () => {
    const client = new EurostatSourceClient({
      fetchImpl: async (input) => {
        expect(String(input)).toContain("tps00001");
        return new Response(await fixture("tps00001"), { status: 200 });
      },
    });

    const result = await client.fetchAsset("TPS00001");

    expect(result.normalized).toMatchObject({
      externalId: "tps00001",
      title: "Population on 1 January",
      assetType: "dataset",
      embedUrl: null,
      previewUrl: null,
      licenseCode: null,
    });
    expect(result.dimensions.map((dimension) => dimension.id)).toEqual(["freq", "geo", "time"]);
    expect(result.observations).toHaveLength(3);
    expect(result.observations[2]).toMatchObject({
      value: 446828803,
      status: "p",
      coordinates: { time: "2022" },
    });
    expect(result.rightsEvidence).toMatchObject({
      chart_license_code: "CUSTOM_OR_UNKNOWN",
      chart_license_explicit: false,
      embed_available: null,
      citation_only_allowed: true,
      manual_review_completed: false,
    });
  });

  it("rejects malformed JSON-stat and oversized responses without retrying", async () => {
    let attempts = 0;
    const client = new EurostatSourceClient({
      maxResponseBytes: 100,
      logger: () => undefined,
      fetchImpl: async () => {
        attempts += 1;
        return new Response("x".repeat(101), { status: 200 });
      },
    });
    await expect(client.fetchAsset("tps00001")).rejects.toMatchObject({
      details: { code: "response_too_large", attempts: 1 },
    });
    expect(attempts).toBe(1);

    const malformed = new EurostatSourceClient({
      logger: () => undefined,
      fetchImpl: async () => new Response(JSON.stringify({ class: "dataset" }), { status: 200 }),
    });
    await expect(malformed.fetchAsset("tps00001")).rejects.toBeInstanceOf(
      EurostatSourceClientError,
    );
  });

  it("retries transient responses and bounds batch concurrency", async () => {
    const attemptsByCode = new Map<string, number>();
    const delays: number[] = [];
    let active = 0;
    let peak = 0;
    const client = new EurostatSourceClient({
      concurrency: 2,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      fetchImpl: async (input) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        const code =
          String(input).match(/data\/(tps00001|nama_10_gdp|une_rt_a)/)?.[1] ?? "tps00001";
        const codeAttempts = (attemptsByCode.get(code) ?? 0) + 1;
        attemptsByCode.set(code, codeAttempts);
        if (code === "tps00001" && codeAttempts < 3) return new Response("busy", { status: 503 });
        return new Response(await fixture(code), { status: 200 });
      },
    });

    const result = await client.fetchAssets(["tps00001", "nama_10_gdp", "une_rt_a"]);
    expect(result.successful.map((asset) => asset.datasetCode)).toEqual([
      "nama_10_gdp",
      "tps00001",
      "une_rt_a",
    ]);
    expect(result.failed).toHaveLength(0);
    expect(peak).toBeLessThanOrEqual(2);
    expect(delays).toEqual([250, 500]);
  });
});
