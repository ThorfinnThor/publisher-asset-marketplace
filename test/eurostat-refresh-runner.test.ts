import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { buildEurostatImportAssetRecord } from "../src/lib/ingest/eurostat-import-runner";
import {
  prepareEurostatRefresh,
  selectEurostatRefreshCandidates,
  type EurostatRefreshAssetRow,
} from "../src/lib/ingest/eurostat-refresh-runner";
import { EurostatSourceClient } from "../src/lib/ingest/eurostat-source-client";

async function sampleRow(): Promise<{
  row: EurostatRefreshAssetRow;
  client: EurostatSourceClient;
}> {
  const body = await readFile(resolve("test/fixtures/eurostat/tps00001.json"), "utf8");
  const client = new EurostatSourceClient({ fetchImpl: async () => new Response(body) });
  const fetched = await client.fetchAsset("tps00001");
  const record = buildEurostatImportAssetRecord(fetched, "2026-08-01T00:00:00.000Z");
  return {
    client,
    row: {
      id: record.id,
      source_id: record.source_id,
      external_id: record.external_id,
      slug: record.slug,
      title: record.title,
      rights_status: record.rights_status,
      status: record.status,
      source_updated_at: record.source_updated_at,
      last_checked_at: record.last_checked_at,
      created_at: record.created_at,
      metadata_json: record.metadata_json,
      rights_json: record.rights_json,
      canonical_url: record.canonical_url,
      citation_text: record.citation_text,
      attribution_name: record.attribution_name,
      attribution_url: record.attribution_url,
    },
  };
}

describe("Eurostat refresh runner", () => {
  it("selects stale draft assets deterministically", async () => {
    const { row } = await sampleRow();
    expect(
      selectEurostatRefreshCandidates([row], {
        now: "2026-09-17T00:00:00.000Z",
        stale_after_days: 30,
      }),
    ).toEqual([row]);
  });

  it("revalidates an asset and keeps it in draft until rights review", async () => {
    const { row, client } = await sampleRow();
    const plan = await prepareEurostatRefresh([row], {
      now: "2026-09-17T00:00:00.000Z",
      run_id: "refresh_eurostat_test_1",
      source_client: { fetchAssets: client.fetchAssets.bind(client) },
      stale_after_days: 30,
    });

    expect(plan.status).toBe("succeeded");
    expect(plan.counts.refreshed).toBe(1);
    expect(plan.updates[0]?.refreshed).toMatchObject({
      id: row.id,
      status: "draft",
      rights_status: "unknown",
      source_updated_at: "2026-07-21T23:00:00+02:00",
    });
    expect(plan.results[0]?.reason_code).toBe("source_revalidated");
  });
});
