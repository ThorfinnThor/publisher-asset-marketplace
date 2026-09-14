export function refreshAssetsNotYetEnabled(): never {
  throw new Error(
    "Scheduled asset refresh is not enabled yet. Use npm run ingest:import for an initial idempotent OWID import.",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshAssetsNotYetEnabled();
}
