import handler from "vinext/server/fetch-handler";

import { runDemandAggregation } from "../src/lib/analytics/demand-aggregation";
import { runAssetRefresh } from "../src/lib/ingest/refresh-runner";

type WorkerEnv = { DB: D1Database };

const worker = {
  fetch(request: Request, env: WorkerEnv, context: ExecutionContext): Promise<Response> {
    return handler.fetch(request, env, context);
  },
  async scheduled(
    controller: ScheduledController,
    env: WorkerEnv,
    context: ExecutionContext,
  ): Promise<void> {
    context.waitUntil(
      runAssetRefresh(env.DB, {
        now: new Date(controller.scheduledTime).toISOString(),
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
        now: new Date(controller.scheduledTime).toISOString(),
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
        })
        .catch((error: unknown) => {
          console.error(
            JSON.stringify({
              event: "demand_aggregation_failed",
              message: error instanceof Error ? error.message : "unknown_error",
            }),
          );
        }),
    );
  },
};

export default worker;
