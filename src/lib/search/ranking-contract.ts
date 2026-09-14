export type SearchMatchedField = "title" | "asset_type" | "description" | "source";

export type SearchFilters = {
  asset_types?: string[];
  source_ids?: string[];
  rights_statuses?: Array<"safe" | "restricted">;
  updated_since?: string;
};

export type SearchRequest = {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  cursor?: string;
};

export type SearchResultContract<TAsset = unknown> = {
  asset: TAsset;
  score: number;
  matched_fields: SearchMatchedField[];
  retrieval_path: "fts" | "trigram";
};

export const searchRankingV1 = {
  version: "1.0.0",
  default_limit: 24,
  maximum_limit: 50,
  primary_candidate_limit: 100,
  fallback_result_threshold: 3,
  query: {
    maximum_characters: 120,
    maximum_tokens: 8,
    minimum_token_characters: 2,
    stop_words: ["a", "an", "the", "to", "of", "for", "in", "on", "by", "with", "and", "or"],
  },
  hard_eligibility: {
    publication_status: "published",
    rights_statuses: ["safe", "restricted"],
    excluded_rights_statuses: ["unknown", "blocked"],
  },
  fts5: {
    tokenizer: "porter unicode61 remove_diacritics 2",
    column_weights: {
      title: 10,
      asset_type: 6,
      description: 4,
      source: 1,
    },
    primary_score_base: 100,
    reciprocal_rank_points_max: 60,
  },
  boosts: {
    exact_title: 120,
    title_phrase: 70,
    safe_and_embeddable: 12,
    safe_without_embed: 8,
    restricted_and_embeddable: 4,
    fresh_90_days: 8,
    fresh_365_days: 5,
    fresh_1095_days: 2,
  },
  trigram: {
    minimum_query_characters: 5,
    minimum_similarity: 0.3,
    score_multiplier: 60,
  },
  tie_breakers: ["score_desc", "normalized_title_asc", "slug_asc"],
  matched_field_order: ["title", "asset_type", "description", "source"],
} as const;
