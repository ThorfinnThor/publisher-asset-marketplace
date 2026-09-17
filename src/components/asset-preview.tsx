"use client";

import { useState } from "react";

import { ChartPreview } from "@/components/design-system";
import type { DesignAsset } from "@/lib/design-assets";

type AssetPreviewProps = {
  compact?: boolean;
  previewUrl?: string | null;
  title: string;
  variant: DesignAsset["preview"];
};

export function AssetPreview({ compact = false, previewUrl, title, variant }: AssetPreviewProps) {
  const [failed, setFailed] = useState(false);

  if (!previewUrl || failed) {
    return <ChartPreview compact={compact} variant={variant} />;
  }

  return (
    <div className={compact ? "asset-preview asset-preview--compact" : "asset-preview"}>
      <div className="asset-preview__label">
        <span>Preview</span>
        <span>Submitted image</span>
      </div>
      <img
        alt={`Preview of ${title}`}
        className="asset-preview__image"
        decoding="async"
        loading={compact ? "lazy" : "eager"}
        onError={() => setFailed(true)}
        src={previewUrl}
      />
    </div>
  );
}
