import {
  demandQueryNormalizationVersion,
  normalizeDemandQuery,
} from "../search/normalize-demand-query";
import { completeDemandWindows } from "./demand-dashboard";
import { opportunityScoreVersion } from "./opportunity-score";

const publicOpportunityLimit = 12;

type PublicOpportunitySqlRow = {
  display_query: string;
  searches: number | string;
  safe_asset_count: number | string | null;
  embeddable_asset_count: number | string | null;
  opportunity_score: number | string | null;
};

export type PublicOpportunity = {
  query: string;
  demand_band: string;
  supply_band: string;
};

export type PublicOpportunityData = {
  windowEnd: string;
  opportunities: PublicOpportunity[];
};

export const publicOpportunitySql = `
  SELECT display_query, searches, safe_asset_count, embeddable_asset_count, opportunity_score
  FROM opportunity_scores
  WHERE window_end = (
    SELECT MAX(window_end)
    FROM opportunity_scores
    WHERE window_end <= ?
      AND normalization_version = ?
      AND score_version = ?
  )
    AND normalization_version = ?
    AND score_version = ?
    AND status = 'scored'
    AND searches >= 5
    AND safe_asset_count <= 2
    AND embeddable_asset_count <= 1
  ORDER BY opportunity_score DESC, searches DESC, display_query ASC
  LIMIT ?
`;

function asInteger(value: number | string | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

export function demandBand(searches: number): string {
  if (searches >= 100) return "100+ searches";
  if (searches >= 50) return "50–99 searches";
  if (searches >= 25) return "25–49 searches";
  if (searches >= 10) return "10–24 searches";
  return "5–9 searches";
}

export function supplyBand(safeAssets: number, embeddableAssets: number): string {
  if (safeAssets === 0 && embeddableAssets === 0) return "No publishable sources yet";
  if (embeddableAssets === 0) return "No embeddable sources yet";
  if (safeAssets <= 1 || embeddableAssets === 1) return "Few publishable sources";
  return "Low current supply";
}

export function mapPublicOpportunities(rows: PublicOpportunitySqlRow[]): PublicOpportunity[] {
  return rows
    .filter((row) => {
      const normalized = normalizeDemandQuery(row.display_query);
      return (
        normalized.aggregation_eligible &&
        Boolean(normalized.display_query) &&
        asInteger(row.searches) >= 5
      );
    })
    .map((row) => ({
      query: normalizeDemandQuery(row.display_query).display_query as string,
      demand_band: demandBand(asInteger(row.searches)),
      supply_band: supplyBand(
        asInteger(row.safe_asset_count),
        asInteger(row.embeddable_asset_count),
      ),
    }));
}

export async function getPublicOpportunities(
  db: D1Database,
  now = new Date(),
): Promise<PublicOpportunityData> {
  const { window } = completeDemandWindows(now);
  const reads = await db.batch([
    db
      .prepare(publicOpportunitySql)
      .bind(
        `${window.end}T00:00:00.000Z`,
        demandQueryNormalizationVersion,
        opportunityScoreVersion,
        demandQueryNormalizationVersion,
        opportunityScoreVersion,
        publicOpportunityLimit,
      ),
  ]);
  return {
    windowEnd: window.end,
    opportunities: mapPublicOpportunities((reads[0]?.results ?? []) as PublicOpportunitySqlRow[]),
  };
}
