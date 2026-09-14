import Link from "next/link";

import type { DesignAsset } from "@/lib/design-assets";

type IconProps = { className?: string };

export function SearchIcon({ className = "icon" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.75" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className = "icon" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function CopyIcon({ className = "icon" }: IconProps) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect height="12" rx="2" width="12" x="8" y="8" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function ChartPreview({
  variant,
  compact = false,
}: {
  variant: DesignAsset["preview"];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "chart-preview chart-preview--compact" : "chart-preview"}>
      <div className="chart-preview__label">
        <span>Preview</span>
        <span>Interface sample</span>
      </div>
      <svg
        aria-label="Interface preview only; not source data"
        className="chart-preview__graphic"
        role="img"
        viewBox="0 0 320 150"
      >
        <title>Interface preview only; not source data</title>
        <path className="chart-grid" d="M20 25H304M20 65H304M20 105H304M20 140H304" />
        {variant === "line" ? (
          <>
            <path
              className="chart-line"
              d="M20 128C52 125 68 118 94 109S134 83 158 79s39-3 63-22 46-27 83-35"
            />
            <circle className="chart-dot" cx="304" cy="22" r="4" />
          </>
        ) : null}
        {variant === "bars" ? (
          <g className="chart-bars">
            <rect height="36" width="28" x="36" y="104" />
            <rect height="54" width="28" x="83" y="86" />
            <rect height="72" width="28" x="130" y="68" />
            <rect height="92" width="28" x="177" y="48" />
            <rect height="116" width="28" x="224" y="24" />
          </g>
        ) : null}
        {variant === "steps" ? (
          <>
            <path className="chart-line" d="M20 25h43v13h43v18h43v20h43v23h43v21h43v14h43" />
            <circle className="chart-dot" cx="301" cy="134" r="4" />
          </>
        ) : null}
      </svg>
    </div>
  );
}

export function RightsBadge({
  children,
  state = "unknown",
}: {
  children: React.ReactNode;
  state?: "verified" | "restricted" | "unknown" | "blocked";
}) {
  return (
    <span className={`rights-badge rights-badge--${state}`}>
      <span aria-hidden="true" className="rights-badge__dot" />
      {children}
    </span>
  );
}

export function AssetCard({ asset }: { asset: DesignAsset }) {
  return (
    <article className="asset-card">
      <Link
        aria-label={`Preview ${asset.title}`}
        className="asset-card__preview"
        href={`/asset/${asset.slug}`}
      >
        <ChartPreview compact variant={asset.preview} />
      </Link>
      <div className="asset-card__body">
        <div className="asset-card__eyebrow">
          <span>{asset.assetType}</span>
          <span aria-hidden="true">·</span>
          <span>{asset.topic}</span>
        </div>
        <h2 className="asset-card__title">
          <Link href={`/asset/${asset.slug}`}>{asset.title}</Link>
        </h2>
        <p className="asset-card__description">{asset.description}</p>
        <dl className="asset-card__meta">
          <div>
            <dt>Source</dt>
            <dd>{asset.source}</dd>
          </div>
          <div>
            <dt>Freshness</dt>
            <dd>{asset.checkedAt}</dd>
          </div>
        </dl>
        <div className="asset-card__footer">
          <div className="rights-badges" aria-label="Rights status">
            <RightsBadge>Commercial use pending</RightsBadge>
            <RightsBadge>Embed pending</RightsBadge>
          </div>
          <div className="asset-actions">
            <Link className="button button--secondary button--small" href={`/asset/${asset.slug}`}>
              Preview
            </Link>
            <a
              className="button button--text button--small"
              href={asset.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              Source <ArrowUpRightIcon />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
