import handler from "vinext/server/fetch-handler";

import { runDemandAggregation } from "../src/lib/analytics/demand-aggregation";
import { runOpportunityScoring } from "../src/lib/analytics/opportunity-runner";
import { runAssetRefresh } from "../src/lib/ingest/refresh-runner";
import { runWorldBankRefresh } from "../src/lib/ingest/worldbank-refresh-runner";
import { withSecurityHeaders } from "../src/lib/security-headers";
import { expireUrlScanJobs } from "../src/lib/submissions/url-scan-jobs";
import { consumeUrlScanResults } from "./url-scan-results";

const worker = {
  fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, context).then(withSecurityHeaders);
  },
  async scheduled(
    controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): Promise<void> {
    const scheduledAt = new Date(controller.scheduledTime).toISOString();
    context.waitUntil(
      expireUrlScanJobs(env.DB, scheduledAt).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            event: "url_scan_expiration_failed",
            message: error instanceof Error ? error.message : "unknown_error",
          }),
        );
      }),
    );
    context.waitUntil(
      runAssetRefresh(env.DB, {
        now: scheduledAt,
        max_assets: 25,
      })
        .then((result) => {
          console.log(
            JSON.stringify({
              event: "asset_refresh_completed",
              source_id: result.plan.source_id,
              run_id: result.plan.run_id,
              status: result.plan.status,
              ...result.plan.counts,
            }),
          );
          return runWorldBankRefresh(env.DB, {
            now: scheduledAt,
            max_assets: 10,
          });
        })
        .then((result) => {
          console.log(
            JSON.stringify({
              event: "asset_refresh_completed",
              source_id: result.plan.source_id,
              run_id: result.plan.run_id,
              status: result.plan.status,
              database_written: result.database_written,
              ...result.plan.counts,
            }),
          );
        })
        .catch((error: unknown) => {
          console.error(
            JSON.stringify({
              event: "asset_refresh_failed",
              message: error instanceof Error ? error.message : "unknown_error",
            }),
          );
          throw error;
        }),
    );
    context.waitUntil(
      runDemandAggregation(env.DB, {
        now: scheduledAt,
      })
        .then((result) => {
          console.log(
            JSON.stringify({
              event: "demand_aggregation_completed",
              aggregate_date: result.aggregate_date,
              eligible_searches: result.eligible_searches,
              suppressed_searches: result.suppressed_searches,
              aggregate_count: result.aggregates.length,
            }),
          );
          return runOpportunityScoring(env.DB, {
            scored_at: scheduledAt,
          });
        })
        .then((result) => {
          console.log(
            JSON.stringify({
              event: "opportunity_scoring_completed",
              window_start: result.window_start,
              window_end: result.window_end,
              snapshot_count: result.snapshots.length,
              scored_count: result.snapshots.filter((snapshot) => snapshot.status === "scored")
                .length,
            }),
          );
        })
        .catch((error: unknown) => {
          console.error(
            JSON.stringify({
              event: "demand_intelligence_failed",
              message: error instanceof Error ? error.message : "unknown_error",
            }),
          );
        }),
    );
  },
  async queue(batch: MessageBatch<unknown>, env: Env): Promise<void> {
    await consumeUrlScanResults(batch, env.DB);
  },
};

export default worker;
