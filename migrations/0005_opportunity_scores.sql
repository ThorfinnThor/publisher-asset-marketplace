CREATE TABLE opportunity_scores (
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  scored_at TEXT NOT NULL,
  normalization_version TEXT NOT NULL,
  score_version TEXT NOT NULL,
  aggregation_key TEXT NOT NULL,
  display_query TEXT NOT NULL,
  topic_key TEXT,
  searches INTEGER NOT NULL CHECK (searches >= 0),
  unique_anonymous_sessions INTEGER NOT NULL CHECK (unique_anonymous_sessions >= 0),
  result_count_distribution_json TEXT NOT NULL CHECK (json_valid(result_count_distribution_json)),
  median_result_count INTEGER CHECK (median_result_count IS NULL OR median_result_count >= 0),
  no_result_searches INTEGER NOT NULL CHECK (no_result_searches >= 0),
  no_result_rate REAL NOT NULL CHECK (no_result_rate >= 0 AND no_result_rate <= 1),
  asset_clicks INTEGER NOT NULL CHECK (asset_clicks >= 0),
  embed_copies INTEGER NOT NULL CHECK (embed_copies >= 0),
  citation_copies INTEGER NOT NULL CHECK (citation_copies >= 0),
  safe_asset_count INTEGER CHECK (safe_asset_count IS NULL OR safe_asset_count >= 0),
  embeddable_asset_count INTEGER CHECK (embeddable_asset_count IS NULL OR embeddable_asset_count >= 0),
  demand_points INTEGER CHECK (demand_points IS NULL OR demand_points BETWEEN 0 AND 5),
  scarcity_points REAL CHECK (scarcity_points IS NULL OR scarcity_points BETWEEN 0 AND 5),
  engagement_intent REAL CHECK (engagement_intent IS NULL OR engagement_intent BETWEEN 1 AND 2),
  opportunity_score INTEGER CHECK (opportunity_score IS NULL OR opportunity_score BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('scored', 'insufficient_data', 'unavailable')),
  reason_code TEXT,
  explanation_json TEXT NOT NULL CHECK (json_valid(explanation_json)),
  PRIMARY KEY (window_end, normalization_version, score_version, aggregation_key)
);

CREATE INDEX opportunity_scores_score_idx
  ON opportunity_scores(window_end, normalization_version, score_version, opportunity_score DESC);

CREATE INDEX opportunity_scores_status_idx
  ON opportunity_scores(window_end, status, opportunity_score DESC);
