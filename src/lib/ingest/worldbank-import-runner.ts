import {
  buildImportSql,
  buildSourceImportAssetRecord,
  type ImportPlan,
  type ImportResultRecord,
  type SourceAssetRecordInput,
  writeImport,
} from "./import-runner";
import {
  WorldBankSourceClient,
  type WorldBankAssetFetch,
  type WorldBankBatchResult,
} from "./worldbank-source-client";

const DEFAULT_SOURCE_ID = "source_worldbank";

export type WorldBankImportPlan = ImportPlan & {
  indicators: string[];
  fetched: WorldBankBatchResult;
};

export type WorldBankImportOptions = {
  source_id?: string;
  now?: string;
  run_id?: string;
  source_client?: Pick<WorldBankSourceClient, "fetchAssets">;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createRunId(startedAt: string): string {
  const compact = startedAt.replace(/[^0-9]/g, "").slice(0, 17);
  return `ingest_worldbank_${compact}_${crypto.randomUUID().slice(0, 8)}`;
}

function createAssetId(indicator: string): string {
  return `asset_worldbank_${indicator.toLocaleLowerCase("en")}`;
}

function detailJson(value: unknown): string {
  return JSON.stringify(value);
}

function toSourceAssetInput(
  asset: WorldBankAssetFetch,
  checkedAt: string,
  sourceId: string,
): SourceAssetRecordInput {
  const rightsEvidence = {
    ...asset.rightsEvidence,
    evidence_checked_at: checkedAt,
  };
  return {
    id: createAssetId(asset.indicator),
    source_id: sourceId,
    external_id: asset.normalized.externalId,
    slug: `worldbank-${asset.indicator.toLocaleLowerCase("en")}`,
    asset_type: asset.normalized.assetType,
    title: asset.normalized.title,
    description: asset.normalized.description,
    canonical_url: asset.normalized.canonicalUrl,
    embed_url: asset.normalized.embedUrl,
    preview_url: asset.normalized.previewUrl,
    citation_text: asset.normalized.citationText,
    attribution_name: asset.normalized.attributionName,
    attribution_url: asset.normalized.attributionUrl,
    published_at: null,
    source_updated_at: asset.normalized.sourceUpdatedAt,
    metadata: {
      source: "worldbank",
      indicator: asset.indicator,
      urls: asset.urls,
      header: asset.header,
      rows: asset.rows,
      policy_url: "https://data.worldbank.org/summary-terms-of-use",
    },
    rights_evidence: rightsEvidence,
    search_terms: ["dataset", "World Bank Open Data", asset.indicator],
  };
}

function resultId(runId: string, index: number): string {
  return `ingest_result_${runId}_${index}`;
}

export function buildWorldBankImportAssetRecord(
  asset: WorldBankAssetFetch,
  checkedAt: string,
  sourceId = DEFAULT_SOURCE_ID,
) {
  return buildSourceImportAssetRecord(toSourceAssetInput(asset, checkedAt, sourceId), checkedAt);
}

export async function prepareWorldBankImport(
  indicators: string[],
  options: WorldBankImportOptions = {},
): Promise<WorldBankImportPlan> {
  const startedAt = options.now ?? nowIso();
  const completedAt = options.now ?? nowIso();
  const runId = options.run_id ?? createRunId(startedAt);
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const sourceClient = options.source_client ?? new WorldBankSourceClient({ concurrency: 4 });
  const fetched = await sourceClient.fetchAssets(indicators);
  const assets = fetched.successful.map((asset) =>
    buildWorldBankImportAssetRecord(asset, completedAt, sourceId),
  );
  const results: ImportResultRecord[] = [];
  let resultIndex = 0;
  for (const asset of assets) {
    results.push({
      id: resultId(runId, resultIndex++),
      external_id: asset.external_id,
      status: "upserted",
      reason_code: null,
      detail_json: detailJson({
        indicator: asset.external_id,
        rights_status: asset.rights_status,
        embed_url: asset.embed_url,
      }),
      created_at: completedAt,
    });
  }
  for (const failure of fetched.failed) {
    results.push({
      id: resultId(runId, resultIndex++),
      external_id: failure.indicator,
      status: "failed",
      reason_code: failure.error.code,
      detail_json: detailJson(failure.error),
      created_at: completedAt,
    });
  }
  const errors = fetched.failed.length;
  return {
    run_id: runId,
    source_id: sourceId,
    started_at: startedAt,
    completed_at: completedAt,
    status: errors === 0 ? "succeeded" : assets.length > 0 ? "partial" : "failed",
    indicators,
    fetched,
    assets,
    results,
    counts: {
      accepted: assets.length,
      duplicates: 0,
      invalid: 0,
      errors,
    },
  };
}

export async function writeWorldBankImport(
  db: D1Database,
  plan: WorldBankImportPlan,
  batchSize?: number,
) {
  return writeImport(db, plan, batchSize);
}

export function buildWorldBankImportSql(
  plan: WorldBankImportPlan,
  options: { rebuildSearchIndex?: boolean } = {},
): string {
  return buildImportSql(plan, options);
}
