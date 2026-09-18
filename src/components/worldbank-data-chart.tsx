"use client";

import { useEffect, useMemo, useState } from "react";

import {
  parseWorldBankMetadataPoints,
  parseWorldBankPreviewPoints,
  type WorldBankChartPoint,
} from "@/lib/assets/worldbank-chart";

const MAX_RESPONSE_BYTES = 512_000;

type WorldBankDataChartProps = {
  indicator: string;
  metadataJson: string | null;
  title: string;
};

export function WorldBankDataChart({ indicator, metadataJson, title }: WorldBankDataChartProps) {
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
    <div className="worldbank-chart">
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
        <BarChart points={points} title={title} />
      )}
      <p className="worldbank-chart__note">
        Latest non-empty World Bank API observations. Citation-only preview, not an official embed.
      </p>
    </div>
  );
}

function BarChart({ points, title }: { points: WorldBankChartPoint[]; title: string }) {
  const width = 760;
  const height = 410;
  const left = 62;
  const right = 20;
  const top = 34;
  const bottom = 70;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const values = points.map((point) => point.value);
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const range = maxValue - minValue || 1;
  const zeroY = top + ((maxValue - 0) / range) * plotHeight;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.min(58, slotWidth * 0.62);
  const ticks = Array.from({ length: 5 }, (_, index) => minValue + (range * index) / 4);

  return (
    <svg
      aria-label={`${title}. Latest values for ${points.map((point) => point.country).join(", ")}.`}
      className="worldbank-chart__plot"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      {ticks.map((tick) => {
        const y = top + ((maxValue - tick) / range) * plotHeight;
        return (
          <g key={tick}>
            <line className="worldbank-chart__grid" x1={left} x2={width - right} y1={y} y2={y} />
            <text className="worldbank-chart__axis-label" x={left - 10} y={y + 4} textAnchor="end">
              {formatCompact(tick)}
            </text>
          </g>
        );
      })}
      <line className="worldbank-chart__axis" x1={left} x2={width - right} y1={zeroY} y2={zeroY} />
      {points.map((point, index) => {
        const x = left + slotWidth * index + (slotWidth - barWidth) / 2;
        const valueY = top + ((maxValue - point.value) / range) * plotHeight;
        const y = point.value >= 0 ? valueY : zeroY;
        const barHeight = Math.max(2, Math.abs(zeroY - valueY));
        return (
          <g key={`${point.iso3}-${point.date}`}>
            <title>{`${point.country}: ${formatValue(point.value)} (${point.date})`}</title>
            <rect
              className="worldbank-chart__bar"
              height={barHeight}
              rx="3"
              width={barWidth}
              x={x}
              y={y}
            />
            <text
              className="worldbank-chart__value"
              textAnchor="middle"
              x={x + barWidth / 2}
              y={point.value >= 0 ? valueY - 8 : valueY + 15}
            >
              {formatCompact(point.value)}
            </text>
            <text
              className="worldbank-chart__country"
              textAnchor="middle"
              x={x + barWidth / 2}
              y={height - 37}
            >
              {point.iso3}
            </text>
            <text
              className="worldbank-chart__date"
              textAnchor="middle"
              x={x + barWidth / 2}
              y={height - 20}
            >
              {point.date}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) < 100 ? 1 : 0,
  }).format(value);
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}
