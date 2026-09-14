export const assetEventTypes = [
  "impression",
  "detail_view",
  "embed_copy",
  "citation_copy",
  "source_click",
] as const;

export type AssetEventType = (typeof assetEventTypes)[number];
