import { describe, expect, it } from "vitest";

import {
  buildAssetRefreshSql,
  prepareAssetRefresh,
  selectRefreshCandidates,
  writeAssetRefresh,
  type RefreshAssetRow,
} from "../src/lib/ingest/refresh-runner";
import type { OwidAssetFetch } from "../src/lib/ingest/owid-source-client";

const now = "2026-09-14T12:00:00.000Z";

function row(slug: string, overrides: Partial<RefreshAssetRow> = {}): RefreshAssetRow {
  return {
    id: `asset_${slug}`,
    source_id: "source_owid",
    slug,
    title: slug,
    rights_status: "unknown",
    status: "draft",
    source_updated_at: "2022-01-01",
    last_checked_at: "2026-09-12T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    metadata_json: JSON.stringify({
      metadata: {
        chart: { title: slug, subtitle: "Description" },
        columns: {},
      },
      indicators: [{ url: "https://example.test/indicator" }],
      rights_evidence: {
        chart_owner: null,
        chart_license_explicit: false,
        manual_review_completed: false,
        evidence_url: "https://example.test/evidence",
        evidence_checked_at: now,
      },
    }),
    rights_json: JSON.stringify({
      embed_allowed: true,
      commercial_use: null,
      modification_allowed: null,
      citation_required: null,
      raw_data_redistribution: true,
      share_alike: null,
      attribution_required: null,
      evidence_url: "https://example.test/evidence",
      evidence_checked_at: now,
    }),
    ...overrides,
  };
}

const fetched: OwidAssetFetch = {
  slug: "stale-chart",
  urls: {
    canonicalUrl: "https://ourworldindata.org/grapher/stale-chart",
    metadataUrl: "https://ourworldindata.org/grapher/stale-chart.metadata.json",
    configUrl: "https://ourworldindata.org/grapher/stale-chart.config.json",
    embedUrl: "https://ourworldindata.org/grapher/stale-chart?embed=1",
    previewUrl: "https://ourworldindata.org/grapher/stale-chart.png?imType=thumbnail&imWidth=640",
  },
  metadata: {
    chart: { title: "Stale chart", subtitle: "Updated description" },
    columns: { Value: { lastUpdated: "2026-09-01", nextUpdate: "2027-01-01" } },
  },
  config: { id: 1, slug: "stale-chart", title: "Stale chart" },
  indicators: [
    {
      url: "https://api.ourworldindata.org/v1/indicators/1.metadata.json",
      metadata: {
        id: 1,
        nonRedistributable: false,
        origins: [],
      },
    },
  ],
  normalized: {
    externalId: "1",
    title: "Stale chart",
    description: "Updated description",
    citationText: null,
    sourceUpdatedAt: "2026-09-01",
    canonicalUrl: "https://ourworldindata.org/grapher/stale-chart",
    embedUrl: "https://ourworldindata.org/grapher/stale-chart?embed=1",
    previewUrl: "https://ourworldindata.org/grapher/stale-chart.png?imType=thumbnail&imWidth=640",
    assetType: "chart",
    licenseCode: null,
    sourcePolicyUrl: "https://ourworldindata.org/faqs",
  },
  raw: {
    metadata: {
      chart: { title: "Stale chart", subtitle: "Updated description" },
      columns: { Value: { lastUpdated: "2026-09-01", nextUpdate: "2027-01-01" } },
    },
    config: { id: 1, slug: "stale-chart", title: "Stale chart" },
    indicators: [],
  },
};

describe("asset refresh runner", () => {
  it("selects only stale assets outside the check interval", () => {
    const candidates = selectRefreshCandidates(
      [
        row("stale", { last_checked_at: "2026-09-12T00:00:00.000Z" }),
        row("recent", {
          source_updated_at: "2022-01-01",
          last_checked_at: "2026-09-14T11:00:00.000Z",
        }),
        row("fresh", { source_updated_at: "2026-09-01" }),
        row("hidden", { status: "hidden" }),
      ],
      { now, min_check_interval_hours: 24 },
    );
    expect(candidates.map((candidate) => candidate.slug)).toEqual(["stale"]);
  });

  it("refreshes successful assets while preserving prior publication status", async () => {
    const plan = await prepareAssetRefresh([row("stale-chart", { status: "review" })], {
      now,
      run_id: "refresh_test_1",
      source_client: { fetchAssets: async () => ({ successful: [fetched], failed: [] }) },
    });

    expect(plan.status).toBe("succeeded");
    expect(plan.counts).toEqual({ candidates: 1, refreshed: 1, hidden: 0, errors: 0 });
    expect(plan.updates[0]?.refreshed.status).toBe("review");
    expect(plan.updates[0]?.refreshed.source_updated_at).toBe("2026-09-01");
    expect(buildAssetRefreshSql(plan)).toContain("INSERT INTO refresh_results");
  });

  it("hides only HTTP 404 sources and keeps transient failures retryable", async () => {
    const plan = await prepareAssetRefresh([row("deleted"), row("temporarily-down")], {
      now,
      run_id: "refresh_test_2",
      source_client: {
        fetchAssets: async () => ({
          successful: [],
          failed: [
            {
              slug: "deleted",
              error: {
                slug: "deleted",
                endpoint: "metadata",
                code: "http_404",
                message: "not found",
                status: 404,
                attempts: 3,
              },
            },
            {
              slug: "temporarily-down",
              error: {
                slug: "temporarily-down",
                endpoint: "metadata",
                code: "http_503",
                message: "unavailable",
                status: 503,
                attempts: 3,
              },
            },
          ],
        }),
      },
    });

    expect(plan.hidden.map((asset) => asset.slug)).toEqual(["deleted"]);
    expect(plan.failed.map((asset) => asset.slug)).toEqual(["temporarily-down"]);
    expect(plan.status).toBe("partial");
  });

  it("writes refresh history and updates last_checked_at for failures", async () => {
    const calls: string[] = [];
    const db = {
      prepare(sql: string) {
        calls.push(sql.trim().split("\n")[0] ?? sql);
        return {
          bind: (...values: unknown[]) => {
            calls.push(`bind:${values.length}`);
            return { run: async () => ({ success: true }) };
          },
        };
      },
      batch: async (statements: unknown[]) => {
        calls.push(`batch:${statements.length}`);
        return statements;
      },
    } as unknown as D1Database;
    const plan = await prepareAssetRefresh([row("stale")], {
      now,
      run_id: "refresh_test_3",
      source_client: {
        fetchAssets: async () => ({
          successful: [],
          failed: [
            {
              slug: "stale",
              error: {
                slug: "stale",
                endpoint: "metadata",
                code: "http_503",
                message: "unavailable",
                status: 503,
                attempts: 3,
              },
            },
          ],
        }),
      },
    });
    const result = await writeAssetRefresh(db, plan);

    expect(result.database_written).toBe(true);
    expect(calls.some((call) => call.includes("refresh_results"))).toBe(true);
    expect(calls.some((call) => call.includes("last_checked_at"))).toBe(true);
  });
});
