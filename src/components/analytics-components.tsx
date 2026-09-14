"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { recordAssetAnalyticsEvent, recordSearchAnalytics } from "./analytics-client";

export function SearchAnalyticsBeacon({
  query,
  resultCount,
  resultIds,
}: {
  query: string;
  resultCount: number;
  resultIds: string[];
}) {
  const sent = useRef(false);
  const resultKey = resultIds.join(",");

  useEffect(() => {
    if (sent.current || query.trim() === "") return;
    sent.current = true;
    void recordSearchAnalytics({ query, resultCount, assetIds: resultIds });
  }, [query, resultCount, resultKey]);

  return null;
}

export function AssetAnalyticsBeacon({ assetSlug }: { assetSlug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void recordAssetAnalyticsEvent(assetSlug, "detail_view");
  }, [assetSlug]);

  return null;
}

export function TrackedSourceLink({
  assetSlug,
  href,
  children,
  className,
  rel,
  target,
}: {
  assetSlug: string;
  href: string;
  children: ReactNode;
  className?: string;
  rel?: string;
  target?: string;
}) {
  return (
    <a
      className={className}
      href={href}
      onClick={() => void recordAssetAnalyticsEvent(assetSlug, "source_click")}
      rel={rel}
      target={target}
    >
      {children}
    </a>
  );
}
