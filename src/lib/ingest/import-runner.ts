import { normalizeOwidInput, type NormalizeReport } from "./normalize-input";
import { OwidSourceClient, type OwidAssetFetch, type OwidBatchResult } from "./owid-source-client";
import { rebuildAssetSearchTrigrams, rebuildAssetSearchTrigramsSql } from "../search/search-index";
import {
  classifyRights,
  type IndicatorRightsEvidence,
  type RightsEvidence,
  type RightsClassification,
} from "../rights/classify-rights";
import { normalizeSupportedLicense } from "../rights/classify-rights";

const DEFAULT_SOURCE_ID = "source_owid";
const DEFAULT_BATCH_SIZE = 50;

export type ImportAssetRecord = {
  id: string;
  source_id: string;
  external_id: string | null;
  slug: string;
  asset_type: "chart" | "calculator" | "table" | "dataset" | "benchmark" | "widget";
  title: string;
  description: string;
  canonical_url: string;
  canonical_url_normalized: string;
  embed_url: string | null;
  preview_url: string | null;
  citation_text: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
  published_at: string | null;
  source_updated_at: string | null;
  license_code: string | null;
  rights_status: RightsClassification["rights_status"];
  rights_json: string;
  metadata_json: string;
  search_document: string;
  status: "draft" | "review" | "published" | "hidden";
  created_at: string;
  updated_at: string;
  last_checked_at: string;
};

export type SourceAssetRecordInput = {
  id: string;
  source_id: string;
  external_id: string | null;
  slug: string;
  asset_type: ImportAssetRecord["asset_type"];
  title: string;
  description: string;
  canonical_url: string;
  embed_url: string | null;
  preview_url: string | null;
  citation_text: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
  published_at: string | null;
  source_updated_at: string | null;
  metadata: Record<string, unknown>;
  rights_evidence: RightsEvidence;
  search_terms: string[];
};

export type ImportResultRecord = {
  id: string;
  external_id: string | null;
  status: "accepted" | "duplicate" | "invalid" | "failed" | "upserted";
  reason_code: string | null;
  detail_json: string | null;
  created_at: string;
};

export type ImportPlan = {
  run_id: string;
  source_id: string;
  started_at: string;
  completed_at: string;
  status: "succeeded" | "failed" | "partial";
  assets: ImportAssetRecord[];
  results: ImportResultRecord[];
  counts: {
    accepted: number;
    duplicates: number;
    invalid: number;
    errors: number;
  };
};

export type OwidImportPlan = ImportPlan & {
  normalize_report: NormalizeReport;
  fetched: OwidBatchResult;
};

export type ImportRunnerOptions = {
  source_id?: string;
  now?: string;
  run_id?: string;
  source_client?: Pick<OwidSourceClient, "fetchAssets">;
};

export type ImportRunResult = {
  plan: ImportPlan;
  database_written: boolean;
};

export type D1QueryParameter = string | number | null;

export type D1ParameterizedQuery = {
  sql: string;
  params: D1QueryParameter[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function createRunId(startedAt: string): string {
  const compact = startedAt.replace(/[^0-9]/g, "").slice(0, 17);
  return `ingest_owid_${compact}_${crypto.randomUUID().slice(0, 8)}`;
}

function createAssetId(slug: string): string {
  return `asset_owid_${slug}`;
}

function firstOrigin(asset: OwidAssetFetch): {
  attributionName: string | null;
  attributionUrl: string | null;
  publishedAt: string | null;
} {
  const origin = asset.raw.indicators[0]?.metadata.origins?.[0];
  if (!origin) {
    return { attributionName: null, attributionUrl: null, publishedAt: null };
  }
  const name =
    typeof origin.attributionShort === "string"
      ? origin.attributionShort
      : typeof origin.producer === "string"
        ? origin.producer
        : null;
  return {
    attributionName: name,
    attributionUrl: typeof origin.urlMain === "string" ? origin.urlMain : null,
    publishedAt: typeof origin.datePublished === "string" ? origin.datePublished : null,
  };
}

function buildRightsEvidence(asset: OwidAssetFetch, checkedAt: string): RightsEvidence {
  const indicatorEvidence: IndicatorRightsEvidence[] = asset.raw.indicators.map((indicator) => ({
    indicator_url: indicator.url,
    non_redistributable:
      typeof indicator.metadata.nonRedistributable === "boolean"
        ? indicator.metadata.nonRedistributable
        : null,
    origins: (indicator.metadata.origins ?? []).map((origin) => ({
      license_code: normalizeSupportedLicense(
        typeof origin.license?.name === "string" ? origin.license.name : null,
      ),
      license_raw: typeof origin.license?.name === "string" ? origin.license.name : null,
      license_url: typeof origin.license?.url === "string" ? origin.license.url : null,
    })),
  }));

  return {
    // B2 does not fetch chart footer ownership notices. Keep ownership and chart
    // license unknown until B6/manual evidence supplies chart-specific proof.
    chart_owner: null,
    chart_license_code: null,
    chart_license_raw: null,
    chart_license_url: null,
    chart_license_explicit: false,
    manual_review_completed: false,
    embed_available: true,
    chart_reuse_prohibited: null,
    evidence_conflict: false,
    citation_available: asset.normalized.citationText !== null,
    indicator_evidence: indicatorEvidence,
    evidence_url: asset.urls.canonicalUrl,
    evidence_checked_at: checkedAt,
  };
}

function buildMetadataJson(asset: OwidAssetFetch, rightsEvidence: RightsEvidence): string {
  const chart = asset.raw.metadata.chart;
  const columns = Object.fromEntries(
    Object.entries(asset.raw.metadata.columns ?? {}).map(([key, column]) => [
      key,
      {
        title: column.title,
        shortUnit: column.shortUnit,
        unit: column.unit,
        citationShort: column.citationShort,
        citationLong: column.citationLong,
        lastUpdated: column.lastUpdated,
        nextUpdate: column.nextUpdate,
        fullMetadata: column.fullMetadata,
        owidVariableId: column.owidVariableId,
      },
    ]),
  );
  const indicators = asset.raw.indicators.map((indicator) => ({
    url: indicator.url,
    metadata: {
      id: indicator.metadata.id,
      name: indicator.metadata.name,
      processingLevel: indicator.metadata.processingLevel,
      nonRedistributable: indicator.metadata.nonRedistributable,
      origins: (indicator.metadata.origins ?? []).map((origin) => ({
        id: origin.id,
        title: origin.title,
        producer: origin.producer,
        citationFull: origin.citationFull,
        attributionShort: origin.attributionShort,
        urlMain: origin.urlMain,
        urlDownload: origin.urlDownload,
        dateAccessed: origin.dateAccessed,
        datePublished: origin.datePublished,
        license: origin.license
          ? { name: origin.license.name, url: origin.license.url }
          : undefined,
      })),
    },
  }));

  return JSON.stringify({
    source: "owid",
    metadata: {
      chart: chart
        ? {
            title: chart.title,
            subtitle: chart.subtitle,
            citation: chart.citation,
            originalChartUrl: chart.originalChartUrl,
          }
        : undefined,
      columns,
      dateDownloaded: asset.raw.metadata.dateDownloaded,
    },
    config: {
      id: asset.raw.config.id,
      slug: asset.raw.config.slug,
      title: asset.raw.config.title,
      originUrl: asset.raw.config.originUrl,
    },
    indicators,
    rights_evidence: rightsEvidence,
  });
}

export function buildImportAssetRecord(
  asset: OwidAssetFetch,
  checkedAt: string,
  sourceId = DEFAULT_SOURCE_ID,
): ImportAssetRecord {
  const rightsEvidence = buildRightsEvidence(asset, checkedAt);
  const classification = classifyRights(rightsEvidence);
  const origin = firstOrigin(asset);
  const licenseCode =
    classification.chart_license === "CUSTOM_OR_UNKNOWN" ? null : classification.chart_license;
  const description = asset.normalized.description;

  return {
    id: createAssetId(asset.slug),
    source_id: sourceId,
    external_id: asset.normalized.externalId,
    slug: asset.slug,
    asset_type: "chart",
    title: asset.normalized.title,
    description,
    canonical_url: asset.urls.canonicalUrl,
    canonical_url_normalized: asset.urls.canonicalUrl,
    embed_url: asset.urls.embedUrl,
    preview_url: asset.urls.previewUrl,
    citation_text: asset.normalized.citationText,
    attribution_name: origin.attributionName,
    attribution_url: origin.attributionUrl,
    published_at: origin.publishedAt,
    source_updated_at: asset.normalized.sourceUpdatedAt,
    license_code: licenseCode,
    rights_status: classification.rights_status,
    rights_json: JSON.stringify(classification.rights),
    metadata_json: buildMetadataJson(asset, rightsEvidence),
    search_document: [asset.normalized.title, description, "chart", "Our World in Data"]
      .filter(Boolean)
      .join(" "),
    status: "draft",
    created_at: checkedAt,
    updated_at: checkedAt,
    last_checked_at: checkedAt,
  };
}

export function buildSourceImportAssetRecord(
  asset: SourceAssetRecordInput,
  checkedAt: string,
): ImportAssetRecord {
  const classification = classifyRights(asset.rights_evidence);
  const licenseCode =
    classification.chart_license === "CUSTOM_OR_UNKNOWN" ? null : classification.chart_license;
  return {
    id: asset.id,
    source_id: asset.source_id,
    external_id: asset.external_id,
    slug: asset.slug,
    asset_type: asset.asset_type,
    title: asset.title,
    description: asset.description,
    canonical_url: asset.canonical_url,
    canonical_url_normalized: asset.canonical_url,
    embed_url: asset.embed_url,
    preview_url: asset.preview_url,
    citation_text: asset.citation_text,
    attribution_name: asset.attribution_name,
    attribution_url: asset.attribution_url,
    published_at: asset.published_at,
    source_updated_at: asset.source_updated_at,
    license_code: licenseCode,
    rights_status: classification.rights_status,
    rights_json: JSON.stringify(classification.rights),
    metadata_json: JSON.stringify({
      ...asset.metadata,
      rights_evidence: asset.rights_evidence,
    }),
    search_document: [asset.title, asset.description, ...asset.search_terms]
      .filter(Boolean)
      .join(" "),
    status: "draft",
    created_at: checkedAt,
    updated_at: checkedAt,
    last_checked_at: checkedAt,
  };
}

function resultId(runId: string, index: number): string {
  return `ingest_result_${runId}_${index}`;
}

function detailJson(value: unknown): string {
  return JSON.stringify(value);
}

function buildNormalizeResults(
  report: NormalizeReport,
  runId: string,
  now: string,
): ImportResultRecord[] {
  const results: ImportResultRecord[] = [];
  let index = 0;
  for (const duplicate of report.duplicates) {
    results.push({
      id: resultId(runId, index++),
      external_id: duplicate.slug,
      status: "duplicate",
      reason_code: "duplicate_slug",
      detail_json: detailJson(duplicate),
      created_at: now,
    });
  }
  for (const invalid of report.invalid) {
    results.push({
      id: resultId(runId, index++),
      external_id: null,
      status: "invalid",
      reason_code: "invalid_input",
      detail_json: detailJson(invalid),
      created_at: now,
    });
  }
  return results;
}

export async function prepareOwidImport(
  input: string,
  format: "csv" | "json" | "txt",
  options: ImportRunnerOptions = {},
): Promise<OwidImportPlan> {
  const startedAt = options.now ?? nowIso();
  const completedAt = options.now ?? nowIso();
  const runId = options.run_id ?? createRunId(startedAt);
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const normalizeReport = normalizeOwidInput(input, format);
  const sourceClient = options.source_client ?? new OwidSourceClient({ concurrency: 4 });
  const fetched = await sourceClient.fetchAssets(
    normalizeReport.accepted.map((accepted) => accepted.slug),
  );
  const assets = fetched.successful.map((asset) =>
    buildImportAssetRecord(asset, completedAt, sourceId),
  );
  const results = buildNormalizeResults(normalizeReport, runId, completedAt);
  let resultIndex = results.length;

  for (const asset of assets) {
    results.push({
      id: resultId(runId, resultIndex++),
      external_id: asset.external_id,
      status: "upserted",
      reason_code: null,
      detail_json: detailJson({ slug: asset.slug, rights_status: asset.rights_status }),
      created_at: completedAt,
    });
  }
  for (const failure of fetched.failed) {
    results.push({
      id: resultId(runId, resultIndex++),
      external_id: failure.slug,
      status: "failed",
      reason_code: failure.error.code,
      detail_json: detailJson(failure.error),
      created_at: completedAt,
    });
  }

  const errors = fetched.failed.length;
  const partial = errors > 0 || normalizeReport.invalid.length > 0;
  const status = partial ? (assets.length > 0 ? "partial" : "failed") : "succeeded";
  return {
    run_id: runId,
    source_id: sourceId,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    normalize_report: normalizeReport,
    fetched,
    assets,
    results,
    counts: {
      accepted: assets.length,
      duplicates: normalizeReport.duplicates.length,
      invalid: normalizeReport.invalid.length,
      errors,
    },
  };
}

const insertRunSql = `
  INSERT INTO ingest_runs (
    id, source_id, status, accepted_count, duplicate_count, invalid_count, error_count,
    started_at, completed_at
  ) VALUES (?, ?, 'running', 0, 0, 0, 0, ?, NULL)
`;

const insertAssetSql = `
  INSERT OR IGNORE INTO assets (
    id, source_id, creator_id, external_id, slug, asset_type, title, description,
    canonical_url, canonical_url_normalized, embed_url, preview_url, citation_text,
    attribution_name, attribution_url, published_at, source_updated_at, license_code,
    rights_status, rights_json, metadata_json, search_document, status, created_at,
    updated_at, last_checked_at
  ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const updateImportedAssetSql = `
  UPDATE assets SET
    source_id = ?, external_id = ?, asset_type = ?, title = ?, description = ?,
    canonical_url = ?, canonical_url_normalized = ?, embed_url = ?, preview_url = ?,
    citation_text = ?, attribution_name = ?, attribution_url = ?, published_at = ?,
    source_updated_at = ?, search_document = ?, updated_at = ?, last_checked_at = ?
  WHERE slug = ?
`;

const insertResultSql = `
  INSERT INTO ingest_results (
    id, ingest_run_id, external_id, status, reason_code, detail_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const updateRunSql = `
  UPDATE ingest_runs
  SET status = ?, accepted_count = ?, duplicate_count = ?, invalid_count = ?,
      error_count = ?, completed_at = ?
  WHERE id = ?
`;

function assetBindings(asset: ImportAssetRecord): unknown[] {
  return [
    asset.id,
    asset.source_id,
    asset.external_id,
    asset.slug,
    asset.asset_type,
    asset.title,
    asset.description,
    asset.canonical_url,
    asset.canonical_url_normalized,
    asset.embed_url,
    asset.preview_url,
    asset.citation_text,
    asset.attribution_name,
    asset.attribution_url,
    asset.published_at,
    asset.source_updated_at,
    asset.license_code,
    asset.rights_status,
    asset.rights_json,
    asset.metadata_json,
    asset.search_document,
    asset.status,
    asset.created_at,
    asset.updated_at,
    asset.last_checked_at,
  ];
}

function importedAssetUpdateBindings(asset: ImportAssetRecord): unknown[] {
  return [
    asset.source_id,
    asset.external_id,
    asset.asset_type,
    asset.title,
    asset.description,
    asset.canonical_url,
    asset.canonical_url_normalized,
    asset.embed_url,
    asset.preview_url,
    asset.citation_text,
    asset.attribution_name,
    asset.attribution_url,
    asset.published_at,
    asset.source_updated_at,
    asset.search_document,
    asset.updated_at,
    asset.last_checked_at,
    asset.slug,
  ];
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function writeImport(
  db: D1Database,
  plan: ImportPlan,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ImportRunResult> {
  await db.prepare(insertRunSql).bind(plan.run_id, plan.source_id, plan.started_at).run();

  try {
    const statements = [
      ...plan.assets.flatMap((asset) => [
        db.prepare(insertAssetSql).bind(...assetBindings(asset)),
        db.prepare(updateImportedAssetSql).bind(...importedAssetUpdateBindings(asset)),
      ]),
      ...plan.results.map((result) =>
        db
          .prepare(insertResultSql)
          .bind(
            result.id,
            plan.run_id,
            result.external_id,
            result.status,
            result.reason_code,
            result.detail_json,
            result.created_at,
          ),
      ),
    ];
    for (const statementBatch of chunk(statements, Math.max(1, batchSize))) {
      await db.batch(statementBatch);
    }
    await rebuildAssetSearchTrigrams(db);
    await db
      .prepare(updateRunSql)
      .bind(
        plan.status,
        plan.counts.accepted,
        plan.counts.duplicates,
        plan.counts.invalid,
        plan.counts.errors,
        plan.completed_at,
        plan.run_id,
      )
      .run();
    return { plan, database_written: true };
  } catch (error) {
    await db
      .prepare(updateRunSql)
      .bind(
        "failed",
        plan.counts.accepted,
        plan.counts.duplicates,
        plan.counts.invalid,
        plan.counts.errors + 1,
        plan.completed_at,
        plan.run_id,
      )
      .run();
    throw error;
  }
}

export async function writeOwidImport(
  db: D1Database,
  plan: OwidImportPlan,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<ImportRunResult> {
  return writeImport(db, plan, batchSize);
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  const stringValue = String(value).replace(/'/g, "''");
  return `'${stringValue}'`;
}

function sqlAssetValues(asset: ImportAssetRecord): string {
  return [asset.id, asset.source_id, null, ...assetBindings(asset).slice(2)]
    .map(sqlLiteral)
    .join(", ");
}

function sqlAssetInsertStatement(asset: ImportAssetRecord): string {
  return `INSERT OR IGNORE INTO assets (
  id, source_id, creator_id, external_id, slug, asset_type, title, description,
  canonical_url, canonical_url_normalized, embed_url, preview_url, citation_text,
  attribution_name, attribution_url, published_at, source_updated_at, license_code,
  rights_status, rights_json, metadata_json, search_document, status, created_at,
  updated_at, last_checked_at
) VALUES (${sqlAssetValues(asset)});`;
}

function sqlAssetUpdateStatement(asset: ImportAssetRecord): string {
  const values = importedAssetUpdateBindings(asset).map(sqlLiteral);
  return `UPDATE assets SET source_id = ${values[0]}, external_id = ${values[1]}, asset_type = ${values[2]}, title = ${values[3]}, description = ${values[4]}, canonical_url = ${values[5]}, canonical_url_normalized = ${values[6]}, embed_url = ${values[7]}, preview_url = ${values[8]}, citation_text = ${values[9]}, attribution_name = ${values[10]}, attribution_url = ${values[11]}, published_at = ${values[12]}, source_updated_at = ${values[13]}, search_document = ${values[14]}, updated_at = ${values[15]}, last_checked_at = ${values[16]} WHERE slug = ${values[17]};`;
}

function d1QueryParameters(values: unknown[]): D1QueryParameter[] {
  return values.map((value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return String(value);
  });
}

export function buildImportQueries(
  plan: ImportPlan,
  options: { rebuildSearchIndex?: boolean } = {},
): D1ParameterizedQuery[] {
  return [
    {
      sql: insertRunSql,
      params: d1QueryParameters([plan.run_id, plan.source_id, plan.started_at]),
    },
    ...plan.assets.flatMap((asset) => [
      { sql: insertAssetSql, params: d1QueryParameters(assetBindings(asset)) },
      {
        sql: updateImportedAssetSql,
        params: d1QueryParameters(importedAssetUpdateBindings(asset)),
      },
    ]),
    ...plan.results.map((result) => ({
      sql: insertResultSql,
      params: d1QueryParameters([
        result.id,
        plan.run_id,
        result.external_id,
        result.status,
        result.reason_code,
        result.detail_json,
        result.created_at,
      ]),
    })),
    ...(options.rebuildSearchIndex === false
      ? []
      : [
          { sql: "DELETE FROM asset_search_trigrams", params: [] },
          { sql: rebuildAssetSearchTrigramsSql, params: [] },
        ]),
    {
      sql: updateRunSql,
      params: d1QueryParameters([
        plan.status,
        plan.counts.accepted,
        plan.counts.duplicates,
        plan.counts.invalid,
        plan.counts.errors,
        plan.completed_at,
        plan.run_id,
      ]),
    },
  ];
}

export function buildOwidImportQueries(
  plan: OwidImportPlan,
  options: { rebuildSearchIndex?: boolean } = {},
): D1ParameterizedQuery[] {
  return buildImportQueries(plan, options);
}

export function buildImportSql(
  plan: ImportPlan,
  options: { rebuildSearchIndex?: boolean } = {},
): string {
  const statements = [
    `INSERT INTO ingest_runs (id, source_id, status, accepted_count, duplicate_count, invalid_count, error_count, started_at, completed_at) VALUES (${sqlLiteral(plan.run_id)}, ${sqlLiteral(plan.source_id)}, 'running', 0, 0, 0, 0, ${sqlLiteral(plan.started_at)}, NULL);`,
    ...plan.assets.flatMap((asset) => [
      sqlAssetInsertStatement(asset),
      sqlAssetUpdateStatement(asset),
    ]),
    ...plan.results.map(
      (result) =>
        `INSERT INTO ingest_results (id, ingest_run_id, external_id, status, reason_code, detail_json, created_at) VALUES (${[result.id, plan.run_id, result.external_id, result.status, result.reason_code, result.detail_json, result.created_at].map(sqlLiteral).join(", ")});`,
    ),
    ...(options.rebuildSearchIndex === false
      ? []
      : ["DELETE FROM asset_search_trigrams;", `${rebuildAssetSearchTrigramsSql.trim()};`]),
    `UPDATE ingest_runs SET status = ${sqlLiteral(plan.status)}, accepted_count = ${plan.counts.accepted}, duplicate_count = ${plan.counts.duplicates}, invalid_count = ${plan.counts.invalid}, error_count = ${plan.counts.errors}, completed_at = ${sqlLiteral(plan.completed_at)} WHERE id = ${sqlLiteral(plan.run_id)};`,
  ];
  return `${statements.join("\n\n")}\n`;
}

export function buildOwidImportSql(
  plan: OwidImportPlan,
  options: { rebuildSearchIndex?: boolean } = {},
): string {
  return buildImportSql(plan, options);
}
