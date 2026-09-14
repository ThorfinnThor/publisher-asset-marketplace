import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildOwidSourceUrls,
  OwidSourceClient,
  OwidSourceClientError,
} from "../src/lib/ingest/owid-source-client";

type FixtureJson = Record<string, unknown>;

async function fixture(name: string): Promise<FixtureJson> {
  const content = await readFile(resolve("test/fixtures/owid", name), "utf8");
  return JSON.parse(content) as FixtureJson;
}

describe("buildOwidSourceUrls", () => {
  it("builds the documented metadata and config endpoints", () => {
    expect(buildOwidSourceUrls("Sample-Chart")).toEqual({
      canonicalUrl: "https://ourworldindata.org/grapher/sample-chart",
      metadataUrl: "https://ourworldindata.org/grapher/sample-chart.metadata.json",
      configUrl: "https://ourworldindata.org/grapher/sample-chart.config.json",
      embedUrl: "https://ourworldindata.org/grapher/sample-chart?embed=1",
      previewUrl:
        "https://ourworldindata.org/grapher/sample-chart.png?imType=thumbnail&imWidth=640",
    });
  });

  it("rejects malformed slugs before making a request", () => {
    expect(() => buildOwidSourceUrls("sample/chart")).toThrow("invalid OWID slug");
  });
});

describe("OwidSourceClient", () => {
  it("normalizes metadata while preserving raw endpoint responses", async () => {
    const metadata = await fixture("sample.metadata.json");
    const config = await fixture("sample.config.json");
    const indicator = await fixture("sample.indicator.metadata.json");
    const requests: Array<{ url: string; userAgent: string | undefined }> = [];
    const client = new OwidSourceClient({
      fetchImpl: async (input, init) => {
        const url = String(input);
        requests.push({
          url,
          userAgent: new Headers(init?.headers).get("user-agent") ?? undefined,
        });
        const body = url.includes("api.ourworldindata.org")
          ? indicator
          : url.endsWith("metadata.json")
            ? metadata
            : config;
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      userAgent: "test-agent/1.0",
    });

    const result = await client.fetchAsset("sample-chart");

    expect(result.normalized).toMatchObject({
      externalId: "123",
      title: "Sample chart title",
      description: "A sample chart subtitle",
      citationText: "Sample source citation",
      sourceUpdatedAt: "2025-01-15",
      licenseCode: null,
      sourcePolicyUrl: "https://ourworldindata.org/faqs",
    });
    expect(result.raw.metadata).toEqual(metadata);
    expect(result.raw.config).toEqual(config);
    expect(result.raw.indicators).toEqual([
      {
        url: "https://api.ourworldindata.org/v1/indicators/456.metadata.json",
        metadata: indicator,
      },
    ]);
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.userAgent === "test-agent/1.0")).toBe(true);
  });

  it("retries a transient response with bounded backoff", async () => {
    let metadataAttempts = 0;
    const delays: number[] = [];
    const client = new OwidSourceClient({
      maxAttempts: 3,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      fetchImpl: async (input) => {
        if (String(input).endsWith("metadata.json")) {
          metadataAttempts += 1;
        }
        if (String(input).endsWith("metadata.json") && metadataAttempts < 3) {
          return new Response("busy", { status: 503 });
        }
        return new Response("{}", { status: 200 });
      },
    });

    await client.fetchAsset("sample-chart");

    expect(metadataAttempts).toBe(3);
    expect(delays).toEqual([250, 500]);
  });

  it("does not retry a permanent 404 and returns structured details", async () => {
    let attempts = 0;
    const events: string[] = [];
    const client = new OwidSourceClient({
      logger: (event) => events.push(`${event.event}:${event.code}`),
      fetchImpl: async () => {
        attempts += 1;
        return new Response("missing", { status: 404 });
      },
    });

    await expect(client.fetchAsset("missing-chart")).rejects.toMatchObject({
      details: {
        code: "http_404",
        endpoint: expect.stringMatching(/metadata|config/),
        attempts: 1,
      },
    });
    expect(attempts).toBe(2);
    expect(events).toContain("request_failed:http_404");
  });

  it("rejects indicator metadata URLs outside the documented OWID API path", async () => {
    const client = new OwidSourceClient({
      logger: () => undefined,
      fetchImpl: async (input) => {
        if (String(input).endsWith("metadata.json")) {
          return new Response(
            JSON.stringify({
              chart: { originalChartUrl: "https://ourworldindata.org/grapher/sample-chart" },
              columns: { one: { fullMetadata: "https://example.org/private.json" } },
            }),
            { status: 200 },
          );
        }
        return new Response("{}", { status: 200 });
      },
    });

    await expect(client.fetchAsset("sample-chart")).rejects.toMatchObject({
      details: {
        slug: "sample-chart",
        endpoint: "indicator",
        code: "invalid_indicator_url",
        attempts: 0,
      },
    });
  });

  it("keeps batch concurrency bounded and separates failures", async () => {
    let active = 0;
    let peak = 0;
    const client = new OwidSourceClient({
      concurrency: 2,
      fetchImpl: async (input) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        if (String(input).includes("broken")) {
          return new Response("missing", { status: 404 });
        }
        return new Response("{}", { status: 200 });
      },
    });

    const result = await client.fetchAssets(["one", "two", "broken"]);

    expect(peak).toBeLessThanOrEqual(2);
    expect(result.successful.map((asset) => asset.slug)).toEqual(["one", "two"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.error.code).toBe("http_404");
  });

  it("exposes client errors for callers that need structured handling", () => {
    const error = new OwidSourceClientError({
      slug: "sample-chart",
      endpoint: "metadata",
      code: "timeout",
      message: "timed out",
      attempts: 3,
    });
    expect(error.details.code).toBe("timeout");
  });
});
