export type AnalyticsWritePolicyEnv = {
  D1_SEARCH_ANALYTICS_ENABLED?: string;
  D1_EMBED_AGGREGATES_ENABLED?: string;
};

export function d1SearchAnalyticsEnabled(env: AnalyticsWritePolicyEnv): boolean {
  return env.D1_SEARCH_ANALYTICS_ENABLED === "true";
}

export function d1EmbedAggregatesEnabled(env: AnalyticsWritePolicyEnv): boolean {
  return env.D1_EMBED_AGGREGATES_ENABLED === "true";
}
