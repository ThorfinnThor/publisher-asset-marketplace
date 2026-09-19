import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildWorldBankSourceUrls,
  WorldBankSourceClient,
  WorldBankSourceClientError,
} from "../src/lib/ingest/worldbank-source-client";

async function fixture(): Promise<unknown> {
  return JSON.parse(await readFile(resolve("test/fixtures/worldbank/indicator.json"), "utf8"));
}

describe("World Bank source client", () => {
  it("builds allow-listed indicator URLs", () => {
    expect(buildWorldBankSourceUrls("sp.sample")).toEqual({
      canonicalUrl: "https://data.worldbank.org/indicator/SP.SAMPLE",
      apiUrl:
        "https://api.worldbank.org/v2/country/all/indicator/SP.SAMPLE?format=json&per_page=400&mrnev=1",
      previewUrl: "https://data.worldbank.org/indicator/SP.SAMPLE",
    });
  });

  it("rejects malformed identifiers before fetching", () => {
    expect(() => buildWorldBankSourceUrls("https://evil.example/indicator/SP.POP.TOTL")).toThrow(
      "invalid World Bank indicator",
    );
  });

  it("normalizes bounded API data and keeps explicit rights evidence", async () => {
    const body = await fixture();
    const requests: string[] = [];
    const client = new WorldBankSourceClient({
      userAgent: "test-agent/1.0",
      fetchImpl: async (input, init) => {
        requests.push(`${String(input)}|${new Headers(init?.headers).get("user-agent")}`);
        return new Response(JSON.stringify(body), { status: 200 });
      },
    });

    const result = await client.fetchAsset("sp.sample");

    expect(result.normalized).toMatchObject({
      externalId: "SP.SAMPLE",
      title: "Sample indicator",
      citationText: "World Bank: Sample Indicator.",
      sourceUpdatedAt: "2024",
      embedUrl: null,
      licenseCode: "CC_BY",
    });
    expect(result.rightsEvidence.chart_license_explicit).toBe(true);
    expect(result.rightsEvidence).toMatchObject({
      embed_available: false,
      citation_only_allowed: false,
    });
    expect(result.raw.response[1]).toHaveLength(1);
    expect(requests[0]).toContain("test-agent/1.0");
  });

  it("fails closed on malformed or empty responses", async () => {
    const client = new WorldBankSourceClient({
      logger: () => undefined,
      fetchImpl: async () => new Response(JSON.stringify([{}, []]), { status: 200 }),
    });

    await expect(client.fetchAsset("SP.EMPTY")).rejects.toMatchObject({
      details: { code: "empty_data", indicator: "SP.EMPTY" },
    });
  });

  it("retries transient responses and preserves structured errors", async () => {
    let attempts = 0;
    const delays: number[] = [];
    const client = new WorldBankSourceClient({
      maxAttempts: 3,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) return new Response("busy", { status: 503 });
        return new Response(JSON.stringify(await fixture()), { status: 200 });
      },
    });

    await client.fetchAsset("SP.SAMPLE");
    expect(attempts).toBe(3);
    expect(delays).toEqual([250, 500]);
  });

  it("does not retry a permanent 404", async () => {
    let attempts = 0;
    const client = new WorldBankSourceClient({
      logger: () => undefined,
      fetchImpl: async () => {
        attempts += 1;
        return new Response("missing", { status: 404 });
      },
    });

    await expect(client.fetchAsset("SP.MISSING")).rejects.toBeInstanceOf(
      WorldBankSourceClientError,
    );
    expect(attempts).toBe(1);
  });

  it("keeps batch concurrency bounded and separates failures", async () => {
    let active = 0;
    let peak = 0;
    const client = new WorldBankSourceClient({
      concurrency: 2,
      fetchImpl: async (input) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        if (String(input).includes("MISSING")) return new Response("missing", { status: 404 });
        return new Response(JSON.stringify(await fixture()), { status: 200 });
      },
    });

    const result = await client.fetchAssets(["SP.ONE", "SP.TWO", "SP.MISSING"]);

    expect(peak).toBeLessThanOrEqual(2);
    expect(result.successful.map((asset) => asset.indicator)).toEqual(["SP.ONE", "SP.TWO"]);
    expect(result.failed[0]?.error.code).toBe("http_404");
  });
});
