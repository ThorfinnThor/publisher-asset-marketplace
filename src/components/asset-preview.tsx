"use client";

import { useState } from "react";

import { ChartPreview } from "@/components/design-system";
import { WorldBankDataChart } from "@/components/worldbank-data-chart";
import { parseSourcePreviewSource } from "@/lib/assets/source-data-preview";
import { parseWorldBankIndicator } from "@/lib/assets/worldbank-chart";
import type { DesignAsset } from "@/lib/design-assets";

import { SourceDataPreview } from "./source-data-preview";

type AssetPreviewProps = {
  compact?: boolean;
  previewUrl?: string | null;
  metadataJson?: string | null;
  title: string;
  variant: DesignAsset["preview"];
};

export function AssetPreview({
  compact = false,
  metadataJson = null,
  previewUrl,
  title,
  variant,
}: AssetPreviewProps) {
  const [failed, setFailed] = useState(false);

  if (!previewUrl || failed) {
    if (parseSourcePreviewSource(metadataJson) === "worldbank") {
      const indicator = parseWorldBankIndicator(metadataJson, "");
      if (indicator) {
        return (
          <WorldBankDataChart
            compact={compact}
            indicator={indicator}
            metadataJson={metadataJson}
            title={title}
          />
        );
      }
    }
    return (
      <SourceDataPreview
        compact={compact}
        fallback={<ChartPreview compact={compact} variant={variant} />}
        metadataJson={metadataJson}
      />
    );
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
