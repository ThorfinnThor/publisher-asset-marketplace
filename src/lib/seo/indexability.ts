import type { Metadata } from "next";
import type { PublishedAssetDetail } from "@/lib/assets/get-asset";
import { normalizePublicHttpsUrl } from "@/lib/submissions/validate";

export type SearchIndexableValue = boolean | number | null | undefined;

export function isSearchIndexable(value: SearchIndexableValue): boolean {
  return value === true || value === 1;
}

export function assetRobotsMetadata(value: SearchIndexableValue): Metadata["robots"] {
  const index = isSearchIndexable(value);
  return {
    index,
    follow: true,
    googleBot: {
      index,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export function isAssetSeoEligible(
  asset: Pick<
    PublishedAssetDetail,
    "canonical_url" | "description" | "rights_status" | "search_indexable" | "title"
  >,
): boolean {
  return (
    asset.rights_status === "safe" &&
    isSearchIndexable(asset.search_indexable) &&
    asset.title.trim().length >= 8 &&
    asset.description.trim().length >= 50 &&
    normalizePublicHttpsUrl(asset.canonical_url).ok
  );
}
