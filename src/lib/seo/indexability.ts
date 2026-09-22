import type { Metadata } from "next";

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
