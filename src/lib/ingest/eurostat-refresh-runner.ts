import {
  writeAssetRefresh,
  type RefreshAssetRow,
  type RefreshPlan,
  type RefreshRunResult,
} from "./refresh-runner";
import { buildEurostatImportAssetRecord } from "./eurostat-import-runner";
import { EurostatSourceClient, type EurostatAssetFetch } from "./eurostat-source-client";
import { classifyRights, type RightsEvidence } from "../rights/classify-rights";

const DEFAULT_SOURCE_ID = "source_eurostat";
const DEFAULT_MAX_ASSETS = 10;
const DEFAULT_MIN_CHECK_INTERVAL_HOURS = 24;
const DEFAULT_STALE_AFTER_DAYS = 30;
const millisecondsPerHour = 60 * 60 * 1_000;
const millisecondsPerDay = 24 * millisecondsPerHour;

export type EurostatRefreshAssetRow = RefreshAssetRow & {
  external_id: string | null;
  canonical_url: string;
  citation_text: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
};

export type EurostatRefreshOptions = {
  source_id?: string;
  now?: string;
  run_id?: string;
  max_assets?: number;
  min_check_interval_hours?: number;
  stale_after_days?: number;
  source_client?: Pick<EurostatSourceClient, "fetchAssets">;
};

function validDate(value: string | null | undefined): value is string {
  return Boolean(value) && !Number.isNaN(Date.parse(value as string));
}

export function selectEurostatRefreshCandidates(
  assets: EurostatRefreshAssetRow[],
  options: Pick<
    EurostatRefreshOptions,
    "now" | "max_assets" | "min_check_interval_hours" | "stale_after_days"
  > = {},
): EurostatRefreshAssetRow[] {
  const now = options.now ?? new Date().toISOString();
  const maxAssets = options.max_assets ?? DEFAULT_MAX_ASSETS;
  const minIntervalHours = options.min_check_interval_hours ?? DEFAULT_MIN_CHECK_INTERVAL_HOURS;
  const staleAfterDays = options.stale_after_days ?? DEFAULT_STALE_AFTER_DAYS;
  const nowTime = Date.parse(now);
  return [...assets]
    .filter((asset) => asset.status !== "hidden")
    .filter((asset) => {
      if (!validDate(asset.last_checked_at)) return true;
      return nowTime - Date.parse(asset.last_checked_at) >= minIntervalHours * millisecondsPerHour;
    })
    .filter((asset) => {
      if (!validDate(asset.source_updated_at)) return true;
      return (nowTime - Date.parse(asset.source_updated_at)) / millisecondsPerDay > staleAfterDays;
    })
    .sort((left, right) => {
      const leftChecked = validDate(left.last_checked_at) ? Date.parse(left.last_checked_at) : 0;
      const rightChecked = validDate(right.last_checked_at) ? Date.parse(right.last_checked_at) : 0;
      return leftChecked - rightChecked || left.slug.localeCompare(right.slug);
    })
    .slice(0, Math.max(1, maxAssets));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseRightsEvidence(metadata: Record<string, unknown> | null): RightsEvidence | null {
  const evidence = metadata?.rights_evidence;
  if (!isRecord(evidence) || typeof evidence.manual_review_completed !== "boolean") return null;
  return evidence as RightsEvidence;
}

function policyFingerprint(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.policy_fingerprint;
  return typeof value === "string" ? value : null;
}

function mergeEurostatRecord(
  existing: EurostatRefreshAssetRow,
  fetched: EurostatAssetFetch,
  checkedAt: string,
) {
  const fresh = buildEurostatImportAssetRecord(fetched, checkedAt, existing.source_id);
  const previousMetadata = parseRecord(existing.metadata_json);
  const freshMetadata = parseRecord(fresh.metadata_json) ?? {};
  const previousEvidence = parseRightsEvidence(previousMetadata);
  const freshEvidence = parseRightsEvidence(freshMetadata);
  if (!freshEvidence)
    throw new Error(`Eurostat refresh produced invalid rights evidence for ${existing.slug}`);
  const policyChanged = policyFingerprint(previousMetadata) !== policyFingerprint(freshMetadata);
  const preserveManualReview = previousEvidence?.manual_review_completed === true;
  const mergedEvidence: RightsEvidence = {
    ...freshEvidence,
    ...(preserveManualReview && previousEvidence
      ? {
          chart_owner: previousEvidence.chart_owner,
          chart_license_code: previousEvidence.chart_license_code,
          chart_license_raw: previousEvidence.chart_license_raw,
          chart_license_url: previousEvidence.chart_license_url,
          chart_license_explicit: previousEvidence.chart_license_explicit,
          manual_review_completed: true,
          embed_available: previousEvidence.embed_available,
          citation_only_allowed: previousEvidence.citation_only_allowed,
          chart_reuse_prohibited: previousEvidence.chart_reuse_prohibited,
        }
      : {}),
    evidence_conflict: Boolean(previousEvidence?.evidence_conflict) || policyChanged,
    evidence_checked_at: checkedAt,
  };
  const classification = classifyRights(mergedEvidence);
  return {
    ...fresh,
    citation_text: existing.citation_text ?? fresh.citation_text,
    attribution_name: existing.attribution_name ?? fresh.attribution_name,
    attribution_url: existing.attribution_url ?? fresh.attribution_url,
    license_code:
      classification.chart_license === "CUSTOM_OR_UNKNOWN" ? null : classification.chart_license,
    rights_status: classification.rights_status,
    rights_json: JSON.stringify(classification.rights),
    metadata_json: JSON.stringify({ ...freshMetadata, rights_evidence: mergedEvidence }),
    status: policyChanged ? ("review" as const) : existing.status,
    created_at: existing.created_at,
    updated_at: checkedAt,
    last_checked_at: checkedAt,
  };
}

function createRunId(startedAt: string): string {
  const compact = startedAt.replace(/[^0-9]/g, "").slice(0, 17);
  return `refresh_eurostat_${compact}_${crypto.randomUUID().slice(0, 8)}`;
}

function resultId(runId: string, index: number): string {
  return `refresh_result_${runId}_${index}`;
}

export async function prepareEurostatRefresh(
  assets: EurostatRefreshAssetRow[],
  options: EurostatRefreshOptions = {},
): Promise<RefreshPlan> {
  const startedAt = options.now ?? new Date().toISOString();
  const completedAt = options.now ?? new Date().toISOString();
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const runId = options.run_id ?? createRunId(startedAt);
  const candidates = selectEurostatRefreshCandidates(assets, options);
  const fetchable = candidates.filter((asset) => asset.external_id !== null);
  const sourceClient = options.source_client ?? new EurostatSourceClient();
  const fetched = await sourceClient.fetchAssets(
    fetchable.map((asset) => asset.external_id as string),
  );
  const byDataset = new Map(fetched.successful.map((asset) => [asset.datasetCode, asset]));
  const failures = new Map(fetched.failed.map((failure) => [failure.datasetCode, failure]));
  const updates: RefreshPlan["updates"] = [];
  const hidden: EurostatRefreshAssetRow[] = [];
  const failed: EurostatRefreshAssetRow[] = [];
  const results: RefreshPlan["results"] = [];

  candidates.forEach((candidate, index) => {
    const fetchedAsset = candidate.external_id ? byDataset.get(candidate.external_id) : undefined;
    const failure = candidate.external_id ? failures.get(candidate.external_id) : undefined;
    if (fetchedAsset) {
      const refreshed = mergeEurostatRecord(candidate, fetchedAsset, completedAt);
      updates.push({ existing: candidate, refreshed });
      results.push({
        id: resultId(runId, index),
        asset_id: candidate.id,
        outcome: "refreshed",
        reason_code: refreshed.status === "review" ? "source_policy_changed" : "source_revalidated",
        detail_json: JSON.stringify({
          previous: {
            source_updated_at: candidate.source_updated_at,
            rights_status: candidate.rights_status,
          },
          current: {
            source_updated_at: refreshed.source_updated_at,
            rights_status: refreshed.rights_status,
            status: refreshed.status,
          },
        }),
        created_at: completedAt,
      });
      return;
    }
    if (failure?.error.status === 404 || failure?.error.code === "http_404") {
      hidden.push(candidate);
      results.push({
        id: resultId(runId, index),
        asset_id: candidate.id,
        outcome: "hidden",
        reason_code: "source_not_found",
        detail_json: JSON.stringify(failure.error),
        created_at: completedAt,
      });
      return;
    }
    failed.push(candidate);
    results.push({
      id: resultId(runId, index),
      asset_id: candidate.id,
      outcome: "failed",
      reason_code: candidate.external_id
        ? (failure?.error.code ?? "refresh_failed")
        : "missing_external_id",
      detail_json: JSON.stringify(failure?.error ?? { external_id: candidate.external_id }),
      created_at: completedAt,
    });
  });

  return {
    run_id: runId,
    source_id: sourceId,
    started_at: startedAt,
    completed_at: completedAt,
    status:
      failed.length > 0 ? (updates.length + hidden.length > 0 ? "partial" : "failed") : "succeeded",
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

const selectAssetsSql = `
  SELECT id, source_id, external_id, slug, title, canonical_url, citation_text,
    attribution_name, attribution_url, rights_status, status, source_updated_at,
    last_checked_at, created_at, metadata_json, rights_json
  FROM assets
  WHERE source_id = ? AND status != 'hidden'
  ORDER BY last_checked_at ASC, slug ASC
`;

export async function runEurostatRefresh(
  db: D1Database,
  options: EurostatRefreshOptions = {},
): Promise<RefreshRunResult> {
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const rows = await db.prepare(selectAssetsSql).bind(sourceId).all<EurostatRefreshAssetRow>();
  const plan = await prepareEurostatRefresh(rows.results, options);
  return plan.candidates.length === 0
    ? { plan, database_written: false }
    : writeAssetRefresh(db, plan);
}
