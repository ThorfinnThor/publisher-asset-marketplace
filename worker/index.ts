import handler from "vinext/server/fetch-handler";

import { runDemandAggregation } from "../src/lib/analytics/demand-aggregation";
import { runOpportunityScoring } from "../src/lib/analytics/opportunity-runner";
import { runAssetRefresh } from "../src/lib/ingest/refresh-runner";
import { withSecurityHeaders } from "../src/lib/security-headers";

type WorkerEnv = { DB: D1Database };

const worker = {
  fetch(request: Request, env: WorkerEnv, context: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, context).then(withSecurityHeaders);
  },
  async scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    context: ExecutionContext,
  ): Promise<void> {
    const scheduledAt = new Date(controller.scheduledTime).toISOString();
    context.waitUntil(
      runAssetRefresh(env.DB, {
        now: scheduledAt,
        max_assets: 25,
      }).then((result) => {
        console.log(
          JSON.stringify({
            event: "asset_refresh_completed",
            run_id: result.plan.run_id,
            status: result.plan.status,
            ...result.plan.counts,
          }),
        );
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
};

export default worker;
