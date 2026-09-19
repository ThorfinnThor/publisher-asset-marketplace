"use client";

import type { ReactNode } from "react";

import {
  parseSourcePreview,
  parseSourcePreviewSource,
  type SourcePreviewSource,
} from "@/lib/assets/source-data-preview";

type SourceDataPreviewProps = {
  compact?: boolean;
  fallback?: ReactNode;
  metadataJson: string | null;
};

export function SourceDataPreview({
  compact = false,
  fallback = null,
  metadataJson,
}: SourceDataPreviewProps) {
  const preview = parseSourcePreview(metadataJson);
  if (!preview) {
    const source = parseSourcePreviewSource(metadataJson);
    return source ? <SourceDataPreviewUnavailable compact={compact} source={source} /> : fallback;
  }

  const rows = preview.rows.slice(0, compact ? 4 : 12);
  return (
    <div className={`source-data-preview${compact ? " source-data-preview--compact" : ""}`}>
      <div className="source-data-preview__header">
        <span>Data preview</span>
        <span>{preview.label}</span>
      </div>
      <div className="source-data-preview__table-wrap">
        <table>
          <caption className="sr-only">Reviewed data preview from {preview.label}</caption>
          <thead>
            <tr>
              {preview.columns.map((column) => (
                <th key={column.id} scope="col">
                  {column.label}
                </th>
              ))}
              <th scope="col">Value</th>
              {preview.rows.some((row) => row.flag) ? <th scope="col">Flag</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${index}-${row.value}`}>
                {row.cells.map((cell, cellIndex) => (
                  <td key={`${cellIndex}-${cell}`}>{cell || "—"}</td>
                ))}
                <td className="source-data-preview__value">{row.value}</td>
                {preview.rows.some((item) => item.flag) ? <td>{row.flag || "—"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="source-data-preview__note">
        {preview.note}
        {preview.rows.length > rows.length
          ? ` Showing ${rows.length} of ${preview.rows.length}.`
          : ""}
      </p>
    </div>
  );
}

function SourceDataPreviewUnavailable({
  compact,
  source,
}: {
  compact: boolean;
  source: SourcePreviewSource;
}) {
  const sourceLabel = source === "worldbank" ? "World Bank" : "Eurostat";
  return (
    <div className={`source-data-preview${compact ? " source-data-preview--compact" : ""}`}>
      <div className="source-data-preview__header">
        <span>Data preview</span>
        <span>{sourceLabel}</span>
      </div>
      <div className="source-data-preview__empty">
        <strong>Preview unavailable</strong>
        <span>No non-empty source observations are available for this asset.</span>
      </div>
    </div>
  );
}
