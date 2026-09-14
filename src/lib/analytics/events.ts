export const assetEventTypes = [
  "impression",
  "detail_view",
  "embed_copy",
  "citation_copy",
  "source_click",
] as const;

export type AssetEventType = (typeof assetEventTypes)[number];

export const publicAssetEventTypes = ["detail_view", "source_click"] as const;

export type PublicAssetEventType = (typeof publicAssetEventTypes)[number];

export function isAnonymousSessionId(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}

export function isPublicAssetEventType(value: string): value is PublicAssetEventType {
  return publicAssetEventTypes.includes(value as PublicAssetEventType);
}
