import { normalizeQuery } from "./normalize-query";
import {
  searchRankingV1,
  type SearchMatchedField,
  type SearchRequest,
  type SearchResultContract,
} from "./ranking-contract";
import { buildTrigrams, normalizeSearchIndexText } from "./search-index";

type RightsJson = {
  embed_allowed?: boolean | null;
};

export type SearchCandidate = {
  id: string;
  slug: string;
  title: string;
  description: string;
  asset_type: string;
  source_name: string;
  rights_status: "safe" | "restricted";
  rights_json: string | null;
  source_updated_at: string | null;
  canonical_url?: string;
  embed_url?: string | null;
  preview_url?: string | null;
  citation_text?: string | null;
  fts_rank?: number;
  trigram_similarity?: number;
};

export type SearchAsset = Omit<SearchCandidate, "fts_rank" | "trigram_similarity">;

type SearchRow = SearchCandidate & {
  bm25_rank?: number;
};

type Cursor = {
  version: string;
  score: number;
  normalized_title: string;
  slug: string;
};

const stopWords = new Set<string>(searchRankingV1.query.stop_words);

export function retrievalTokens(query: string): string[] {
  return normalizeQuery(query)
    .split(" ")
    .filter((token) => token.length >= searchRankingV1.query.minimum_token_characters)
    .filter((token) => !stopWords.has(token))
    .slice(0, searchRankingV1.query.maximum_tokens);
}

function quoteFtsToken(token: string): string {
  return `"${token.replaceAll('"', '""')}"*`;
}

export function buildFtsMatchExpression(query: string): string {
  const normalized = normalizeQuery(query);
  if (normalized.length === 0 || normalized.length > searchRankingV1.query.maximum_characters) {
    return "";
  }
  return retrievalTokens(normalized).map(quoteFtsToken).join(" AND ");
}

function parseRights(value: string | null): RightsJson {
  if (!value) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? (parsed as RightsJson) : {};
  } catch {
    return {};
  }
}

function freshnessBoost(sourceUpdatedAt: string | null, now: string): number {
  if (!sourceUpdatedAt || Number.isNaN(Date.parse(sourceUpdatedAt))) {
    return 0;
  }
  const ageDays = Math.max(
    0,
    (Date.parse(now) - Date.parse(sourceUpdatedAt)) / (24 * 60 * 60 * 1_000),
  );
  if (ageDays <= 90) return searchRankingV1.boosts.fresh_90_days;
  if (ageDays <= 365) return searchRankingV1.boosts.fresh_365_days;
  if (ageDays <= 1_095) return searchRankingV1.boosts.fresh_1095_days;
  return 0;
}

function rightsQualityBoost(candidate: SearchCandidate): number {
  const embedAllowed = parseRights(candidate.rights_json).embed_allowed === true;
  if (candidate.rights_status === "safe") {
    return embedAllowed
      ? searchRankingV1.boosts.safe_and_embeddable
      : searchRankingV1.boosts.safe_without_embed;
  }
  return embedAllowed ? searchRankingV1.boosts.restricted_and_embeddable : 0;
}

function titleBoost(candidate: SearchCandidate, normalizedQuery: string): number {
  const title = normalizeSearchIndexText(candidate.title);
  if (title === normalizedQuery) return searchRankingV1.boosts.exact_title;
  if (title.includes(normalizedQuery)) return searchRankingV1.boosts.title_phrase;
  return 0;
}

function matchedFields(candidate: SearchCandidate, tokens: string[]): SearchMatchedField[] {
  const values: Array<[SearchMatchedField, string]> = [
    ["title", candidate.title],
    ["asset_type", candidate.asset_type],
    ["description", candidate.description],
    ["source", candidate.source_name],
  ];
  return values
    .filter(([, value]) => {
      const normalized = normalizeSearchIndexText(value);
      return tokens.some((token) => normalized.includes(token));
    })
    .map(([field]) => field);
}

function publicAsset(candidate: SearchCandidate): SearchAsset {
  return {
    id: candidate.id,
    slug: candidate.slug,
    title: candidate.title,
    description: candidate.description,
    asset_type: candidate.asset_type,
    source_name: candidate.source_name,
    rights_status: candidate.rights_status,
    rights_json: candidate.rights_json,
    source_updated_at: candidate.source_updated_at,
    canonical_url: candidate.canonical_url,
    embed_url: candidate.embed_url,
    preview_url: candidate.preview_url,
    citation_text: candidate.citation_text,
  };
}

function sortResults<T extends { score: number; asset: { title: string; slug: string } }>(
  results: T[],
): T[] {
  return results.sort(
    (left, right) =>
      right.score - left.score ||
      normalizeSearchIndexText(left.asset.title).localeCompare(
        normalizeSearchIndexText(right.asset.title),
      ) ||
      left.asset.slug.localeCompare(right.asset.slug),
  );
}

export function rankSearchCandidates(
  candidates: SearchCandidate[],
  query: string,
  now = new Date().toISOString(),
  retrievalPath: "fts" | "trigram" = "fts",
): Array<SearchResultContract<SearchAsset>> {
  const normalizedQuery = normalizeQuery(query);
  const tokens = retrievalTokens(normalizedQuery);
  return sortResults(
    candidates.map((candidate) => {
      const lexicalScore =
        retrievalPath === "fts"
          ? searchRankingV1.fts5.primary_score_base +
            Math.max(
              1,
              searchRankingV1.fts5.reciprocal_rank_points_max - (candidate.fts_rank ?? 1) + 1,
            ) +
            titleBoost(candidate, normalizedQuery)
          : (candidate.trigram_similarity ?? 0) * searchRankingV1.trigram.score_multiplier;
      return {
        asset: publicAsset(candidate),
        score:
          lexicalScore +
          rightsQualityBoost(candidate) +
          freshnessBoost(candidate.source_updated_at, now),
        matched_fields: matchedFields(candidate, tokens),
        retrieval_path: retrievalPath,
      };
    }),
  );
}

function cursorEncode(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function cursorDecode(value: string | undefined): Cursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Cursor;
    return cursor.version === searchRankingV1.version && typeof cursor.score === "number"
      ? cursor
      : null;
  } catch {
    return null;
  }
}

function applyCursor<T extends SearchResultContract<SearchAsset>>(
  results: T[],
  cursor: Cursor | null,
): T[] {
  if (!cursor) return results;
  const index = results.findIndex(
    (result) =>
      result.score === cursor.score &&
      normalizeSearchIndexText(result.asset.title) === cursor.normalized_title &&
      result.asset.slug === cursor.slug,
  );
  return index >= 0 ? results.slice(index + 1) : results;
}

function filterSql(filters: SearchRequest["filters"]): { sql: string; bindings: string[] } {
  const clauses = ["a.status = 'published'", "a.rights_status IN ('safe', 'restricted')"];
  const bindings: string[] = [];
  if (filters?.asset_types && filters.asset_types.length > 0) {
    clauses.push(`a.asset_type IN (${filters.asset_types.map(() => "?").join(", ")})`);
    bindings.push(...filters.asset_types);
  }
  if (filters?.source_ids && filters.source_ids.length > 0) {
    clauses.push(`a.source_id IN (${filters.source_ids.map(() => "?").join(", ")})`);
    bindings.push(...filters.source_ids);
  }
  if (filters?.rights_statuses && filters.rights_statuses.length > 0) {
    clauses.push(`a.rights_status IN (${filters.rights_statuses.map(() => "?").join(", ")})`);
    bindings.push(...filters.rights_statuses);
  }
  if (filters?.updated_since) {
    clauses.push("a.source_updated_at >= ?");
    bindings.push(filters.updated_since);
  }
  return { sql: clauses.join(" AND "), bindings };
}

export function buildPrimarySearchSql(filters: SearchRequest["filters"] = {}): string {
  const eligibility = filterSql(filters).sql;
  return `
    WITH ranked AS (
      SELECT a.id, a.slug, a.title, a.description, a.asset_type, COALESCE(sources.name, a.attribution_name, '') AS source_name,
        a.rights_status, a.rights_json, a.source_updated_at, a.canonical_url, a.embed_url, a.preview_url,
        a.citation_text,
        ROW_NUMBER() OVER (ORDER BY bm25(assets_fts, 0.0, 10.0, 4.0, 6.0, 1.0), a.slug) AS bm25_rank
      FROM assets_fts
      JOIN assets a ON a.id = assets_fts.asset_id
      LEFT JOIN sources ON sources.id = a.source_id
      WHERE assets_fts MATCH ? AND ${eligibility}
      ORDER BY bm25(assets_fts, 0.0, 10.0, 4.0, 6.0, 1.0), a.slug
      LIMIT ?
    )
    SELECT * FROM ranked
  `;
}

export function buildFallbackSearchSql(
  filters: SearchRequest["filters"] = {},
  trigramCount: number,
): string {
  const eligibility = filterSql(filters).sql;
  const placeholders = Array.from({ length: trigramCount }, () => "?").join(", ");
  return `
    SELECT a.id, a.slug, a.title, a.description, a.asset_type, COALESCE(sources.name, a.attribution_name, '') AS source_name,
      a.rights_status, a.rights_json, a.source_updated_at, a.canonical_url, a.embed_url, a.preview_url,
      a.citation_text,
      COUNT(DISTINCT index_trigrams.trigram) AS shared_trigrams,
      (SELECT COUNT(*) FROM asset_search_trigrams all_trigrams WHERE all_trigrams.asset_id = a.id) AS asset_trigram_count
    FROM asset_search_trigrams index_trigrams
    JOIN assets a ON a.id = index_trigrams.asset_id
    LEFT JOIN sources ON sources.id = a.source_id
    WHERE index_trigrams.trigram IN (${placeholders}) AND ${eligibility}
    GROUP BY a.id
    HAVING shared_trigrams > 0
    LIMIT ?
  `;
}

function fallbackSimilarity(shared: number, assetTrigrams: number, queryTrigrams: number): number {
  const union = queryTrigrams + assetTrigrams - shared;
  return union > 0 ? shared / union : 0;
}

export async function searchAssets(
  db: D1Database,
  request: SearchRequest,
  options: { now?: string } = {},
): Promise<{ results: Array<SearchResultContract<SearchAsset>>; next_cursor: string | null }> {
  const normalizedQuery = normalizeQuery(request.query);
  const matchExpression = buildFtsMatchExpression(normalizedQuery);
  if (!matchExpression) {
    return { results: [], next_cursor: null };
  }
  const limit = Math.min(
    searchRankingV1.maximum_limit,
    Math.max(1, request.limit ?? searchRankingV1.default_limit),
  );
  const { bindings } = filterSql(request.filters);
  const primary = await db
    .prepare(buildPrimarySearchSql(request.filters))
    .bind(matchExpression, ...bindings, searchRankingV1.primary_candidate_limit)
    .all<SearchRow>();
  const now = options.now ?? new Date().toISOString();
  let ranked = rankSearchCandidates(
    primary.results.map((result) => ({ ...result, fts_rank: result.bm25_rank })),
    normalizedQuery,
    now,
    "fts",
  );

  if (
    ranked.length < searchRankingV1.fallback_result_threshold &&
    normalizedQuery.length >= searchRankingV1.trigram.minimum_query_characters
  ) {
    const trigrams = buildTrigrams(normalizedQuery);
    if (trigrams.length > 0) {
      const fallback = await db
        .prepare(buildFallbackSearchSql(request.filters, trigrams.length))
        .bind(...trigrams, ...bindings, 500)
        .all<SearchRow & { shared_trigrams: number; asset_trigram_count: number }>();
      const primaryIds = new Set(ranked.map((result) => result.asset.id));
      const candidates = fallback.results
        .filter((candidate) => !primaryIds.has(candidate.id))
        .map((candidate) => ({
          ...candidate,
          trigram_similarity: fallbackSimilarity(
            candidate.shared_trigrams,
            candidate.asset_trigram_count,
            trigrams.length,
          ),
        }))
        .filter(
          (candidate) => candidate.trigram_similarity >= searchRankingV1.trigram.minimum_similarity,
        );
      ranked = sortResults([
        ...ranked,
        ...rankSearchCandidates(candidates, normalizedQuery, now, "trigram"),
      ]);
    }
  }

  const page = applyCursor(ranked, cursorDecode(request.cursor)).slice(0, limit);
  const last = page.at(-1);
  return {
    results: page,
    next_cursor:
      page.length === limit && last
        ? cursorEncode({
            version: searchRankingV1.version,
            score: last.score,
            normalized_title: normalizeSearchIndexText(last.asset.title),
            slug: last.asset.slug,
          })
        : null,
  };
}
