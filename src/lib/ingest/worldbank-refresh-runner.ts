import {
  writeAssetRefresh,
  type RefreshAssetRow,
  type RefreshPlan,
  type RefreshRunResult,
} from "./refresh-runner";
import { buildWorldBankImportAssetRecord } from "./worldbank-import-runner";
import { WorldBankSourceClient, type WorldBankAssetFetch } from "./worldbank-source-client";
import { classifyRights, type RightsEvidence } from "../rights/classify-rights";

const DEFAULT_SOURCE_ID = "source_worldbank";
const DEFAULT_MAX_ASSETS = 10;
const DEFAULT_MIN_CHECK_INTERVAL_HOURS = 24;
const DEFAULT_STALE_AFTER_DAYS = 365;
const millisecondsPerHour = 60 * 60 * 1_000;
const millisecondsPerDay = 24 * millisecondsPerHour;

export type WorldBankRefreshAssetRow = RefreshAssetRow & {
  external_id: string | null;
  canonical_url: string;
  citation_text: string | null;
  attribution_name: string | null;
  attribution_url: string | null;
};

export type WorldBankRefreshOptions = {
  source_id?: string;
  now?: string;
  run_id?: string;
  max_assets?: number;
  min_check_interval_hours?: number;
  stale_after_days?: number;
  source_client?: Pick<WorldBankSourceClient, "fetchAssets">;
};

function validDate(value: string | null | undefined): value is string {
  return Boolean(value) && !Number.isNaN(Date.parse(value as string));
}

function effectiveSourceDate(value: string): number {
  const yearOnly = /^(\d{4})$/.exec(value);
  return yearOnly ? Date.UTC(Number(yearOnly[1]) + 1, 0, 1) : Date.parse(value);
}

export function selectWorldBankRefreshCandidates(
  assets: WorldBankRefreshAssetRow[],
  options: Pick<
    WorldBankRefreshOptions,
    "now" | "max_assets" | "min_check_interval_hours" | "stale_after_days"
  > = {},
): WorldBankRefreshAssetRow[] {
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
      return (
        (nowTime - effectiveSourceDate(asset.source_updated_at)) / millisecondsPerDay >
        staleAfterDays
      );
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

function rightsEvidence(metadata: Record<string, unknown> | null): RightsEvidence | null {
  return isRecord(metadata?.rights_evidence)
    ? (metadata.rights_evidence as unknown as RightsEvidence)
    : null;
}

function policyFingerprint(metadata: Record<string, unknown> | null): string {
  const header = isRecord(metadata?.header) ? metadata.header : {};
  return JSON.stringify({
    license: typeof header.license === "string" ? header.license : null,
    license_url: typeof header.license_url === "string" ? header.license_url : null,
    provider: typeof header.provider === "string" ? header.provider : null,
  });
}

function mergeWorldBankRecord(
  existing: WorldBankRefreshAssetRow,
  fetched: WorldBankAssetFetch,
  checkedAt: string,
) {
  const fresh = buildWorldBankImportAssetRecord(fetched, checkedAt, existing.source_id);
  const previousMetadata = parseRecord(existing.metadata_json);
  const freshMetadata = parseRecord(fresh.metadata_json) ?? {};
  const previousEvidence = rightsEvidence(previousMetadata);
  const freshEvidence = rightsEvidence(freshMetadata) as RightsEvidence;
  const preserveManualReview = previousEvidence?.manual_review_completed === true;
  const policyChanged = policyFingerprint(previousMetadata) !== policyFingerprint(freshMetadata);
  const mergedEvidence: RightsEvidence = {
    ...freshEvidence,
    ...(preserveManualReview
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
  return `refresh_worldbank_${compact}_${crypto.randomUUID().slice(0, 8)}`;
}

function resultId(runId: string, index: number): string {
  return `refresh_result_${runId}_${index}`;
}

export async function prepareWorldBankRefresh(
  assets: WorldBankRefreshAssetRow[],
  options: WorldBankRefreshOptions = {},
): Promise<RefreshPlan> {
  const startedAt = options.now ?? new Date().toISOString();
  const completedAt = options.now ?? new Date().toISOString();
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const runId = options.run_id ?? createRunId(startedAt);
  const candidates = selectWorldBankRefreshCandidates(assets, options);
  const fetchable = candidates.filter((asset) => asset.external_id !== null);
  const sourceClient = options.source_client ?? new WorldBankSourceClient({ concurrency: 4 });
  const fetched = await sourceClient.fetchAssets(
    fetchable.map((asset) => asset.external_id as string),
  );
  const byIndicator = new Map(fetched.successful.map((asset) => [asset.indicator, asset]));
  const failures = new Map(fetched.failed.map((failure) => [failure.indicator, failure]));
  const updates: RefreshPlan["updates"] = [];
  const hidden: RefreshAssetRow[] = [];
  const failed: RefreshAssetRow[] = [];
  const results: RefreshPlan["results"] = [];

  candidates.forEach((candidate, index) => {
    const fetchedAsset = candidate.external_id ? byIndicator.get(candidate.external_id) : undefined;
    const failure = candidate.external_id ? failures.get(candidate.external_id) : undefined;
    if (fetchedAsset) {
      const refreshed = mergeWorldBankRecord(candidate, fetchedAsset, completedAt);
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

  const errors = failed.length;
  return {
    run_id: runId,
    source_id: sourceId,
    started_at: startedAt,
    completed_at: completedAt,
    status:
      errors > 0 ? (updates.length > 0 || hidden.length > 0 ? "partial" : "failed") : "succeeded",
    candidates,
    updates,
    hidden,
    failed,
    results,
    counts: {
      candidates: candidates.length,
      refreshed: updates.length,
      hidden: hidden.length,
      errors,
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

export async function runWorldBankRefresh(
  db: D1Database,
  options: WorldBankRefreshOptions = {},
): Promise<RefreshRunResult> {
  const sourceId = options.source_id ?? DEFAULT_SOURCE_ID;
  const rows = await db.prepare(selectAssetsSql).bind(sourceId).all<WorldBankRefreshAssetRow>();
  const plan = await prepareWorldBankRefresh(rows.results, options);
  return plan.candidates.length === 0
    ? { plan, database_written: false }
    : writeAssetRefresh(db, plan);
}
