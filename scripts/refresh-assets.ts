export function refreshAssetsNotYetEnabled(): never {
  throw new Error(
    "Asset refresh is disabled until the OWID source contract and rights decision table are approved.",
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  refreshAssetsNotYetEnabled();
}
