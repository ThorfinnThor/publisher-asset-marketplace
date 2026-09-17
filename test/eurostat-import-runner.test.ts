import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEurostatImportAssetRecord,
  buildEurostatImportSql,
  prepareEurostatImport,
} from "../src/lib/ingest/eurostat-import-runner";
import {
  EurostatSourceClient,
  type EurostatAssetFetch,
} from "../src/lib/ingest/eurostat-source-client";

async function sampleAsset(): Promise<EurostatAssetFetch> {
  const body = await readFile(resolve("test/fixtures/eurostat/tps00001.json"), "utf8");
  const client = new EurostatSourceClient({ fetchImpl: async () => new Response(body) });
  return client.fetchAsset("tps00001");
}

describe("Eurostat import runner", () => {
  it("maps pilot data into a non-published draft with unknown rights", async () => {
    const asset = await sampleAsset();
    const record = buildEurostatImportAssetRecord(asset, "2026-09-17T00:00:00.000Z");

    expect(record).toMatchObject({
      id: "asset_eurostat_tps00001",
      source_id: "source_eurostat",
      slug: "eurostat-tps00001",
      asset_type: "dataset",
      embed_url: null,
      preview_url: null,
      status: "draft",
      rights_status: "unknown",
      license_code: null,
    });
    expect(JSON.parse(record.rights_json)).toMatchObject({
      embed_allowed: null,
      commercial_use: null,
      raw_data_redistribution: null,
    });
    expect(JSON.parse(record.metadata_json).observations).toHaveLength(3);
  });

  it("creates an idempotent dry-run plan for all three pilot datasets", async () => {
    const client = new EurostatSourceClient({
      fetchImpl: async (input) => {
        const code =
          String(input).match(/data\/(tps00001|nama_10_gdp|une_rt_a)/)?.[1] ?? "tps00001";
        const body = await readFile(resolve(`test/fixtures/eurostat/${code}.json`), "utf8");
        return new Response(body);
      },
    });
    const plan = await prepareEurostatImport(["tps00001", "nama_10_gdp", "une_rt_a"], {
      now: "2026-09-17T00:00:00.000Z",
      run_id: "ingest_eurostat_test_1",
      source_client: client,
    });

    expect(plan.status).toBe("succeeded");
    expect(plan.counts.accepted).toBe(3);
    expect(plan.assets.every((asset) => asset.status === "draft")).toBe(true);
    expect(buildEurostatImportSql(plan)).toContain("asset_eurostat_tps00001");
    expect(buildEurostatImportSql(plan)).toContain("source_eurostat");
  });
});
