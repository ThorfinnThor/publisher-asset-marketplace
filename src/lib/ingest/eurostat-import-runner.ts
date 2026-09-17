import {
  buildSourceImportAssetRecord,
  buildImportSql,
  type ImportPlan,
  type ImportResultRecord,
  type SourceAssetRecordInput,
  writeImport,
} from "./import-runner";
import {
  EUROSTAT_POLICY_URL,
  EurostatSourceClient,
  type EurostatAssetFetch,
  type EurostatBatchResult,
} from "./eurostat-source-client";

const DEFAULT_SOURCE_ID = "source_eurostat";

export type EurostatImportPlan = ImportPlan & {
  datasetCodes: string[];
  fetched: EurostatBatchResult;
};

export type EurostatImportOptions = {
  source_id?: string;
  now?: string;
  run_id?: string;
  source_client?: Pick<EurostatSourceClient, "fetchAssets">;
};

function nowIso(): string {
  return new Date().toISOString();
}

function createRunId(startedAt: string): string {
  const compact = startedAt.replace(/[^0-9]/g, "").slice(0, 17);
  return `ingest_eurostat_${compact}_${crypto.randomUUID().slice(0, 8)}`;
}

function createAssetId(datasetCode: string): string {
  return `asset_eurostat_${datasetCode}`;
}

function detailJson(value: unknown): string {
  return JSON.stringify(value);
}

function toSourceAssetInput(
  asset: EurostatAssetFetch,
  checkedAt: string,
  sourceId: string,
): SourceAssetRecordInput {
  const rightsEvidence = { ...asset.rightsEvidence, evidence_checked_at: checkedAt };
  return {
    id: createAssetId(asset.datasetCode),
    source_id: sourceId,
    external_id: asset.normalized.externalId,
    slug: `eurostat-${asset.datasetCode}`,
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
      source: "eurostat",
      dataset_code: asset.datasetCode,
      api_url: asset.urls.apiUrl,
      selector: asset.urls.selector,
      title: asset.title,
      updated: asset.updated,
      dimensions: asset.dimensions,
      observation_count: asset.observationCount,
      observations: asset.observations,
      policy_url: EUROSTAT_POLICY_URL,
      policy_fingerprint: asset.policyFingerprint,
    },
    rights_evidence: rightsEvidence,
    search_terms: ["dataset", "Eurostat", asset.datasetCode],
  };
}

function resultId(runId: string, index: number): string {
  return `ingest_result_${runId}_${index}`;
}

export function buildEurostatImportAssetRecord(
  asset: EurostatAssetFetch,
  checkedAt: string,
  sourceId = DEFAULT_SOURCE_ID,
) {
  return buildSourceImportAssetRecord(toSourceAssetInput(asset, checkedAt, sourceId), checkedAt);
}

export async function prepareEurostatImport(
  datasetCodes: string[],
  options: EurostatImportOptions = {},
): Promise<EurostatImportPlan> {
  const startedAt = options.now ?? nowIso();
  const completedAt = options.now ?? nowIso();
  const runId = options.run_id ?? createRunId(startedAt);
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const sourceClient = options.source_client ?? new EurostatSourceClient();
  const fetched = await sourceClient.fetchAssets(datasetCodes);
  return buildEurostatImportPlan(datasetCodes, fetched, {
    ...options,
    now: completedAt,
    run_id: runId,
    source_id: sourceId,
  });
}

export function buildEurostatImportPlan(
  datasetCodes: string[],
  fetched: EurostatBatchResult,
  options: Pick<EurostatImportOptions, "source_id" | "now" | "run_id"> = {},
): EurostatImportPlan {
  const startedAt = options.now ?? nowIso();
  const completedAt = options.now ?? nowIso();
  const runId = options.run_id ?? createRunId(startedAt);
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const assets = fetched.successful.map((asset) =>
    buildEurostatImportAssetRecord(asset, completedAt, sourceId),
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
        dataset_code: asset.external_id,
        rights_status: asset.rights_status,
        embed_url: asset.embed_url,
      }),
      created_at: completedAt,
    });
  }
  for (const failure of fetched.failed) {
    results.push({
      id: resultId(runId, resultIndex++),
      external_id: failure.datasetCode,
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
    datasetCodes,
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

export async function writeEurostatImport(
  db: D1Database,
  plan: EurostatImportPlan,
  batchSize?: number,
) {
  return writeImport(db, plan, batchSize);
}

export function buildEurostatImportSql(plan: EurostatImportPlan): string {
  return buildImportSql(plan);
}
