"use client";

import { useEffect, useMemo, useState } from "react";

import {
  parseWorldBankMetadataPoints,
  parseWorldBankPreviewPoints,
  type WorldBankChartPoint,
} from "@/lib/assets/worldbank-chart";
import { WorldBankBarChart } from "@/components/worldbank-bar-chart";

const MAX_RESPONSE_BYTES = 512_000;

type WorldBankDataChartProps = {
  compact?: boolean;
  indicator: string;
  metadataJson: string | null;
  title: string;
  marketplaceEmbedAvailable?: boolean;
};

export function WorldBankDataChart({
  compact = false,
  indicator,
  metadataJson,
  title,
  marketplaceEmbedAvailable = false,
}: WorldBankDataChartProps) {
  const initialPoints = useMemo(() => parseWorldBankMetadataPoints(metadataJson), [metadataJson]);
  const [points, setPoints] = useState<WorldBankChartPoint[]>(initialPoints);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">(
    initialPoints.length >= 3 ? "ready" : "loading",
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    const url = `/api/worldbank-preview/${encodeURIComponent(indicator)}`;

    async function loadLatestObservations() {
      try {
        const response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        });
        const contentLength = Number(response.headers.get("content-length") ?? "0");
        if (!response.ok || contentLength > MAX_RESPONSE_BYTES) throw new Error("invalid response");
        const value: unknown = await response.json();
        const latestPoints = parseWorldBankPreviewPoints(value);
        if (latestPoints.length === 0) throw new Error("empty response");
        setPoints(latestPoints);
        setStatus("ready");
      } catch {
        setStatus(initialPoints.length > 0 ? "ready" : "empty");
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadLatestObservations();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [indicator, initialPoints.length]);

  return (
    <div className={`worldbank-chart${compact ? " worldbank-chart--compact" : ""}`}>
      <div className="worldbank-chart__header">
        <span>Data preview</span>
        <span>{indicator}</span>
      </div>
      {status === "loading" ? (
        <div className="worldbank-chart__status" aria-live="polite">
          Loading latest World Bank observations…
        </div>
      ) : status === "empty" || points.length === 0 ? (
        <div className="worldbank-chart__status" aria-live="polite">
          No source observations are currently available for a chart.
        </div>
      ) : (
        <WorldBankBarChart points={points} title={title} />
      )}
      {compact ? null : (
        <p className="worldbank-chart__note">
          {marketplaceEmbedAvailable
            ? "Latest non-empty World Bank API observations. Cite Supply presentation, not an official World Bank embed."
            : "Latest non-empty World Bank API observations. Citation-only preview; no reusable embed is approved for this asset."}
        </p>
      )}
    </div>
  );
}
