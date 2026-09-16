import { env } from "cloudflare:workers";

export function getDatabase(): D1Database {
  return env.DB;
}

export function getUrlScanQueue(): Queue {
  return env.URL_SCAN_JOBS;
}

export function getUrlScanPreviewService(): Fetcher {
  return env.URL_SCANNER;
}
