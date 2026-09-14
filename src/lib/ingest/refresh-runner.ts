import { buildImportAssetRecord, type ImportAssetRecord } from "./import-runner";
import { OwidSourceClient, type OwidAssetFetch } from "./owid-source-client";
import { classifyRights, type RightsEvidence } from "../rights/classify-rights";
import type { RightsStatus } from "../rights/contracts";
import { rebuildAssetSearchTrigrams, rebuildAssetSearchTrigramsSql } from "../search/search-index";

const DEFAULT_SOURCE_ID = "source_owid";
const DEFAULT_MAX_ASSETS = 25;
const DEFAULT_MIN_CHECK_INTERVAL_HOURS = 24;
const DEFAULT_STALE_AFTER_DAYS = 730;
const millisecondsPerHour = 60 * 60 * 1_000;
const millisecondsPerDay = 24 * millisecondsPerHour;

export type RefreshAssetRow = {
  id: string;
  source_id: string;
  slug: string;
  title: string;
  rights_status: RightsStatus;
  status: "draft" | "review" | "published" | "hidden";
  source_updated_at: string | null;
  last_checked_at: string | null;
  created_at: string;
  metadata_json: string | null;
  rights_json: string | null;
};

export type RefreshOptions = {
  source_id?: string;
  now?: string;
  run_id?: string;
  max_assets?: number;
  min_check_interval_hours?: number;
  stale_after_days?: number;
  source_client?: Pick<OwidSourceClient, "fetchAssets">;
};

export type RefreshResultRecord = {
  id: string;
  asset_id: string;
  outcome: "refreshed" | "hidden" | "failed";
  reason_code: string;
  detail_json: string;
  created_at: string;
};

export type RefreshPlan = {
  run_id: string;
  source_id: string;
  started_at: string;
  completed_at: string;
  status: "succeeded" | "failed" | "partial";
  candidates: RefreshAssetRow[];
  updates: Array<{ existing: RefreshAssetRow; refreshed: ImportAssetRecord }>;
  hidden: RefreshAssetRow[];
  failed: RefreshAssetRow[];
  results: RefreshResultRecord[];
  counts: {
    candidates: number;
    refreshed: number;
    hidden: number;
    errors: number;
  };
};

export type RefreshRunResult = {
  plan: RefreshPlan;
  database_written: boolean;
};

function validDate(value: string | null | undefined): value is string {
  return Boolean(value) && !Number.isNaN(Date.parse(value as string));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function nextUpdateDates(metadataJson: string | null): string[] {
  const metadata = parseRecord(metadataJson);
  const sourceMetadata = isRecord(metadata?.metadata) ? metadata.metadata : null;
  const columns = isRecord(sourceMetadata?.columns) ? sourceMetadata.columns : null;
  return Object.values(columns ?? {})
    .filter(isRecord)
    .map((column) => column.nextUpdate)
    .filter((value): value is string => typeof value === "string" && validDate(value));
}

function isStale(asset: RefreshAssetRow, now: string, staleAfterDays: number): boolean {
  const auditTime = Date.parse(now);
  const nextUpdates = nextUpdateDates(asset.metadata_json).map(Date.parse);
  if (nextUpdates.length > 0) {
    return Math.min(...nextUpdates) <= auditTime;
  }
  if (!validDate(asset.source_updated_at)) {
    return true;
  }
  return (auditTime - Date.parse(asset.source_updated_at)) / millisecondsPerDay > staleAfterDays;
}

export function selectRefreshCandidates(
  assets: RefreshAssetRow[],
  options: Pick<
    RefreshOptions,
    "now" | "max_assets" | "min_check_interval_hours" | "stale_after_days"
  > = {},
): RefreshAssetRow[] {
  const now = options.now ?? new Date().toISOString();
  const maxAssets = options.max_assets ?? DEFAULT_MAX_ASSETS;
  const minIntervalHours = options.min_check_interval_hours ?? DEFAULT_MIN_CHECK_INTERVAL_HOURS;
  const staleAfterDays = options.stale_after_days ?? DEFAULT_STALE_AFTER_DAYS;
  const nowTime = Date.parse(now);
  return [...assets]
    .filter((asset) => asset.status !== "hidden")
    .filter((asset) => {
      if (!validDate(asset.last_checked_at)) {
        return true;
      }
      return nowTime - Date.parse(asset.last_checked_at) >= minIntervalHours * millisecondsPerHour;
    })
    .filter((asset) => isStale(asset, now, staleAfterDays))
    .sort((left, right) => {
      const leftChecked = validDate(left.last_checked_at) ? Date.parse(left.last_checked_at) : 0;
      const rightChecked = validDate(right.last_checked_at) ? Date.parse(right.last_checked_at) : 0;
      return leftChecked - rightChecked || left.slug.localeCompare(right.slug);
    })
    .slice(0, Math.max(1, maxAssets));
}

function createRunId(startedAt: string): string {
  const compact = startedAt.replace(/[^0-9]/g, "").slice(0, 17);
  return `refresh_owid_${compact}_${crypto.randomUUID().slice(0, 8)}`;
}

function resultId(runId: string, index: number): string {
  return `refresh_result_${runId}_${index}`;
}

function detailJson(value: unknown): string {
  return JSON.stringify(value);
}

function rightsEvidenceFromMetadata(value: string): RightsEvidence | null {
  const metadata = parseRecord(value);
  const evidence = metadata?.rights_evidence;
  return isRecord(evidence) ? (evidence as unknown as RightsEvidence) : null;
}

function mergeRefreshedRecord(
  existing: RefreshAssetRow,
  fetched: OwidAssetFetch,
  checkedAt: string,
): ImportAssetRecord {
  const fresh = buildImportAssetRecord(fetched, checkedAt, existing.source_id);
  const freshMetadata = parseRecord(fresh.metadata_json) ?? {};
  const freshEvidence = rightsEvidenceFromMetadata(fresh.metadata_json);
  const previousEvidence = existing.metadata_json
    ? rightsEvidenceFromMetadata(existing.metadata_json)
    : null;
  const preserveChartEvidence =
    previousEvidence?.manual_review_completed === true ||
    previousEvidence?.chart_license_explicit === true;
  const mergedEvidence: RightsEvidence = {
    ...(freshEvidence as RightsEvidence),
    ...(preserveChartEvidence
      ? {
          chart_owner: previousEvidence?.chart_owner ?? null,
          chart_license_code: previousEvidence?.chart_license_code ?? null,
          chart_license_raw: previousEvidence?.chart_license_raw ?? null,
          chart_license_url: previousEvidence?.chart_license_url ?? null,
          chart_license_explicit: previousEvidence?.chart_license_explicit ?? false,
          manual_review_completed: previousEvidence?.manual_review_completed ?? false,
          chart_reuse_prohibited: previousEvidence?.chart_reuse_prohibited ?? null,
          evidence_conflict: previousEvidence?.evidence_conflict ?? false,
        }
      : {}),
    evidence_checked_at: checkedAt,
  };
  const classification = classifyRights(mergedEvidence);
  const metadataJson = JSON.stringify({
    ...freshMetadata,
    rights_evidence: mergedEvidence,
  });
  return {
    ...fresh,
    license_code:
      classification.chart_license === "CUSTOM_OR_UNKNOWN" ? null : classification.chart_license,
    rights_status: classification.rights_status,
    rights_json: JSON.stringify(classification.rights),
    metadata_json: metadataJson,
    status: existing.status === "hidden" ? "draft" : existing.status,
    created_at: existing.created_at,
    updated_at: checkedAt,
    last_checked_at: checkedAt,
  };
}

export async function prepareAssetRefresh(
  assets: RefreshAssetRow[],
  options: RefreshOptions = {},
): Promise<RefreshPlan> {
  const startedAt = options.now ?? new Date().toISOString();
  const completedAt = options.now ?? new Date().toISOString();
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const runId = options.run_id ?? createRunId(startedAt);
  const candidates = selectRefreshCandidates(assets, options);
  const sourceClient = options.source_client ?? new OwidSourceClient({ concurrency: 4 });
  const fetched = await sourceClient.fetchAssets(candidates.map((candidate) => candidate.slug));
  const bySlug = new Map(fetched.successful.map((asset) => [asset.slug, asset]));
  const failures = new Map(fetched.failed.map((failure) => [failure.slug, failure]));
  const updates: RefreshPlan["updates"] = [];
  const hidden: RefreshAssetRow[] = [];
  const failed: RefreshAssetRow[] = [];
  const results: RefreshResultRecord[] = [];

  candidates.forEach((candidate, index) => {
    const fetchedAsset = bySlug.get(candidate.slug);
    const failure = failures.get(candidate.slug);
    if (fetchedAsset) {
      const refreshed = mergeRefreshedRecord(candidate, fetchedAsset, completedAt);
      updates.push({ existing: candidate, refreshed });
      results.push({
        id: resultId(runId, index),
        asset_id: candidate.id,
        outcome: "refreshed",
        reason_code: "source_revalidated",
        detail_json: detailJson({
          previous: {
            source_updated_at: candidate.source_updated_at,
            rights_status: candidate.rights_status,
            rights_json: candidate.rights_json,
          },
          current: {
            source_updated_at: refreshed.source_updated_at,
            rights_status: refreshed.rights_status,
          },
        }),
        created_at: completedAt,
      });
      return;
    }

    const notFound = failure?.error.status === 404 || failure?.error.code === "http_404";
    if (notFound) {
      hidden.push(candidate);
      results.push({
        id: resultId(runId, index),
        asset_id: candidate.id,
        outcome: "hidden",
        reason_code: "source_not_found",
        detail_json: detailJson({ failure: failure?.error, previous_status: candidate.status }),
        created_at: completedAt,
      });
      return;
    }

    failed.push(candidate);
    results.push({
      id: resultId(runId, index),
      asset_id: candidate.id,
      outcome: "failed",
      reason_code: failure?.error.code ?? "refresh_failed",
      detail_json: detailJson({ failure: failure?.error, previous_status: candidate.status }),
      created_at: completedAt,
    });
  });

  const status =
    failed.length > 0 ? (updates.length + hidden.length > 0 ? "partial" : "failed") : "succeeded";
  return {
    run_id: runId,
    source_id: sourceId,
    started_at: startedAt,
    completed_at: completedAt,
    status,
    candidates,
    updates,
    hidden,
    failed,
    results,
    counts: {
      candidates: candidates.length,
      refreshed: updates.length,
      hidden: hidden.length,
      errors: failed.length,
    },
  };
}

const insertRunSql = `
  INSERT INTO refresh_runs (
    id, source_id, status, candidate_count, refreshed_count, hidden_count, error_count,
    started_at, completed_at
  ) VALUES (?, ?, 'running', 0, 0, 0, 0, ?, NULL)
`;

const updateAssetSql = `
  UPDATE assets SET
    external_id = ?, asset_type = ?, title = ?, description = ?, canonical_url = ?,
    canonical_url_normalized = ?, embed_url = ?, preview_url = ?, citation_text = ?,
    attribution_name = ?, attribution_url = ?, published_at = ?, source_updated_at = ?,
    license_code = ?, rights_status = ?, rights_json = ?, metadata_json = ?,
    search_document = ?, status = ?, updated_at = ?, last_checked_at = ?
  WHERE id = ?
`;

const insertResultSql = `
  INSERT INTO refresh_results (
    id, refresh_run_id, asset_id, outcome, reason_code, detail_json, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

const updateRunSql = `
  UPDATE refresh_runs
  SET status = ?, candidate_count = ?, refreshed_count = ?, hidden_count = ?,
      error_count = ?, completed_at = ?
  WHERE id = ?
`;

function refreshedBindings(asset: ImportAssetRecord, id: string): unknown[] {
  return [
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
    asset.license_code,
    asset.rights_status,
    asset.rights_json,
    asset.metadata_json,
    asset.search_document,
    asset.status,
    asset.updated_at,
    asset.last_checked_at,
    id,
  ];
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUpdateStatement(asset: ImportAssetRecord, id: string): string {
  const values = refreshedBindings(asset, id).map(sqlLiteral);
  return `UPDATE assets SET external_id = ${values[0]}, asset_type = ${values[1]}, title = ${values[2]}, description = ${values[3]}, canonical_url = ${values[4]}, canonical_url_normalized = ${values[5]}, embed_url = ${values[6]}, preview_url = ${values[7]}, citation_text = ${values[8]}, attribution_name = ${values[9]}, attribution_url = ${values[10]}, published_at = ${values[11]}, source_updated_at = ${values[12]}, license_code = ${values[13]}, rights_status = ${values[14]}, rights_json = ${values[15]}, metadata_json = ${values[16]}, search_document = ${values[17]}, status = ${values[18]}, updated_at = ${values[19]}, last_checked_at = ${values[20]} WHERE id = ${values[21]};`;
}

export async function writeAssetRefresh(
  db: D1Database,
  plan: RefreshPlan,
): Promise<RefreshRunResult> {
  await db.prepare(insertRunSql).bind(plan.run_id, plan.source_id, plan.started_at).run();
  try {
    const statements = [
      ...plan.updates.map(({ existing, refreshed }) =>
        db.prepare(updateAssetSql).bind(...refreshedBindings(refreshed, existing.id)),
      ),
      ...plan.hidden.map((asset) =>
        db
          .prepare(
            "UPDATE assets SET status = 'hidden', updated_at = ?, last_checked_at = ? WHERE id = ?",
          )
          .bind(plan.completed_at, plan.completed_at, asset.id),
      ),
      ...plan.failed.map((asset) =>
        db
          .prepare("UPDATE assets SET last_checked_at = ? WHERE id = ?")
          .bind(plan.completed_at, asset.id),
      ),
      ...plan.results.map((result) =>
        db
          .prepare(insertResultSql)
          .bind(
            result.id,
            plan.run_id,
            result.asset_id,
            result.outcome,
            result.reason_code,
            result.detail_json,
            result.created_at,
          ),
      ),
    ];
    if (statements.length > 0) {
      await db.batch(statements);
    }
    await rebuildAssetSearchTrigrams(db);
    await db
      .prepare(updateRunSql)
      .bind(
        plan.status,
        plan.counts.candidates,
        plan.counts.refreshed,
        plan.counts.hidden,
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
        plan.counts.candidates,
        plan.counts.refreshed,
        plan.counts.hidden,
        plan.counts.errors + 1,
        plan.completed_at,
        plan.run_id,
      )
      .run();
    throw error;
  }
}

const selectAssetsSql = `
  SELECT id, source_id, slug, title, rights_status, status, source_updated_at,
    last_checked_at, created_at, metadata_json, rights_json
  FROM assets
  WHERE source_id = ? AND status != 'hidden'
  ORDER BY last_checked_at ASC, slug ASC
`;

export async function runAssetRefresh(
  db: D1Database,
  options: RefreshOptions = {},
): Promise<RefreshRunResult> {
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const rows = await db.prepare(selectAssetsSql).bind(sourceId).all<RefreshAssetRow>();
  const plan = await prepareAssetRefresh(rows.results, options);
  return writeAssetRefresh(db, plan);
}

export function buildAssetRefreshSql(plan: RefreshPlan): string {
  const statements = [
    "BEGIN TRANSACTION;",
    `INSERT INTO refresh_runs (id, source_id, status, candidate_count, refreshed_count, hidden_count, error_count, started_at, completed_at) VALUES (${sqlLiteral(plan.run_id)}, ${sqlLiteral(plan.source_id)}, 'running', 0, 0, 0, 0, ${sqlLiteral(plan.started_at)}, NULL);`,
    ...plan.updates.map(({ existing, refreshed }) => sqlUpdateStatement(refreshed, existing.id)),
    ...plan.hidden.map(
      (asset) =>
        `UPDATE assets SET status = 'hidden', updated_at = ${sqlLiteral(plan.completed_at)}, last_checked_at = ${sqlLiteral(plan.completed_at)} WHERE id = ${sqlLiteral(asset.id)};`,
    ),
    ...plan.failed.map(
      (asset) =>
        `UPDATE assets SET last_checked_at = ${sqlLiteral(plan.completed_at)} WHERE id = ${sqlLiteral(asset.id)};`,
    ),
    ...plan.results.map(
      (result) =>
        `INSERT INTO refresh_results (id, refresh_run_id, asset_id, outcome, reason_code, detail_json, created_at) VALUES (${[result.id, plan.run_id, result.asset_id, result.outcome, result.reason_code, result.detail_json, result.created_at].map(sqlLiteral).join(", ")});`,
    ),
    "DELETE FROM asset_search_trigrams;",
    rebuildAssetSearchTrigramsSql.trim(),
    `UPDATE refresh_runs SET status = ${sqlLiteral(plan.status)}, candidate_count = ${plan.counts.candidates}, refreshed_count = ${plan.counts.refreshed}, hidden_count = ${plan.counts.hidden}, error_count = ${plan.counts.errors}, completed_at = ${sqlLiteral(plan.completed_at)} WHERE id = ${sqlLiteral(plan.run_id)};`,
    "COMMIT;",
  ];
  return `${statements.join("\n\n")}\n`;
}
