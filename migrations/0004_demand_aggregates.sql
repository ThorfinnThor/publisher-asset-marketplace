CREATE TABLE demand_daily_aggregates (
  aggregate_date TEXT NOT NULL,
  normalization_version TEXT NOT NULL,
  aggregation_key TEXT NOT NULL,
  display_query TEXT NOT NULL,
  topic_key TEXT,
  searches INTEGER NOT NULL CHECK (searches >= 0),
  unique_anonymous_sessions INTEGER NOT NULL CHECK (unique_anonymous_sessions >= 0),
  result_count_distribution_json TEXT NOT NULL CHECK (json_valid(result_count_distribution_json)),
  no_result_searches INTEGER NOT NULL CHECK (no_result_searches >= 0),
  no_result_rate REAL NOT NULL CHECK (no_result_rate >= 0 AND no_result_rate <= 1),
  asset_clicks INTEGER NOT NULL CHECK (asset_clicks >= 0),
  embed_copies INTEGER NOT NULL CHECK (embed_copies >= 0),
  citation_copies INTEGER NOT NULL CHECK (citation_copies >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (aggregate_date, normalization_version, aggregation_key)
);

CREATE INDEX demand_daily_aggregates_date_idx
  ON demand_daily_aggregates(aggregate_date, normalization_version);

CREATE INDEX demand_daily_aggregates_searches_idx
  ON demand_daily_aggregates(searches DESC, aggregate_date DESC);
