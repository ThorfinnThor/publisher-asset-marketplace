import handler from "vinext/server/fetch-handler";

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
  },
};

export default worker;
